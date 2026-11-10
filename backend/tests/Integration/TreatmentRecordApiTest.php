<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Request;
use App\Repositories\AppointmentRepository;
use App\Repositories\DentistRepository;
use App\Repositories\PatientRepository;
use App\Repositories\ServiceRepository;
use App\Repositories\TreatmentRecordRepository;
use App\Repositories\UserRepository;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Integration Test for Treatment Record API & Clinical Documentation.
 * Tests FDI tooth notations, 24-hour compliance locking, and clinical ownership rules.
 */
class TreatmentRecordApiTest extends TestCase
{
    private Application $app;
    private PDO $pdo;
    private UserRepository $userRepo;
    private DentistRepository $dentistRepo;
    private PatientRepository $patientRepo;
    private ServiceRepository $serviceRepo;
    private AppointmentRepository $appointmentRepo;
    private TreatmentRecordRepository $treatmentRepo;

    private array $dentistUserA;
    private int $dentistAId;
    private array $dentistUserB;
    private int $dentistBId;
    private array $patientUser;
    private int $patientId;
    private int $serviceId;
    private int $confirmedAppointmentId;

    protected function setUp(): void
    {
        $_SESSION = [];
        $this->pdo = TestDb::create();
        $this->app = new Application(null, false);

        $this->userRepo = new UserRepository();
        $this->dentistRepo = new DentistRepository();
        $this->patientRepo = new PatientRepository();
        $this->serviceRepo = new ServiceRepository();
        $this->appointmentRepo = new AppointmentRepository();
        $this->treatmentRepo = new TreatmentRecordRepository();

        // 1. Attending Dentist (Dentist A)
        $uA = $this->userRepo->create(
            'dr.santos@toothcare.local',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'DENTIST',
            1,
            1
        );
        $this->dentistUserA = $this->userRepo->findById($uA);
        $this->dentistAId = $this->dentistRepo->create([
            'user_id' => $uA,
            'license_number' => 'PRC-0042189',
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'specialization' => 'General & Cosmetic Dentistry',
            'phone' => '+639171112222',
            'default_operatory_chair' => 'Chair 1',
            'is_active' => 1,
        ]);

        // 2. Secondary Dentist (Dentist B)
        $uB = $this->userRepo->create(
            'dr.reyes@toothcare.local',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'DENTIST',
            1,
            1
        );
        $this->dentistUserB = $this->userRepo->findById($uB);
        $this->dentistBId = $this->dentistRepo->create([
            'user_id' => $uB,
            'license_number' => 'PRC-0051280',
            'first_name' => 'Roberto',
            'last_name' => 'Reyes',
            'specialization' => 'Orthodontics',
            'phone' => '+639173334444',
            'default_operatory_chair' => 'Chair 2',
            'is_active' => 1,
        ]);

        // 3. Patient
        $pUser = $this->userRepo->create(
            'patient.juan@example.com',
            password_hash('Password123!', PASSWORD_BCRYPT),
            'PATIENT',
            1,
            1
        );
        $this->patientUser = $this->userRepo->findById($pUser);
        $this->patientId = $this->patientRepo->create([
            'user_id' => $pUser,
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'date_of_birth' => '1990-05-12',
            'phone' => '+639178889999',
            'gender' => 'MALE',
            'address' => 'Manila',
            'medical_alerts' => 'Penicillin allergy',
        ]);

        // 4. Service
        $this->serviceId = $this->serviceRepo->create([
            'name' => 'Direct Composite Restoration',
            'category' => 'Restorative Dentistry',
            'price' => 2500.00,
            'duration_minutes' => 60,
            'is_active' => 1,
        ]);

        // 5. Confirmed Appointment assigned to Dentist A
        $this->confirmedAppointmentId = $this->appointmentRepo->create([
            'patient_id' => $this->patientId,
            'dentist_id' => $this->dentistAId,
            'service_id' => $this->serviceId,
            'start_at' => '2026-11-20 14:00:00',
            'end_at' => '2026-11-20 15:00:00',
            'duration_snapshot' => 60,
            'price_snapshot' => 2500.00,
            'status' => 'CONFIRMED',
            'chief_complaint' => 'Cavity on upper right molar',
            'operatory_chair' => 'Chair 1',
        ]);
    }

    private function makeJsonRequest(string $method, string $path, ?array $body = null, ?array $user = null): Request
    {
        $headers = [];
        $rawBody = '';
        if ($body !== null) {
            $headers['content-type'] = 'application/json';
            $rawBody = json_encode($body);
        }
        $req = Request::create($method, $path, $headers, $rawBody);
        if ($user !== null) {
            $req->setUser($user);
        }
        return $req;
    }

