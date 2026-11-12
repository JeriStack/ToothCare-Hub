<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Request;
use App\Repositories\DentistRepository;
use App\Repositories\UserRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Integration Test for Dentist Self-Service Profile Endpoints.
 */
class DentistProfileApiTest extends TestCase
{
    private Application $app;
    private UserRepository $userRepo;
    private DentistRepository $dentistRepo;
    private array $dentistUser;
    private array $patientUser;
    private int $dentistId;

    protected function setUp(): void
    {
        $_SESSION = [];
        TestDb::create();
        $this->app = new Application(null, false);
        $this->userRepo = new UserRepository();
        $this->dentistRepo = new DentistRepository();

        $du = $this->userRepo->create(
            'dr.profile@toothcare.local',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'DENTIST',
            1,
            1,
            'Maria',
            'Santos'
        );
        $this->dentistUser = $this->userRepo->findById($du);
        $this->dentistId = $this->dentistRepo->create([
            'user_id' => $du,
            'license_number' => 'PRC-2026-001',
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'specialization' => 'General Dentistry',
            'phone' => '+639171112222',
            'default_operatory_chair' => 'Chair 1',
            'bio' => 'Preventive and restorative clinician.',
            'is_active' => 1,
        ]);

        $pu = $this->userRepo->create(
            'patient.profile.test@toothcare.local',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'PATIENT',
            1,
            1
        );
        $this->patientUser = $this->userRepo->findById($pu);
    }

    private function makeJsonRequest(string $method, string $path, ?array $body = null, ?array $user = null): Request
    {
        $headers = [];
        $rawBody = '';
        if ($body !== null) {
            $headers['content-type'] = 'application/json';
            $rawBody = (string) json_encode($body);
        }

        $req = Request::create($method, $path, $headers, $rawBody);
        if ($user !== null) {
            $req->setUser($user);
        }

        return $req;
    }

    public function testDentistCanViewAndUpdateOwnProfileWithoutModifyingRestrictedFields(): void
    {
        $getRes = $this->app->handle($this->makeJsonRequest('GET', '/api/v1/dentist/profile', null, $this->dentistUser));
        $this->assertSame(200, $getRes->getStatusCode());
        $getData = json_decode($getRes->getBody(), true);
        $this->assertSame('Maria', $getData['data']['first_name']);
        $this->assertSame('PRC-2026-001', $getData['data']['license_number']);

        $patchRes = $this->app->handle($this->makeJsonRequest('PATCH', '/api/v1/dentist/profile', [
            'phone' => '+639179990000',
            'specialization' => 'Cosmetic & Restorative Dentistry',
            'default_operatory_chair' => 'Chair 3',
            'bio' => 'Specialized in minimally invasive restorative care.',
            'license_number' => 'TAMPERED-999',
            'is_active' => 0,
        ], $this->dentistUser));

        $this->assertSame(200, $patchRes->getStatusCode());
        $patchData = json_decode($patchRes->getBody(), true);
        $this->assertSame('+639179990000', $patchData['data']['phone']);
        $this->assertSame('Cosmetic & Restorative Dentistry', $patchData['data']['specialization']);
        $this->assertSame('Chair 3', $patchData['data']['default_operatory_chair']);
        $this->assertSame('PRC-2026-001', $patchData['data']['license_number']);
        $this->assertEquals(1, (int) $patchData['data']['is_active']);
    }

    public function testPatientAndAnonymousCannotAccessDentistProfileEndpoint(): void
    {
        $anonRes = $this->app->handle($this->makeJsonRequest('GET', '/api/v1/dentist/profile'));
        $this->assertSame(401, $anonRes->getStatusCode());

        $patientRes = $this->app->handle($this->makeJsonRequest('GET', '/api/v1/dentist/profile', null, $this->patientUser));
        $this->assertSame(403, $patientRes->getStatusCode());

        $patientUploadRes = $this->app->handle($this->makeJsonRequest('POST', '/api/v1/dentist/profile/avatar', null, $this->patientUser));
        $this->assertSame(403, $patientUploadRes->getStatusCode());
    }

