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
    }
}
