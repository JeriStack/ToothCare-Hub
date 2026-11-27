<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Database;
use App\Core\Request;
use App\Repositories\DentistRepository;
use App\Repositories\PatientRepository;
use App\Repositories\UserRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Integration API Test Suite for Patient-Dentist Direct Messaging
 * Covers RBAC/privacy isolation, IDOR protection, cursor pagination, idempotency,
 * delivery/read receipts, validation, and archived/inactive retention handling.
 */
class MessagingApiTest extends TestCase
{
    private Application $app;
    private UserRepository $userRepo;
    private PatientRepository $patientRepo;
    private DentistRepository $dentistRepo;

    private array $patientUser1;
    private int $patientId1;
    private array $patientUser2;
    private int $patientId2;
    private array $dentistUser;
    private int $dentistId;
    private array $adminUser;
    private array $receptionistUser;

    protected function setUp(): void
    {
        $_SESSION = [];
        TestDb::create();
        $this->app = new Application(null, false);

        $this->userRepo = new UserRepository();
        $this->patientRepo = new PatientRepository();
        $this->dentistRepo = new DentistRepository();

        $p1Uid = $this->userRepo->create('chat.pat1@example.com', password_hash('Pass123!', PASSWORD_BCRYPT), 'PATIENT', 1, 1);
        $this->patientUser1 = $this->userRepo->findById($p1Uid);
        $this->patientId1 = $this->patientRepo->create([
            'user_id' => $p1Uid,
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'date_of_birth' => '1994-05-12',
            'phone' => '09171234501',
            'gender' => 'FEMALE',
        ]);

        $p2Uid = $this->userRepo->create('chat.pat2@example.com', password_hash('Pass123!', PASSWORD_BCRYPT), 'PATIENT', 1, 1);
        $this->patientUser2 = $this->userRepo->findById($p2Uid);
        $this->patientId2 = $this->patientRepo->create([
            'user_id' => $p2Uid,
            'first_name' => 'Carlos',
            'last_name' => 'Reyes',
            'date_of_birth' => '1991-09-20',
            'phone' => '09171234502',
            'gender' => 'MALE',
        ]);

        $dUid = $this->userRepo->create('chat.dentist@example.com', password_hash('Pass123!', PASSWORD_BCRYPT), 'DENTIST', 1, 1);
        $this->dentistUser = $this->userRepo->findById($dUid);
        $this->dentistId = $this->dentistRepo->create([
            'user_id' => $dUid,
            'first_name' => 'Elena',
            'last_name' => 'Cruz',
            'specialization' => 'Orthodontics',
            'license_number' => 'PRC-CHAT-001',
            'phone' => '09171234503',
            'is_active' => 1,
        ]);

        $adminUid = $this->userRepo->create('chat.admin@example.com', password_hash('Pass123!', PASSWORD_BCRYPT), 'ADMIN', 1, 1);
        $this->adminUser = $this->userRepo->findById($adminUid);

        $recUid = $this->userRepo->create('chat.rec@example.com', password_hash('Pass123!', PASSWORD_BCRYPT), 'RECEPTIONIST', 1, 1);
        $this->receptionistUser = $this->userRepo->findById($recUid);
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

    public function testMessagingRequiresAuthAndBlocksUnauthorizedRoles(): void
    {
        $unauth = $this->app->handle($this->makeJsonRequest('GET', '/api/v1/messages/conversations'));
        $this->assertSame(401, $unauth->getStatusCode());

        $adminRes = $this->app->handle($this->makeJsonRequest('GET', '/api/v1/messages/conversations', null, $this->adminUser));
        $this->assertSame(403, $adminRes->getStatusCode());

        $recRes = $this->app->handle($this->makeJsonRequest('GET', '/api/v1/messages/conversations', null, $this->receptionistUser));
        $this->assertSame(403, $recRes->getStatusCode());
    }

    public function testFullPatientDentistMessagingLifecycleIdempotencyPaginationAndIdor(): void
    {
        // 1. Patient starts conversation with Dentist
        $startRes = $this->app->handle($this->makeJsonRequest(
            'POST',
            '/api/v1/messages/conversations',
            ['dentist_id' => $this->dentistId],
            $this->patientUser1
        ));
        $this->assertSame(201, $startRes->getStatusCode());
        $convId = (int) $startRes->getData()['conversation']['id'];
        $this->assertGreaterThan(0, $convId);

        // 2. Send 3 messages from Patient (including idempotent retry on message 1)
        $send1 = $this->app->handle($this->makeJsonRequest(
            'POST',
            "/api/v1/messages/conversations/{$convId}/messages",
            ['body' => 'Hello Dr. Cruz, quick question before my visit.', 'client_message_id' => 'client-uuid-1'],
            $this->patientUser1
        ));
        $this->assertSame(201, $send1->getStatusCode());
        $msg1Id = (int) $send1->getData()['message']['id'];
        $this->assertFalse($send1->getData()['duplicate']);

        // Idempotent duplicate send returns exact same message without duplicating
        $send1Dup = $this->app->handle($this->makeJsonRequest(
            'POST',
            "/api/v1/messages/conversations/{$convId}/messages",
            ['body' => 'Hello Dr. Cruz, quick question before my visit.', 'client_message_id' => 'client-uuid-1'],
            $this->patientUser1
        ));
        $this->assertSame(201, $send1Dup->getStatusCode());
        $this->assertTrue($send1Dup->getData()['duplicate']);
        $this->assertSame($msg1Id, (int) $send1Dup->getData()['message']['id']);

        $this->app->handle($this->makeJsonRequest(
            'POST',
            "/api/v1/messages/conversations/{$convId}/messages",
            ['body' => 'Should I avoid coffee before cleaning?', 'client_message_id' => 'client-uuid-2'],
            $this->patientUser1
        ));
        $this->app->handle($this->makeJsonRequest(
            'POST',
            "/api/v1/messages/conversations/{$convId}/messages",
            ['body' => 'Thanks in advance!', 'client_message_id' => 'client-uuid-3'],
            $this->patientUser1
        ));

        // 3. Dentist unread count equals 3
        $unreadRes = $this->app->handle($this->makeJsonRequest('GET', '/api/v1/messages/unread-count', null, $this->dentistUser));
        $this->assertSame(200, $unreadRes->getStatusCode());
        $this->assertSame(3, $unreadRes->getData()['unread_count']);

        // 4. Cursor pagination: limit=2 returns latest 2 messages + has_more=true + next_before_id
        $page1 = $this->app->handle($this->makeJsonRequest(
            'GET',
            "/api/v1/messages/conversations/{$convId}/messages?limit=2",
            null,
            $this->dentistUser
        ));
        $this->assertSame(200, $page1->getStatusCode());
        $this->assertCount(2, $page1->getData()['messages']);
        $this->assertTrue($page1->getData()['pagination']['has_more']);
        $nextBeforeId = (int) $page1->getData()['pagination']['next_before_id'];
        $this->assertGreaterThan(0, $nextBeforeId);

        // Fetching older page with before_id returns the oldest 1 message + has_more=false
        $page2 = $this->app->handle($this->makeJsonRequest(
            'GET',
            "/api/v1/messages/conversations/{$convId}/messages?limit=2&before_id={$nextBeforeId}",
            null,
            $this->dentistUser
        ));
        $this->assertSame(200, $page2->getStatusCode());
        $this->assertCount(1, $page2->getData()['messages']);
        $this->assertFalse($page2->getData()['pagination']['has_more']);
        $this->assertSame($msg1Id, (int) $page2->getData()['messages'][0]['id']);

        // 5. Dentist marks conversation read -> unread becomes 0 and patient sees 'read' receipt
        $readRes = $this->app->handle($this->makeJsonRequest('POST', "/api/v1/messages/conversations/{$convId}/read", [], $this->dentistUser));
        $this->assertSame(200, $readRes->getStatusCode());
        $this->assertSame(0, $readRes->getData()['total_unread_count']);

        $patientView = $this->app->handle($this->makeJsonRequest('GET', "/api/v1/messages/conversations/{$convId}/messages", null, $this->patientUser1));
        $this->assertSame('read', $patientView->getData()['messages'][0]['delivery_status']);

        // 6. IDOR check: Another patient CANNOT read or send in this conversation
        $idorRead = $this->app->handle($this->makeJsonRequest('GET', "/api/v1/messages/conversations/{$convId}/messages", null, $this->patientUser2));
        $this->assertSame(403, $idorRead->getStatusCode());

        $idorSend = $this->app->handle($this->makeJsonRequest(
            'POST',
            "/api/v1/messages/conversations/{$convId}/messages",
            ['body' => 'Unauthorized snooping'],
            $this->patientUser2
        ));
        $this->assertSame(403, $idorSend->getStatusCode());

        // 7. Validation: empty and >2000 character messages rejected
        $emptyRes = $this->app->handle($this->makeJsonRequest(
            'POST',
            "/api/v1/messages/conversations/{$convId}/messages",
            ['body' => '   '],
            $this->patientUser1
        ));
        $this->assertSame(422, $emptyRes->getStatusCode());

        $tooLongRes = $this->app->handle($this->makeJsonRequest(
            'POST',
            "/api/v1/messages/conversations/{$convId}/messages",
            ['body' => str_repeat('A', 2001)],
            $this->patientUser1
        ));
        $this->assertSame(422, $tooLongRes->getStatusCode());
    }

    public function testDeactivatedCounterpartPreservesHistoryReadOnlyAndBlocksNewMessages(): void
    {
        $startRes = $this->app->handle($this->makeJsonRequest(
            'POST',
            '/api/v1/messages/conversations',
            ['dentist_id' => $this->dentistId],
            $this->patientUser1
        ));
        $convId = (int) $startRes->getData()['conversation']['id'];

        $this->app->handle($this->makeJsonRequest(
            'POST',
            "/api/v1/messages/conversations/{$convId}/messages",
            ['body' => 'Preserved historical message'],
            $this->patientUser1
        ));

        // Deactivate the dentist account
        $pdo = Database::getInstance()->getConnection();
        $pdo->prepare('UPDATE users SET is_active = 0 WHERE id = ?')->execute([(int) $this->dentistUser['id']]);

        // Patient can still read preserved historical messages, with conversation marked unavailable
        $historyRes = $this->app->handle($this->makeJsonRequest(
            'GET',
            "/api/v1/messages/conversations/{$convId}/messages",
            null,
            $this->patientUser1
        ));
        $this->assertSame(200, $historyRes->getStatusCode());
        $this->assertFalse($historyRes->getData()['conversation']['is_available']);
        $this->assertCount(1, $historyRes->getData()['messages']);

        // Sending new messages to unavailable conversation is blocked with 409
        $blockedSend = $this->app->handle($this->makeJsonRequest(
            'POST',
            "/api/v1/messages/conversations/{$convId}/messages",
            ['body' => 'Should be blocked'],
            $this->patientUser1
        ));
        $this->assertSame(409, $blockedSend->getStatusCode());
    }

    public function testMultiWordFullNameSearchAndHonorificHandling(): void
    {
        $startRes = $this->app->handle($this->makeJsonRequest(
            'POST',
            '/api/v1/messages/conversations',
            ['dentist_id' => $this->dentistId],
            $this->patientUser1
        ));
        $this->assertSame(201, $startRes->getStatusCode());

        // Patient searches by full name with honorific ("Dr. Elena Cruz")
        $res1 = $this->app->handle($this->makeJsonRequest(
            'GET',
            '/api/v1/messages/conversations?search=' . urlencode('Dr. Elena Cruz'),
            null,
            $this->patientUser1
        ));
        $this->assertSame(200, $res1->getStatusCode());
        $this->assertCount(1, $res1->getData()['conversations']);

        // Dentist searches by patient full name ("Maria Santos")
        $res2 = $this->app->handle($this->makeJsonRequest(
            'GET',
            '/api/v1/messages/conversations?search=' . urlencode('Maria Santos'),
            null,
            $this->dentistUser
        ));
        $this->assertSame(200, $res2->getStatusCode());
        $this->assertCount(1, $res2->getData()['conversations']);

        // Non-matching query returns empty list
        $res3 = $this->app->handle($this->makeJsonRequest(
            'GET',
            '/api/v1/messages/conversations?search=' . urlencode('Nonexistent Person'),
            null,
            $this->patientUser1
        ));
        $this->assertSame(200, $res3->getStatusCode());
        $this->assertCount(0, $res3->getData()['conversations']);
    }
}
