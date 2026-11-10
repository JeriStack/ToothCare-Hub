<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Request;
use App\Repositories\NotificationRepository;
use App\Repositories\UserRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Integration API Test Suite for In-App Notifications
 * Validates endpoint authentication, unread counting, pagination, and IDOR protection.
 */
class NotificationApiTest extends TestCase
{
    private Application $app;
    private UserRepository $userRepo;
    private NotificationRepository $notificationRepo;

    private array $patientUser1;
    private array $patientUser2;

    protected function setUp(): void
    {
        $_SESSION = [];
        TestDb::create();
        $this->app = new Application(null, false);

        $this->userRepo = new UserRepository();
        $this->notificationRepo = new NotificationRepository();

        $u1 = $this->userRepo->create(
            'patient.notif1@example.com',
            password_hash('Pass123!', PASSWORD_BCRYPT),
            'PATIENT',
            1,
            1
        );
        $this->patientUser1 = $this->userRepo->findById($u1);

        $u2 = $this->userRepo->create(
            'patient.notif2@example.com',
            password_hash('Pass123!', PASSWORD_BCRYPT),
            'PATIENT',
            1,
            1
        );
        $this->patientUser2 = $this->userRepo->findById($u2);
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

    public function testNotificationsListRequiresAuthentication(): void
    {
        $req = $this->makeJsonRequest('GET', '/api/v1/notifications');
        $res = $this->app->handle($req);

        $this->assertSame(401, $res->getStatusCode());
    }

    public function testPatientReceivesOnlyTheirOwnNotifications(): void
    {
        $this->notificationRepo->create([
            'user_id' => (int) $this->patientUser1['id'],
            'role' => 'PATIENT',
            'type' => 'APPOINTMENT_REQUESTED',
            'title' => 'Request Received',
            'message' => 'Your appointment request is pending review.',
        ]);

        $this->notificationRepo->create([
            'user_id' => (int) $this->patientUser2['id'],
            'role' => 'PATIENT',
            'type' => 'APPOINTMENT_CONFIRMED',
            'title' => 'Confirmed',
            'message' => 'Appointment is confirmed.',
        ]);

        // Request as Patient 1
        $req1 = $this->makeJsonRequest('GET', '/api/v1/notifications', null, $this->patientUser1);
        $res1 = $this->app->handle($req1);
        if ($res1->getStatusCode() !== 200) {
            echo "\nError Body: " . $res1->getBody() . "\n";
        }
        $data1 = json_decode($res1->getBody(), true);

        $this->assertSame(200, $res1->getStatusCode());
        $this->assertSame(1, $data1['data']['total']);
        $this->assertCount(1, $data1['data']['items']);
        $this->assertSame('Request Received', $data1['data']['items'][0]['title']);

        // Request as Patient 2
        $req2 = $this->makeJsonRequest('GET', '/api/v1/notifications', null, $this->patientUser2);
        $res2 = $this->app->handle($req2);
        $data2 = json_decode($res2->getBody(), true);

        $this->assertSame(200, $res2->getStatusCode());
        $this->assertSame(1, $data2['data']['total']);
        $this->assertSame('Confirmed', $data2['data']['items'][0]['title']);
    }

    public function testUnreadCountEndpoint(): void
    {
        $req = $this->makeJsonRequest('GET', '/api/v1/notifications/unread-count', null, $this->patientUser1);
        $res = $this->app->handle($req);
        $data = json_decode($res->getBody(), true);

        $this->assertSame(200, $res->getStatusCode());
        $this->assertSame(0, $data['data']['unread_count']);

        // Add 2 notifications
        $this->notificationRepo->create([
            'user_id' => (int) $this->patientUser1['id'],
            'role' => 'PATIENT',
            'type' => 'REMINDER',
            'title' => 'Reminder 1',
            'message' => 'Brush teeth',
        ]);
        $this->notificationRepo->create([
            'user_id' => (int) $this->patientUser1['id'],
            'role' => 'PATIENT',
            'type' => 'REMINDER',
            'title' => 'Reminder 2',
            'message' => 'Floss teeth',
        ]);

        $res2 = $this->app->handle($req);
        $data2 = json_decode($res2->getBody(), true);
        $this->assertSame(2, $data2['data']['unread_count']);
    }

    public function testMarkAsReadEnforcesOwnershipAndRejectsIdor(): void
    {
        // Notification created for Patient 1
        $notifId = $this->notificationRepo->create([
            'user_id' => (int) $this->patientUser1['id'],
            'role' => 'PATIENT',
            'type' => 'SECURE_ALERT',
            'title' => 'Private Alert',
            'message' => 'Sensitive medical notification',
        ]);

        // Patient 2 attempts to mark Patient 1's notification as read (IDOR attack)
        $maliciousReq = $this->makeJsonRequest(
            'PATCH',
            "/api/v1/notifications/{$notifId}/read",
            null,
            $this->patientUser2
        );
        $maliciousRes = $this->app->handle($maliciousReq);

        $this->assertSame(403, $maliciousRes->getStatusCode());

        // Legitimate Patient 1 marks it as read
        $legitReq = $this->makeJsonRequest(
            'PATCH',
            "/api/v1/notifications/{$notifId}/read",
            null,
            $this->patientUser1
        );
        $legitRes = $this->app->handle($legitReq);

        $this->assertSame(200, $legitRes->getStatusCode());
        $legitData = json_decode($legitRes->getBody(), true);
        $this->assertNotNull($legitData['data']['notification']['read_at']);
    }

    public function testMarkAllAsReadEndpoint(): void
    {
        for ($i = 1; $i <= 3; $i++) {
            $this->notificationRepo->create([
                'user_id' => (int) $this->patientUser1['id'],
                'role' => 'PATIENT',
                'type' => 'BATCH_NOTIF',
                'title' => "Notification #{$i}",
                'message' => "Message body #{$i}",
            ]);
        }

        $req = $this->makeJsonRequest('POST', '/api/v1/notifications/read-all', null, $this->patientUser1);
        $res = $this->app->handle($req);
        $data = json_decode($res->getBody(), true);

        $this->assertSame(200, $res->getStatusCode());
        $this->assertSame(3, $data['data']['updated_count']);

        // Verify unread count is now 0
        $unreadReq = $this->makeJsonRequest('GET', '/api/v1/notifications/unread-count', null, $this->patientUser1);
        $unreadData = json_decode($this->app->handle($unreadReq)->getBody(), true);
        $this->assertSame(0, $unreadData['data']['unread_count']);
    }
}
