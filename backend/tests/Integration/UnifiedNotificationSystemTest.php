<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Database;
use App\Core\HttpException;
use App\Repositories\NotificationRepository;
use App\Repositories\RealtimeOutboxRepository;
use App\Services\NotificationService;
use App\Services\Notifications\UnifiedNotificationDispatcher;
use App\Services\Realtime\RealtimeConfig;
use App\Services\Realtime\RealtimeOutboxService;
use App\Services\Realtime\RealtimePublisherClient;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Integration & Security Test Suite for the Unified Real-Time Notification System.
 * Validates all 4 roles (ADMIN, RECEPTIONIST, DENTIST, PATIENT), recipient isolation,
 * event v1.0 contract, cursor sync, IDOR protection, outbox retry/outage recovery, and metrics.
 */
class UnifiedNotificationSystemTest extends TestCase
{
    private PDO $pdo;
    private int $adminId;
    private int $receptionistId;
    private int $dentist1UserId;
    private int $dentist2UserId;
    private int $dentist1ProfileId;
    private int $dentist2ProfileId;
    private int $patient1UserId;
    private int $patient2UserId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->pdo = TestDb::create();

        $this->adminId = $this->insertUser('admin@toothcare.test', 'ADMIN', 'Clinic', 'Admin');
        $this->receptionistId = $this->insertUser('frontdesk@toothcare.test', 'RECEPTIONIST', 'Front', 'Desk');
        $this->dentist1UserId = $this->insertUser('dr.one@toothcare.test', 'DENTIST', 'Ana', 'Cruz');
        $this->dentist2UserId = $this->insertUser('dr.two@toothcare.test', 'DENTIST', 'Marco', 'Reyes');
        $this->patient1UserId = $this->insertUser('pat1@toothcare.test', 'PATIENT', 'Elena', 'Santos');
        $this->patient2UserId = $this->insertUser('pat2@toothcare.test', 'PATIENT', 'Carlos', 'Diaz');

