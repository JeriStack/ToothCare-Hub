<?php
declare(strict_types=1);
namespace Tests\Integration;
use App\Controllers\EmailOutboxController;
use App\Core\Application;
use App\Core\Request;
use App\Repositories\UserRepository;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;
/**
 * DRBAC, masking, audit and recovery behavior of the email outbox admin API.
 */
class EmailOutboxAdminApiTest extends TestCase
{
    private Application $app;
    private PDO $pdo;
    private array $admin;
    private array $receptionist;
    private array $patient;
    protected function setUp(): void
    {
        $_SESSION = [];
        $this->pdo = TestDb::create();
        $this->app = new Application(null, false);
        $users = new UserRepository();
        $this->admin = $users->findById($users->create('admin.mail@test.com', password_hash('x', PASSWORD_BCRYPT), 'ADMIN', 1, 1));
        $this->receptionist = $users->findById($users->create('desk@test.com', password_hash('x', PASSWORD_BCRYPT), 'RECEPTIONIST', 1, 1));
        $this->patient = $users->findById($users->create('pat@test.com', password_hash('x', PASSWORD_BCRYPT), 'PATIENT', 1, 1));
        foreach (['view', 'view_failures', 'retry', 'manage'] as $i => $slug) {
            $this->pdo->exec("INSERT INTO permissions (id, name, slug, module, description) VALUES (" . (900 + $i) . ", 'Email {$slug}', 'email_outbox.{$slug}', 'email', 'x')");
        }
        // sent, retryable, failed (attempts left), exhausted
        $this->job('sent1', 'SENT', 1, 5, null);
        $this->job('retry1', 'FAILED_RETRYABLE', 2, 5, 'SMTP_TIMEOUT');
        $this->job('fail1', 'FAILED_PERMANENT', 1, 5, 'INVALID_RECIPIENT');
        $this->job('exh1', 'FAILED_PERMANENT', 5, 5, 'SMTP_451');
    }
    private function job(string $key, string $status, int $attempts, int $max, ?string $code): void
    {
        $stmt = $this->pdo->prepare("INSERT INTO email_outbox (event_key, event_type, template_key, payload_json, recipient_email, recipient_name, subject, status, attempts, max_attempts, last_error_code, last_error, failure_category, next_attempt_at, created_at, updated_at)
            VALUES (?, 'APPOINTMENT_CONFIRMED', 'appointment-confirmed', ?, 'maria.santos@example.com', 'Maria', 'Subject', ?, ?, ?, ?, ?, ?, '2026-11-18 09:00:00', '2026-11-18 08:00:00', '2026-11-18 08:30:00')");
        $stmt->execute([$key, '{"name":"Maria","reference":"TC-000001","secure":"v1:SEALEDSECRET"}', $status, $attempts, $max, $code, $code ? 'Sanitized failure.' : null, $code ? 'TEMPORARY' : null]);
    }
    private function grant(string ...$slugs): void
    {
        foreach ($slugs as $slug) {
            $this->pdo->exec("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 1, id FROM permissions WHERE slug = 'email_outbox.{$slug}'");
        }
    }
    private function call(string $method, string $uri, array $user, array $body = [], array $query = []): \App\Core\Response
    {
        $req = Request::create($method, $uri, $body ? ['content-type' => 'application/json'] : [], $body ? json_encode($body) : '', $query);
        $req->setUser($user);
        return $this->app->handle($req);
    }
    private function jobId(string $key): int
    {
        return (int) $this->pdo->query("SELECT id FROM email_outbox WHERE event_key = '{$key}'")->fetchColumn();
    }
    private function jobStatus(string $key): string
    {
        return (string) $this->pdo->query("SELECT status FROM email_outbox WHERE event_key = '{$key}'")->fetchColumn();
    }
    public function testAdministratorHasNoEmailAccessUntilPermissionsAreAssigned(): void
    {
        $this->assertSame(403, $this->call('GET', '/api/v1/admin/email-outbox/stats', $this->admin)->getStatusCode());
        $this->assertSame(403, $this->call('GET', '/api/v1/admin/email-outbox/jobs', $this->admin)->getStatusCode());
        $this->assertSame(403, $this->call('POST', '/api/v1/admin/email-outbox/jobs/' . $this->jobId('fail1') . '/retry', $this->admin)->getStatusCode());
    }
    public function testNonAdminRolesAreDenied(): void
    {
        foreach ([$this->receptionist, $this->patient] as $user) {
            $this->assertSame(403, $this->call('GET', '/api/v1/admin/email-outbox/stats', $user)->getStatusCode());
            $this->assertSame(403, $this->call('GET', '/api/v1/admin/email-outbox/jobs', $user)->getStatusCode());
        }
    }
    public function testUnauthenticatedRequestIsRejected(): void
    {
        $res = $this->app->handle(Request::create('GET', '/api/v1/admin/email-outbox/stats'));
        $this->assertSame(401, $res->getStatusCode());
    }
    public function testViewPermissionAllowsStatsButNotJobDetails(): void
    {
        $this->grant('view');
        $res = $this->call('GET', '/api/v1/admin/email-outbox/stats', $this->admin);
        $this->assertSame(200, $res->getStatusCode());
        $data = json_decode($res->getBody(), true)['data'];
        $this->assertSame(4, $data['total']);
        $this->assertSame(1, $data['sent']);
        $this->assertSame(1, $data['retrying']);
        $this->assertSame(2, $data['failed']);
        $this->assertSame(1, $data['exhausted']);
        $this->assertSame(403, $this->call('GET', '/api/v1/admin/email-outbox/jobs', $this->admin)->getStatusCode());
    }
    public function testStatsExposeNoSmtpCredentials(): void
    {
        $this->grant('view');
        $_ENV['MAIL_PASSWORD'] = 'leak-me-not';
        $_ENV['MAIL_USERNAME'] = 'leak-user';
        $body = $this->call('GET', '/api/v1/admin/email-outbox/stats', $this->admin)->getBody();
        unset($_ENV['MAIL_PASSWORD'], $_ENV['MAIL_USERNAME']);
        $this->assertStringNotContainsString('leak-me-not', $body);
        $this->assertStringNotContainsString('leak-user', $body);
    }
    public function testJobListMasksRecipientsAndHidesPayloads(): void
    {
        $this->grant('view_failures');
        $res = $this->call('GET', '/api/v1/admin/email-outbox/jobs', $this->admin, [], ['failures_only' => 'true']);
        $this->assertSame(200, $res->getStatusCode());
        $raw = $res->getBody();
        $this->assertStringNotContainsString('maria.santos@example.com', $raw);
        $this->assertStringNotContainsString('SEALEDSECRET', $raw);
        $this->assertStringNotContainsString('payload', $raw);
        $this->assertStringNotContainsString('body_html', $raw);
        $rows = json_decode($raw, true)['data'];
        $this->assertCount(3, $rows);
        $this->assertSame('m******@e******.com', $rows[0]['recipient'] ?? null);
        $this->assertTrue(in_array(true, array_column($rows, 'exhausted'), true));
        $this->assertStringStartsWith('EML-', $rows[0]['reference']);
    }
    public function testViewingAJobIsAudited(): void
    {
        $this->grant('view_failures');
        $id = $this->jobId('fail1');
        $this->assertSame(200, $this->call('GET', "/api/v1/admin/email-outbox/jobs/{$id}", $this->admin)->getStatusCode());
        $row = $this->pdo->query("SELECT * FROM audit_logs WHERE action = 'EMAIL_OUTBOX_JOB_VIEWED'")->fetch(PDO::FETCH_ASSOC);
        $this->assertNotFalse($row);
        $this->assertSame((int) $this->admin['id'], (int) $row['actor_user_id']);
        $this->assertStringNotContainsString('maria.santos', (string) $row['sanitized_payload']);
    }
    public function testRetryRequiresPermissionAndIsAudited(): void
    {
        $id = $this->jobId('fail1');
        $this->grant('view_failures');
        $this->assertSame(403, $this->call('POST', "/api/v1/admin/email-outbox/jobs/{$id}/retry", $this->admin)->getStatusCode());
        $this->grant('retry');
        $res = $this->call('POST', "/api/v1/admin/email-outbox/jobs/{$id}/retry", $this->admin);
        $this->assertSame(200, $res->getStatusCode());
        $this->assertSame('PENDING', $this->jobStatus('fail1'));
        $audit = $this->pdo->query("SELECT sanitized_payload FROM audit_logs WHERE action = 'EMAIL_OUTBOX_JOB_RETRIED'")->fetchColumn();
        $this->assertNotFalse($audit);
        $this->assertStringNotContainsString('SEALEDSECRET', (string) $audit);
        // original business columns and history are preserved
        $row = $this->pdo->query("SELECT attempts, last_error_code FROM email_outbox WHERE event_key = 'fail1'")->fetch(PDO::FETCH_ASSOC);
        $this->assertSame(1, (int) $row['attempts']);
        $this->assertSame('INVALID_RECIPIENT', $row['last_error_code']);
    }
    public function testSecondConcurrentRetryIsRejected(): void
    {
        $this->grant('retry');
        $id = $this->jobId('fail1');
        $this->assertSame(200, $this->call('POST', "/api/v1/admin/email-outbox/jobs/{$id}/retry", $this->admin)->getStatusCode());
        $this->assertSame(409, $this->call('POST', "/api/v1/admin/email-outbox/jobs/{$id}/retry", $this->admin)->getStatusCode());
    }
    public function testSentJobsCannotBeRetried(): void
    {
        $this->grant('retry');
        $this->assertSame(409, $this->call('POST', '/api/v1/admin/email-outbox/jobs/' . $this->jobId('sent1') . '/retry', $this->admin)->getStatusCode());
    }
    public function testExhaustedJobNeedsManagePermissionAndConfirmation(): void
    {
        $id = $this->jobId('exh1');
        $this->grant('retry');
        $this->assertSame(403, $this->call('POST', "/api/v1/admin/email-outbox/jobs/{$id}/retry", $this->admin, ['confirm' => true])->getStatusCode());
        $this->grant('manage');
        $this->assertSame(422, $this->call('POST', "/api/v1/admin/email-outbox/jobs/{$id}/retry", $this->admin)->getStatusCode());
        $this->assertSame('FAILED_PERMANENT', $this->jobStatus('exh1'));
        $this->assertSame(200, $this->call('POST', "/api/v1/admin/email-outbox/jobs/{$id}/retry", $this->admin, ['confirm' => true])->getStatusCode());
        $this->assertSame('PENDING', $this->jobStatus('exh1'));
        $this->assertNotFalse($this->pdo->query("SELECT 1 FROM audit_logs WHERE action = 'EMAIL_OUTBOX_JOB_REQUEUED_EXHAUSTED'")->fetchColumn());
    }
    public function testRetryRevalidatesTheJob(): void
    {
        $this->grant('retry');
        $this->pdo->exec("UPDATE email_outbox SET recipient_email = 'broken' WHERE event_key = 'fail1'");
        $this->assertSame(422, $this->call('POST', '/api/v1/admin/email-outbox/jobs/' . $this->jobId('fail1') . '/retry', $this->admin)->getStatusCode());
        $this->pdo->exec("UPDATE email_outbox SET recipient_email = 'ok@example.com', template_key = 'gone' WHERE event_key = 'fail1'");
        $this->assertSame(422, $this->call('POST', '/api/v1/admin/email-outbox/jobs/' . $this->jobId('fail1') . '/retry', $this->admin)->getStatusCode());
        $this->assertSame('FAILED_PERMANENT', $this->jobStatus('fail1'));
    }
    public function testAbandonRequiresManageAndScrubsSecrets(): void
    {
        $id = $this->jobId('retry1');
        $this->grant('retry');
        $this->assertSame(403, $this->call('POST', "/api/v1/admin/email-outbox/jobs/{$id}/abandon", $this->admin)->getStatusCode());
        $this->grant('manage');
        $this->assertSame(200, $this->call('POST', "/api/v1/admin/email-outbox/jobs/{$id}/abandon", $this->admin)->getStatusCode());
        $this->assertSame('FAILED_PERMANENT', $this->jobStatus('retry1'));
        $payload = (string) $this->pdo->query("SELECT payload_json FROM email_outbox WHERE event_key = 'retry1'")->fetchColumn();
        $this->assertStringNotContainsString('SEALEDSECRET', $payload);
        $this->assertNotFalse($this->pdo->query("SELECT 1 FROM audit_logs WHERE action = 'EMAIL_OUTBOX_JOB_ABANDONED'")->fetchColumn());
    }
    public function testUnknownJobIs404(): void
    {
        $this->grant('view_failures');
        $this->assertSame(404, $this->call('GET', '/api/v1/admin/email-outbox/jobs/99999', $this->admin)->getStatusCode());
    }
    public function testMaskEmail(): void
    {
        $this->assertSame('m******@e******.com', EmailOutboxController::maskEmail('maria.santos@example.com'));
        $this->assertSame('a**@b**.org', EmailOutboxController::maskEmail('ab@bc.org'));
        $this->assertSame('***', EmailOutboxController::maskEmail('invalid'));
    }
    public function testMetricsEndpointExposesBoundedLabelsOnly(): void
    {
        $res = $this->app->handle(Request::create('GET', '/api/v1/metrics'));
        $body = $res->getBody();
        $this->assertSame(200, $res->getStatusCode());
        foreach (['toothcare_email_jobs_total', 'toothcare_email_delivery_success_total', 'toothcare_email_delivery_failure_total',
            'toothcare_email_retry_total', 'toothcare_email_jobs_pending', 'toothcare_email_jobs_exhausted', 'toothcare_email_worker_processing'] as $metric) {
            $this->assertStringContainsString($metric, $body);
        }
        $this->assertStringContainsString('toothcare_email_jobs_exhausted 1', $body);
        $this->assertStringNotContainsString('@', $body);
        $this->assertStringNotContainsString('maria', $body);
        $this->assertStringNotContainsString('TC-000001', $body);
    }
}
