<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Request;
use App\Repositories\UserRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Integration Test for Staff / User Self-Service Profile and Avatar Upload Endpoints.
 */
class StaffProfileApiTest extends TestCase
{
    private Application $app;
    private UserRepository $userRepo;
    private array $receptionistUser;
    private int $receptionistId;

    protected function setUp(): void
    {
        $_SESSION = [];
        TestDb::create();
        $this->app = new Application(null, false);
        $this->userRepo = new UserRepository();

        $uid = $this->userRepo->create(
            'clarisse.mendoza@toothcare.local',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'RECEPTIONIST',
            1,
            1,
            'Clarisse',
            'Mendoza'
        );
        $this->receptionistId = $uid;
        $this->userRepo->updateProfile($uid, ['phone' => '+63 917 800 1234']);
        $this->receptionistUser = $this->userRepo->findById($uid);
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

    public function testReceptionistCanViewAndUpdateOwnProfile(): void
    {
        $getRes = $this->app->handle($this->makeJsonRequest('GET', '/api/v1/user/profile', null, $this->receptionistUser));
        $this->assertSame(200, $getRes->getStatusCode());
        $getData = json_decode($getRes->getBody(), true);
        $this->assertSame('Clarisse', $getData['data']['first_name']);
        $this->assertSame('Mendoza', $getData['data']['last_name']);
        $this->assertSame('RECEPTIONIST', $getData['data']['role']);
        $this->assertSame('+63 917 800 1234', $getData['data']['phone']);

        $patchRes = $this->app->handle($this->makeJsonRequest('PATCH', '/api/v1/user/profile', [
            'first_name' => 'Clarisse Joy',
            'last_name' => 'Mendoza-Santos',
            'phone' => '+63 917 999 8888',
            'role' => 'ADMIN', // must be stripped/ignored
            'is_active' => 0,
        ], $this->receptionistUser));

        $this->assertSame(200, $patchRes->getStatusCode());
        $patchData = json_decode($patchRes->getBody(), true);
        $this->assertSame('Clarisse Joy', $patchData['data']['first_name']);
        $this->assertSame('Mendoza-Santos', $patchData['data']['last_name']);
        $this->assertSame('+63 917 999 8888', $patchData['data']['phone']);
        $this->assertSame('RECEPTIONIST', $patchData['data']['role']);
        $this->assertTrue($patchData['data']['is_active']);
    }

    public function testAnonymousCannotAccessUserProfile(): void
    {
        $anonRes = $this->app->handle($this->makeJsonRequest('GET', '/api/v1/user/profile'));
        $this->assertSame(401, $anonRes->getStatusCode());
    }

    public function testReceptionistAvatarUploadValidationServeAndDelete(): void
    {
        $userId = $this->receptionistId;
        $pngBytes = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
        $this->assertNotFalse($pngBytes);

        $tmpPng = tempnam(sys_get_temp_dir(), 'tch_user_avatar_');
        $this->assertNotFalse($tmpPng);
        file_put_contents($tmpPng, $pngBytes);

        $tmpSvg = tempnam(sys_get_temp_dir(), 'tch_user_bad_');
        $this->assertNotFalse($tmpSvg);
        file_put_contents($tmpSvg, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

        $tmpLarge = tempnam(sys_get_temp_dir(), 'tch_user_big_');
        $this->assertNotFalse($tmpLarge);
        file_put_contents($tmpLarge, str_repeat('A', 2 * 1024 * 1024 + 64));

        try {
            // 1. Reject SVG disguised as PNG
            $badMimeReq = Request::create(
                'POST',
                '/api/v1/user/profile/avatar',
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
            $badMimeReq->setUser($this->receptionistUser);
            $badMimeRes = $this->app->handle($badMimeReq);
            $this->assertSame(422, $badMimeRes->getStatusCode());

            // 2. Reject file > 2 MB
            $oversizeReq = Request::create(
                'POST',
                '/api/v1/user/profile/avatar',
                ['content-type' => 'multipart/form-data; boundary=test'],
                '',
                [],
                null,
                [
                    'avatar' => [
                        'name' => 'oversize.png',
                        'type' => 'image/png',
                        'tmp_name' => $tmpLarge,
                        'error' => UPLOAD_ERR_OK,
                        'size' => filesize($tmpLarge),
                    ],
                ]
            );
            $oversizeReq->setUser($this->receptionistUser);
            $oversizeRes = $this->app->handle($oversizeReq);
            $this->assertSame(422, $oversizeRes->getStatusCode());

            // 3. Upload valid PNG
            $uploadReq = Request::create(
                'POST',
                '/api/v1/user/profile/avatar',
                ['content-type' => 'multipart/form-data; boundary=test'],
                '',
                [],
                null,
                [
                    'avatar' => [
                        'name' => 'clarisse.png',
                        'type' => 'image/png',
                        'tmp_name' => $tmpPng,
                        'error' => UPLOAD_ERR_OK,
                        'size' => strlen($pngBytes),
                    ],
                ]
            );
            $uploadReq->setUser($this->receptionistUser);
            $uploadRes = $this->app->handle($uploadReq);
            $this->assertSame(200, $uploadRes->getStatusCode());
            $uploadPayload = json_decode($uploadRes->getBody(), true);
            $this->assertStringStartsWith("/api/v1/users/{$userId}/avatar?v=", (string) ($uploadPayload['data']['avatar_url'] ?? ''));

            // 4. Serve user avatar
            $serveRes = $this->app->handle($this->makeJsonRequest('GET', '/api/v1/user/profile/avatar', null, $this->receptionistUser));
            $this->assertSame(200, $serveRes->getStatusCode());
            $headers = $serveRes->getHeaders();
            $this->assertSame('image/png', $headers['Content-Type'] ?? null);
            $this->assertSame('nosniff', $headers['X-Content-Type-Options'] ?? null);
            $this->assertSame($pngBytes, $serveRes->getBody());

            // 5. User avatar endpoint requires authentication (401 unauthenticated) and serves to owner/staff (200)
            $unauthServeByIdRes = $this->app->handle($this->makeJsonRequest('GET', "/api/v1/users/{$userId}/avatar"));
            $this->assertSame(401, $unauthServeByIdRes->getStatusCode());

            $serveByIdRes = $this->app->handle($this->makeJsonRequest('GET', "/api/v1/users/{$userId}/avatar", null, $this->receptionistUser));
            $this->assertSame(200, $serveByIdRes->getStatusCode());
            $this->assertSame($pngBytes, $serveByIdRes->getBody());

            // 6. Delete avatar
            $delRes = $this->app->handle($this->makeJsonRequest('DELETE', '/api/v1/user/profile/avatar', null, $this->receptionistUser));
            $this->assertSame(200, $delRes->getStatusCode());
            $delPayload = json_decode($delRes->getBody(), true);
            $this->assertNull($delPayload['data']['avatar_url']);

            $afterDelRes = $this->app->handle($this->makeJsonRequest('GET', '/api/v1/user/profile/avatar', null, $this->receptionistUser));
            $this->assertSame(404, $afterDelRes->getStatusCode());
        } finally {
            @unlink($tmpPng);
            @unlink($tmpSvg);
            @unlink($tmpLarge);
        }
    }
}
