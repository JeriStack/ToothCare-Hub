<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Database;
use App\Core\HttpException;
use App\Repositories\NotificationRepository;
use App\Services\NotificationService;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Unit Test Suite for NotificationService
 * Verifies notification creation, paginated listing, unread count calculation,
 * and strict user-ownership enforcement.
 */
class NotificationServiceTest extends TestCase
{
    private NotificationRepository $repo;
    private NotificationService $service;

    protected function setUp(): void
    {
        $pdo = TestDb::create();
        $db = new Database();
        $db->setConnection($pdo);
        $this->repo = new NotificationRepository($db);
        $this->service = new NotificationService($this->repo);
    }

    public function testCreateNotificationStoresRecordInDatabase(): void
    {
        $notifId = $this->service->createNotification(
            userId: 10,
            role: 'PATIENT',
            type: 'APPOINTMENT_CONFIRMED',
            title: 'Appointment Confirmed',
            message: 'Your dental cleaning appointment has been approved.',
            referenceType: 'appointments',
            referenceId: 101
        );

        $this->assertGreaterThan(0, $notifId);

        $found = $this->repo->findById($notifId);
        $this->assertNotNull($found);
        $this->assertSame(10, (int) $found['user_id']);
        $this->assertSame('PATIENT', $found['role']);
        $this->assertSame('APPOINTMENT_CONFIRMED', $found['type']);
        $this->assertSame('Appointment Confirmed', $found['title']);
        $this->assertNull($found['read_at']);
    }

    public function testGetUserNotificationsReturnsOnlyOwnedRecords(): void
    {
        // Create 2 notifications for User 10, 1 for User 20
        $this->service->createNotification(10, 'PATIENT', 'TYPE_A', 'Title A', 'Message A');
        $this->service->createNotification(10, 'PATIENT', 'TYPE_B', 'Title B', 'Message B');
        $this->service->createNotification(20, 'PATIENT', 'TYPE_C', 'Title C', 'Message C');

        $resultUser10 = $this->service->getUserNotifications(10);
        $this->assertSame(2, $resultUser10['total']);
        $this->assertCount(2, $resultUser10['items']);
        $this->assertSame(2, $resultUser10['unread_count']);

        $resultUser20 = $this->service->getUserNotifications(20);
        $this->assertSame(1, $resultUser20['total']);
        $this->assertCount(1, $resultUser20['items']);
    }

    public function testGetUnreadCountCalculatesCorrectly(): void
    {
        $this->assertSame(0, $this->service->getUnreadCount(15));

        $id1 = $this->service->createNotification(15, 'PATIENT', 'TYPE_1', 'Title 1', 'Msg 1');
        $this->service->createNotification(15, 'PATIENT', 'TYPE_2', 'Title 2', 'Msg 2');

        $this->assertSame(2, $this->service->getUnreadCount(15));

        // Mark 1 as read
        $this->service->markAsRead(15, $id1);
        $this->assertSame(1, $this->service->getUnreadCount(15));
    }

    public function testMarkAsReadRejectsUnauthorizedUser(): void
    {
        // Created for User 10
        $notifId = $this->service->createNotification(10, 'PATIENT', 'ALERT', 'Alert Title', 'Alert message');

        // User 20 attempts to mark User 10's notification as read
        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('You do not have permission to access this notification.');

        $this->service->markAsRead(userId: 20, notificationId: $notifId);
    }

    public function testMarkAllAsReadUpdatesAllUnreadForUser(): void
    {
        $this->service->createNotification(30, 'PATIENT', 'ALERT_1', 'T1', 'M1');
        $this->service->createNotification(30, 'PATIENT', 'ALERT_2', 'T2', 'M2');
        $this->service->createNotification(30, 'PATIENT', 'ALERT_3', 'T3', 'M3');

        $this->assertSame(3, $this->service->getUnreadCount(30));

        $res = $this->service->markAllAsRead(30);
        $this->assertTrue($res['success']);
        $this->assertSame(3, $res['updated_count']);
        $this->assertSame(0, $this->service->getUnreadCount(30));
    }
}