        $this->dentist1ProfileId = $this->insertDentist($this->dentist1UserId, 'Ana', 'Cruz');
        $this->dentist2ProfileId = $this->insertDentist($this->dentist2UserId, 'Marco', 'Reyes');
    }

    private function insertUser(string $email, string $role, string $first, string $last): int
    {
        $stmt = $this->pdo->prepare('
            INSERT INTO users (email, password_hash, role, first_name, last_name, is_active, email_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ');
        $stmt->execute([$email, password_hash('TestPass123!', PASSWORD_DEFAULT), $role, $first, $last]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertDentist(int $userId, string $first, string $last): int
    {
        $stmt = $this->pdo->prepare('
            INSERT INTO dentists (user_id, first_name, last_name, specialization, license_number, phone, is_active, created_at, updated_at)
            VALUES (?, ?, ?, "General Dentistry", ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ');
        $stmt->execute([$userId, $first, $last, 'PRC-' . $userId . '001', '+6391700000' . $userId]);
        return (int) $this->pdo->lastInsertId();
    }

    public function testAppointmentLifecycleResolvesAuthorizedRecipientsAcrossAllFourRoles(): void
    {
        $dispatcher = new UnifiedNotificationDispatcher(Database::getInstance());

        $appt = [
            'id' => 501,
            'service_name' => 'Dental Prophylaxis',
            'start_at' => '2026-12-01 10:00:00',
            'patient_user_id' => $this->patient1UserId,
            'dentist_user_id' => $this->dentist1UserId,
        ];

        // Scenario 1: Patient requests appointment -> Patient1, Dentist1, Receptionist, Admin notified; Patient2 & Dentist2 excluded!
        $dispatcher->dispatchAppointmentEvent(
            RealtimeOutboxService::EVENT_APPOINTMENT_REQUESTED,
            $appt,
            'PENDING',
            $this->pdo,
            'PATIENT',
            $this->patient1UserId
        );

        $recipients = array_map(
            'intval',
            $this->pdo->query("SELECT recipient_user_id FROM realtime_outbox WHERE event_type = 'appointment.requested'")->fetchAll(PDO::FETCH_COLUMN)
        );
        sort($recipients);
        $expected = [$this->adminId, $this->receptionistId, $this->dentist1UserId, $this->patient1UserId];
        sort($expected);
        $this->assertSame($expected, $recipients);
        $this->assertNotContains($this->patient2UserId, $recipients);
        $this->assertNotContains($this->dentist2UserId, $recipients);

        // Verify v1.0 payload contract has entityType, entityId, eventVersion, and ZERO clinical/PII fields
        $rawPayload = (string) $this->pdo->query("SELECT payload FROM realtime_outbox WHERE event_type = 'appointment.requested' LIMIT 1")->fetchColumn();
        $payload = json_decode($rawPayload, true);
        $this->assertSame('1.0', $payload['eventVersion']);
        $this->assertSame('appointments', $payload['entityType']);
        $this->assertSame(501, $payload['entityId']);
        $this->assertSame(501, $payload['appointmentId']);
        $this->assertArrayNotHasKey('diagnosis', $payload);
        $this->assertArrayNotHasKey('email', $payload);

        // Scenario 2: Receptionist confirms -> Patient1, Dentist1, Admin get persisted notification; actor Receptionist gets sync-only (notificationId null)
        $dispatcher->dispatchAppointmentEvent(
            RealtimeOutboxService::EVENT_APPOINTMENT_CONFIRMED,
            $appt,
            'CONFIRMED',
            $this->pdo,
            'RECEPTIONIST',
            $this->receptionistId
        );

        $actorOutbox = $this->pdo->prepare("SELECT notification_id FROM realtime_outbox WHERE event_type = 'appointment.confirmed' AND recipient_user_id = ?");
        $actorOutbox->execute([$this->receptionistId]);
        $this->assertNull($actorOutbox->fetchColumn());

        $patientOutbox = $this->pdo->prepare("SELECT notification_id FROM realtime_outbox WHERE event_type = 'appointment.confirmed' AND recipient_user_id = ?");
        $patientOutbox->execute([$this->patient1UserId]);
        $this->assertGreaterThan(0, (int) $patientOutbox->fetchColumn());
    }

    public function testRoleScopedDomainEventsRespectBoundaries(): void
    {
        $dispatcher = new UnifiedNotificationDispatcher(Database::getInstance());

        // schedule.updated -> Dentist1 + Receptionist + Admin only (NOT Dentist2, NOT Patients)
        $dispatcher->dispatchScheduleUpdated($this->dentist1ProfileId, 77, 'Shift updated', 'updated', $this->adminId, $this->pdo);
        $schedRecipients = array_map(
            'intval',
            $this->pdo->query("SELECT recipient_user_id FROM realtime_outbox WHERE event_type = 'schedule.updated'")->fetchAll(PDO::FETCH_COLUMN)
        );
        $this->assertContains($this->dentist1UserId, $schedRecipients);
        $this->assertContains($this->receptionistId, $schedRecipients);
        $this->assertContains($this->adminId, $schedRecipients);
        $this->assertNotContains($this->dentist2UserId, $schedRecipients);
        $this->assertNotContains($this->patient1UserId, $schedRecipients);

        // service.updated -> Admin + Receptionist only (NOT Dentists, NOT Patients)
        $dispatcher->dispatchServiceUpdated(12, 'Root Canal', 'UPDATED', $this->adminId, $this->pdo);
        $svcRecipients = array_map(
            'intval',
            $this->pdo->query("SELECT recipient_user_id FROM realtime_outbox WHERE event_type = 'service.updated'")->fetchAll(PDO::FETCH_COLUMN)
        );
        $this->assertContains($this->adminId, $svcRecipients);
        $this->assertContains($this->receptionistId, $svcRecipients);
        $this->assertNotContains($this->dentist1UserId, $svcRecipients);
        $this->assertNotContains($this->patient1UserId, $svcRecipients);

        // account.created -> Admin only (NOT Receptionist, NOT Dentists, NOT Patients)
        $dispatcher->dispatchAccountEvent(
            RealtimeOutboxService::EVENT_ACCOUNT_CREATED,
            $this->patient2UserId,
            'PATIENT',
            'New Patient Registered',
            'A new patient registered.',
            'created',
            $this->patient2UserId,
            false,
            $this->pdo
        );
        $acctRecipients = array_map(
            'intval',
            $this->pdo->query("SELECT recipient_user_id FROM realtime_outbox WHERE event_type = 'account.created'")->fetchAll(PDO::FETCH_COLUMN)
        );
        $this->assertSame([$this->adminId], $acctRecipients);
    }

    public function testCursorSyncAndStrictIdorOwnershipProtection(): void
    {
        $service = new NotificationService(new NotificationRepository(Database::getInstance()));

        $n1 = $service->createNotification($this->patient1UserId, 'PATIENT', 'APPOINTMENT_REQUESTED', 'First', 'Body 1', 'appointments', 10);
        $n2 = $service->createNotification($this->patient1UserId, 'PATIENT', 'APPOINTMENT_CONFIRMED', 'Second', 'Body 2', 'appointments', 10);
        $nOther = $service->createNotification($this->patient2UserId, 'PATIENT', 'APPOINTMENT_CONFIRMED', 'Private', 'Other patient', 'appointments', 11);

        // Cursor sync after n1 returns ONLY n2 for patient1 (never patient2's nOther!)
        $sync = $service->syncUserNotifications($this->patient1UserId, ['after_id' => $n1]);
        $this->assertCount(1, $sync['items']);
        $this->assertSame($n2, (int) $sync['items'][0]['id']);
        $this->assertSame(2, $sync['unread_count']);
        $this->assertSame($n2, $sync['latest_id']);

        // Single notification retrieval works for owner
        $mine = $service->getNotificationById($this->patient1UserId, $n2);
        $this->assertSame('Second', $mine['title']);

        // Cross-user IDOR attempt MUST throw 403 Forbidden
        try {
            $service->getNotificationById($this->patient1UserId, $nOther);
            $this->fail('Expected 403 Forbidden for cross-user notification access.');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }
    }

    public function testOutboxRecoversAfterSocketOutageAndSuppressesDuplicateEventIds(): void
    {
        $outboxRepo = new RealtimeOutboxRepository(Database::getInstance());
        $config = new RealtimeConfig(
            true,
            'http://realtime:4000',
            str_repeat('s', 40),
            60,
            2.0,
            300,
            25,
            3,
            1000,
            120,
            '/socket.io/'
        );

        // Duplicate eventId insertion is idempotent (second returns 0, only 1 row stored)
        $outboxServiceFail = new RealtimeOutboxService(
            $outboxRepo,
            new RealtimePublisherClient($config, null, null, static fn () => ['status' => 503, 'body' => '', 'error' => 'Socket.IO down']),
            $config
        );

        $id1 = $outboxServiceFail->enqueue(RealtimeOutboxService::EVENT_APPOINTMENT_CONFIRMED, $this->patient1UserId, null, [
            'eventId' => 'evt-idempotent-key-001',
            'appointmentId' => 900,
            'status' => 'confirmed',
        ]);
        $id2 = $outboxServiceFail->enqueue(RealtimeOutboxService::EVENT_APPOINTMENT_CONFIRMED, $this->patient1UserId, null, [
            'eventId' => 'evt-idempotent-key-001',
            'appointmentId' => 900,
            'status' => 'confirmed',
        ]);
        $this->assertGreaterThan(0, $id1);
        $this->assertSame(0, $id2);

        // First attempt during Socket.IO outage -> FAILED_RETRYABLE
        $now = time() + 1;
        $res1 = $outboxServiceFail->processPendingBatch('w-1', 10, $now);
        $this->assertSame(1, $res1['retried']);
        $this->assertSame(0, $res1['published']);

        // Socket.IO recovers -> second attempt after backoff publishes cleanly
        $outboxServiceOk = new RealtimeOutboxService(
            $outboxRepo,
            new RealtimePublisherClient($config, null, null, static fn () => ['status' => 200, 'body' => '{"ok":true,"delivered":true,"duplicate":false}']),
            $config
        );
        $res2 = $outboxServiceOk->processPendingBatch('w-1', 10, $now + 60);
        $this->assertSame(1, $res2['published']);

        $metrics = (new NotificationRepository(Database::getInstance()))->aggregateMetrics();
        $this->assertArrayHasKey('by_type', $metrics);
        $this->assertArrayHasKey('unread_total', $metrics);
    }
}