    public function testDentistAvatarUploadServeAndDeleteSecurity(): void
    {
        $dentistId = $this->dentistId;
        $pngBytes = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
        $this->assertNotFalse($pngBytes);

        $tmpPng = tempnam(sys_get_temp_dir(), 'tch_dentist_avatar_');
        $this->assertNotFalse($tmpPng);
        file_put_contents($tmpPng, $pngBytes);

        $tmpSvg = tempnam(sys_get_temp_dir(), 'tch_dentist_bad_');
        $this->assertNotFalse($tmpSvg);
        file_put_contents($tmpSvg, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

        $tmpLarge = tempnam(sys_get_temp_dir(), 'tch_dentist_big_');
        $this->assertNotFalse($tmpLarge);
        file_put_contents($tmpLarge, str_repeat('A', 2 * 1024 * 1024 + 64));

        try {
            // 1. Reject SVG disguised with .png extension
            $badMimeReq = Request::create(
                'POST',
                '/api/v1/dentist/profile/avatar',
                ['content-type' => 'multipart/form-data; boundary=test'],
                '',
                [],
                null,
                [
                    'avatar' => [
                        'name' => 'malicious.png',
                        'type' => 'image/png',
                        'tmp_name' => $tmpSvg,
                        'error' => UPLOAD_ERR_OK,
                        'size' => filesize($tmpSvg),
                    ],
                ]
            );
            $badMimeReq->setUser($this->dentistUser);
            $badMimeRes = $this->app->handle($badMimeReq);
            $this->assertSame(422, $badMimeRes->getStatusCode());

            // 2. Reject file larger than 2 MB
            $oversizeReq = Request::create(
                'POST',
                '/api/v1/dentist/profile/avatar',
                ['content-type' => 'multipart/form-data; boundary=test'],
                '',
                [],
                null,
                [
                    'avatar' => [
                        'name' => 'huge.png',
                        'type' => 'image/png',
                        'tmp_name' => $tmpLarge,
                        'error' => UPLOAD_ERR_OK,
                        'size' => filesize($tmpLarge),
                    ],
                ]
            );
            $oversizeReq->setUser($this->dentistUser);
            $oversizeRes = $this->app->handle($oversizeReq);
            $this->assertSame(422, $oversizeRes->getStatusCode());

            // 3. Upload valid PNG avatar
            $uploadReq = Request::create(
                'POST',
                '/api/v1/dentist/profile/avatar',
                ['content-type' => 'multipart/form-data; boundary=test'],
                '',
                [],
                null,
                [
                    'avatar' => [
                        'name' => 'portrait.png',
                        'type' => 'image/png',
                        'tmp_name' => $tmpPng,
                        'error' => UPLOAD_ERR_OK,
                        'size' => strlen($pngBytes),
                    ],
                ]
            );
            $uploadReq->setUser($this->dentistUser);
            $uploadRes = $this->app->handle($uploadReq);
            $this->assertSame(200, $uploadRes->getStatusCode());
            $uploadPayload = json_decode($uploadRes->getBody(), true);
            $this->assertStringStartsWith("/api/v1/dentists/{$dentistId}/avatar?v=", (string) ($uploadPayload['data']['avatar_url'] ?? ''));
            $this->assertArrayNotHasKey('avatar_path', $uploadPayload['data']);
            $this->assertArrayNotHasKey('avatar_mime', $uploadPayload['data']);

            // 4. Dentist can fetch own avatar bytes cleanly
            $serveMeRes = $this->app->handle($this->makeJsonRequest('GET', '/api/v1/dentist/profile/avatar', null, $this->dentistUser));
            $this->assertSame(200, $serveMeRes->getStatusCode());
            $headers = $serveMeRes->getHeaders();
            $this->assertSame('image/png', $headers['Content-Type'] ?? null);
            $this->assertSame('nosniff', $headers['X-Content-Type-Options'] ?? null);
            $this->assertSame($pngBytes, $serveMeRes->getBody());

            // 5. Active dentist public avatar endpoint serves image bytes cleanly
            $servePublicRes = $this->app->handle($this->makeJsonRequest('GET', "/api/v1/dentists/{$dentistId}/avatar"));
            $this->assertSame(200, $servePublicRes->getStatusCode());
            $this->assertSame($pngBytes, $servePublicRes->getBody());

            // 6. Dentist removes avatar and stored file is cleaned up
            $deleteRes = $this->app->handle($this->makeJsonRequest('DELETE', '/api/v1/dentist/profile/avatar', null, $this->dentistUser));
            $this->assertSame(200, $deleteRes->getStatusCode());
            $deletePayload = json_decode($deleteRes->getBody(), true);
            $this->assertNull($deletePayload['data']['avatar_url']);

            $afterDeleteRes = $this->app->handle($this->makeJsonRequest('GET', '/api/v1/dentist/profile/avatar', null, $this->dentistUser));
            $this->assertSame(404, $afterDeleteRes->getStatusCode());
        } finally {
            @unlink($tmpPng);
            @unlink($tmpSvg);
            @unlink($tmpLarge);
        }
    }
}