    public function testCreateTreatmentRecordWithFdiTeethArray(): int
    {
        $payload = [
            'appointment_id' => $this->confirmedAppointmentId,
            'teeth_treated' => [14, 16],
            'diagnosis' => 'Moderate Class II dental caries on distal surface of tooth 14 and occlusal surface of tooth 16.',
            'procedure_notes' => 'Infiltration anesthesia administered. Caries excavation performed under high-speed water cooling. Etched with 37% phosphoric acid, bonded with Scotchbond, incrementally restored with composite A2 shade. Light cured and polished.',
            'prescription_notes' => 'Mefenamic acid 500mg tid prn for post-op discomfort.',
            'home_care_advice' => 'Avoid very cold or hard food for the next 24 hours. Practice meticulous flossing.',
        ];

        $req = $this->makeJsonRequest('POST', '/api/v1/treatment-records', $payload, $this->dentistUserA);
        $res = $this->app->handle($req);

        $this->assertSame(201, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNull($data['error']);
        $record = $data['data'];
        $this->assertNotNull($record['id']);
        $this->assertSame([14, 16], $record['teeth_treated']);
        $this->assertSame($this->confirmedAppointmentId, (int) $record['appointment_id']);
        $this->assertSame($this->dentistAId, (int) $record['dentist_id']);
        $this->assertFalse($record['is_locked']);

        return (int) $record['id'];
    }

    public function testDentistCannotCreateTreatmentRecordForOtherDentistAppointment(): void
    {
        $payload = [
            'appointment_id' => $this->confirmedAppointmentId,
            'teeth_treated' => [14],
            'diagnosis' => 'Dental caries',
            'procedure_notes' => 'Restoration performed without authorization',
        ];

        // Dentist B attempts to document Dentist A's appointment
        $req = $this->makeJsonRequest('POST', '/api/v1/treatment-records', $payload, $this->dentistUserB);
        $res = $this->app->handle($req);

        $this->assertSame(403, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNotNull($data['error']);
    }

    public function testPatientCannotCreateTreatmentRecord(): void
    {
        $payload = [
            'appointment_id' => $this->confirmedAppointmentId,
            'teeth_treated' => [14],
            'diagnosis' => 'Patient self diagnosis',
            'procedure_notes' => 'Self treatment attempt',
        ];

        $req = $this->makeJsonRequest('POST', '/api/v1/treatment-records', $payload, $this->patientUser);
        $res = $this->app->handle($req);

        $this->assertSame(403, $res->getStatusCode());
    }

    public function testGetTreatmentRecordByAppointmentId(): void
    {
        $recordId = $this->testCreateTreatmentRecordWithFdiTeethArray();

        $req = $this->makeJsonRequest('GET', "/api/v1/appointments/{$this->confirmedAppointmentId}/treatment-record", null, $this->dentistUserA);
        $res = $this->app->handle($req);

        $this->assertSame(200, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNull($data['error']);
        $this->assertSame($recordId, (int) $data['data']['id']);
        $this->assertSame([14, 16], $data['data']['teeth_treated']);
    }

    public function testPatchTreatmentRecordWithin24Hours(): void
    {
        $recordId = $this->testCreateTreatmentRecordWithFdiTeethArray();

        $patchPayload = [
            'prescription_notes' => 'Amoxicillin 500mg tid x 7 days. Mefenamic acid 500mg prn.',
            'home_care_advice' => 'Warm saline gargles starting tomorrow morning. Call clinic if pain worsens.',
        ];

        $req = $this->makeJsonRequest('PATCH', "/api/v1/treatment-records/{$recordId}", $patchPayload, $this->dentistUserA);
        $res = $this->app->handle($req);

        $this->assertSame(200, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNull($data['error']);
        $this->assertSame($patchPayload['prescription_notes'], $data['data']['prescription_notes']);
        $this->assertSame($patchPayload['home_care_advice'], $data['data']['home_care_advice']);
    }

    public function testPatchTreatmentRecordRejectsWhenLocked(): void
    {
        $recordId = $this->testCreateTreatmentRecordWithFdiTeethArray();

        // Simulate 24-hour window expiration by updating locked_at to past timestamp
        $past = date('Y-m-d H:i:s', time() - 3600);
        $stmt = $this->pdo->prepare('UPDATE treatment_records SET locked_at = ? WHERE id = ?');
        $stmt->execute([$past, $recordId]);

        $patchPayload = [
            'home_care_advice' => 'Attempting to edit an archived clinical record.',
        ];

        $req = $this->makeJsonRequest('PATCH', "/api/v1/treatment-records/{$recordId}", $patchPayload, $this->dentistUserA);
        $res = $this->app->handle($req);

        $this->assertSame(409, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNotNull($data['error']);
        $this->assertSame('RECORD_LOCKED', $data['error']['code']);
    }

    public function testDentistListingTreatmentRecords(): void
    {
        $this->testCreateTreatmentRecordWithFdiTeethArray();

        $req = $this->makeJsonRequest('GET', '/api/v1/treatment-records', null, $this->dentistUserA);
        $res = $this->app->handle($req);

        $this->assertSame(200, $res->getStatusCode());
        $data = json_decode($res->getBody(), true);
        $this->assertNull($data['error']);
        $this->assertArrayHasKey('items', $data['data']);
        $this->assertNotEmpty($data['data']['items']);
        $this->assertSame($this->dentistAId, (int) $data['data']['items'][0]['dentist_id']);
    }
}
