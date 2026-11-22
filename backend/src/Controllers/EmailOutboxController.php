<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Core\Config;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthorizationMiddleware;
use App\Repositories\AuditLogRepository;
use App\Repositories\EmailOutboxRepository;
use App\Services\Email\EmailService;
use App\Services\Email\EmailTemplateRenderer;
use App\Services\Email\MailConfig;
use App\Services\Email\OutboxSettings;
use DateTimeImmutable;
use DateTimeZone;
/**
 * Administrative visibility and recovery for the email outbox.
 *
 * Every endpoint requires an explicitly assigned DRBAC permission (no role fallback).
 * Responses never include message bodies, payload JSON, tokens, or SMTP settings beyond a safe summary.
 */
class EmailOutboxController
{
    private EmailOutboxRepository $repository;
    private AuditLogRepository $audit;
    public function __construct(?EmailOutboxRepository $repository = null, ?AuditLogRepository $audit = null)
    {
        $this->repository = $repository ?? new EmailOutboxRepository();
        $this->audit = $audit ?? new AuditLogRepository();
    }
    /** GET /api/v1/admin/email-outbox/stats */
    public function stats(Request $request): Response
    {
        $this->authorize($request, 'email_outbox.view');
        $stats = $this->repository->stats();
        $mail = MailConfig::fromEnvironment();
        $settings = OutboxSettings::fromEnvironment();
        $c = $stats['counts'];
        return Response::success([
            'total' => $stats['total'],
            'pending' => $c['PENDING'],
            'processing' => $c['PROCESSING'],
            'sent' => $c['SENT'],
            'retrying' => $c['FAILED_RETRYABLE'],
            'failed' => $c['FAILED_PERMANENT'],
            'cancelled' => $c['CANCELLED'],
            'exhausted' => $stats['exhausted'],
            'last_sent_at' => $stats['last_sent_at'],
            'avg_delivery_delay_seconds' => $stats['avg_delay_seconds'],
            'mail' => [
                'enabled' => $mail->enabled,
                'operational' => $mail->isOperational(),
                'configuration_errors' => $mail->errors,
            ],
            'worker' => [
                'enabled' => $settings->workerEnabled,
                'configuration_valid' => $settings->isValid(),
                'configuration_errors' => $settings->errors,
                'max_attempts' => $settings->maxAttempts,
            ],
        ]);
    }
    /** GET /api/v1/admin/email-outbox/jobs */
    public function index(Request $request): Response
    {
        $this->authorize($request, 'email_outbox.view_failures');
        $filters = [
            'status' => $this->enumOrNull((string) $request->getQuery('status', ''), ['PENDING', 'PROCESSING', 'SENT', 'FAILED_RETRYABLE', 'FAILED_PERMANENT', 'CANCELLED']),
            'event_type' => preg_match('/^[A-Z_]{1,64}$/', (string) $request->getQuery('event_type', '')) === 1 ? (string) $request->getQuery('event_type') : null,
            'failures_only' => filter_var($request->getQuery('failures_only', 'false'), FILTER_VALIDATE_BOOLEAN),
        ];
        $page = max(1, (int) $request->getQuery('page', 1));
        $rawPerPage = $request->getQuery('per_page') ?? $request->getQuery('limit') ?? 25;
        $perPage = max(1, min(100, (int) $rawPerPage));
        $result = $this->repository->list($filters, $page, $perPage);
        return Response::paginated(
            array_map(fn(array $r): array => $this->present($r), $result['data']),
            ['page' => $page, 'per_page' => $perPage, 'total' => $result['total'], 'total_pages' => (int) ceil($result['total'] / $perPage)]
        );
    }
    /** GET /api/v1/admin/email-outbox/jobs/{id} */
    public function show(Request $request): Response
    {
        $user = $this->authorize($request, 'email_outbox.view_failures');
        $job = $this->findJob($request);
        $this->audit->record('EMAIL_OUTBOX_JOB_VIEWED', 'email_outbox', (int) $job['id'], (int) $user['id'], $request->getClientIp(), $request->getHeader('user-agent'), [
            'event_type' => $job['event_type'],
            'status' => $job['status'],
        ]);
        return Response::success($this->present($job));
    }
    /**
     * POST /api/v1/admin/email-outbox/jobs/{id}/retry
     * Failed jobs that still have attempts left need email_outbox.retry.
     * Exhausted jobs also need email_outbox.manage and an explicit {"confirm": true}.
     */
    public function retry(Request $request): Response
    {
        $user = $this->authorize($request, 'email_outbox.retry');
        $job = $this->findJob($request);
        if (!in_array($job['status'], ['FAILED_RETRYABLE', 'FAILED_PERMANENT'], true)) {
            throw HttpException::conflict('Only failed email jobs can be retried.', 'EMAIL_JOB_NOT_RETRYABLE');
        }
        $exhausted = (int) $job['attempts'] >= (int) $job['max_attempts'];
        if ($exhausted) {
            $this->authorize($request, 'email_outbox.manage');
            if (filter_var($request->input('confirm', false), FILTER_VALIDATE_BOOLEAN) !== true) {
                throw HttpException::unprocessableEntity('Requeueing an exhausted job requires explicit confirmation.', ['confirm' => 'Set confirm to true.']);
            }
        }
        $this->revalidate($job);
        $now = $this->now();
        if (!$this->repository->requeue((int) $job['id'], $now)) {
            throw HttpException::conflict('The job was changed by another process. Reload and try again.', 'EMAIL_JOB_STATE_CHANGED');
        }
        $this->audit->record(
            $exhausted ? 'EMAIL_OUTBOX_JOB_REQUEUED_EXHAUSTED' : 'EMAIL_OUTBOX_JOB_RETRIED',
            'email_outbox',
            (int) $job['id'],
            (int) $user['id'],
            $request->getClientIp(),
            $request->getHeader('user-agent'),
            ['event_type' => $job['event_type'], 'previous_status' => $job['status'], 'previous_attempts' => (int) $job['attempts'], 'previous_error_code' => $job['last_error_code']]
        );
        return Response::success($this->present($this->repository->findById((int) $job['id']) ?? $job));
    }
    /** POST /api/v1/admin/email-outbox/jobs/{id}/abandon */
    public function abandon(Request $request): Response
    {
        $user = $this->authorize($request, 'email_outbox.manage');
        $job = $this->findJob($request);
        if (!in_array($job['status'], ['PENDING', 'FAILED_RETRYABLE', 'FAILED_PERMANENT'], true)) {
            throw HttpException::conflict('Only queued or failed email jobs can be abandoned.', 'EMAIL_JOB_NOT_ABANDONABLE');
        }
        $payload = is_string($job['payload_json'] ?? null) ? json_decode((string) $job['payload_json'], true) : null;
        if (is_array($payload)) {
            unset($payload['secure']);
        }
        if (!$this->repository->abandon((int) $job['id'], $this->now(), is_array($payload) ? $payload : null)) {
            throw HttpException::conflict('The job was changed by another process. Reload and try again.', 'EMAIL_JOB_STATE_CHANGED');
        }
        $this->audit->record('EMAIL_OUTBOX_JOB_ABANDONED', 'email_outbox', (int) $job['id'], (int) $user['id'], $request->getClientIp(), $request->getHeader('user-agent'), [
            'event_type' => $job['event_type'],
            'previous_status' => $job['status'],
        ]);
        return Response::success($this->present($this->repository->findById((int) $job['id']) ?? $job));
    }
    // ------------------------------------------------------------------ helpers
    /** @return array<string, mixed> */
    private function authorize(Request $request, string $permission): array
    {
        // Empty fallback list: administrators do not get email access unless the permission is assigned.
        return AuthorizationMiddleware::requireUserPermission($request, $permission, []);
    }
    /** @return array<string, mixed> */
    private function findJob(Request $request): array
    {
        $id = (int) $request->getParam('id');
        $job = $id > 0 ? $this->repository->findById($id) : null;
        if ($job === null) {
            throw HttpException::notFound('Email job was not found.');
        }
        return $job;
    }
    /** @param array<string, mixed> $job */
    private function revalidate(array $job): void
    {
        $errors = [];
        if (!EmailService::isDeliverableAddress((string) $job['recipient_email'])) {
            $errors['recipient'] = 'Recipient address is invalid.';
        }
        $template = (string) ($job['template_key'] ?? '');
        if ($template !== '') {
            $renderer = new EmailTemplateRenderer(EmailTemplateRenderer::defaultTemplateDir());
            if (!$renderer->has($template)) {
                $errors['template'] = 'Email template is not available.';
            }
            $payload = is_string($job['payload_json'] ?? null) ? json_decode((string) $job['payload_json'], true) : null;
            if (!is_array($payload)) {
                $errors['payload'] = 'Stored payload is invalid and cannot be retried.';
            }
        } elseif (empty($job['body_html']) && empty($job['body_text'])) {
            $errors['payload'] = 'Legacy job has no message body.';
        }
        if ($errors !== []) {
            throw HttpException::unprocessableEntity('This job cannot be retried until its data is corrected.', $errors);
        }
    }
    /**
     * @param array<string, mixed> $r
     * @return array<string, mixed>
     */
    private function present(array $r): array
    {
        return [
            'id' => (int) $r['id'],
            'reference' => 'EML-' . str_pad((string) $r['id'], 6, '0', STR_PAD_LEFT),
            'event_type' => $r['event_type'] ?? 'LEGACY',
            'recipient' => self::maskEmail((string) $r['recipient_email']),
            'status' => $r['status'],
            'attempts' => (int) $r['attempts'],
            'max_attempts' => (int) $r['max_attempts'],
            'exhausted' => $r['status'] === 'FAILED_PERMANENT' && (int) $r['attempts'] >= (int) $r['max_attempts'],
            'failure_category' => $r['failure_category'] ?? null,
            'error_code' => $r['last_error_code'] ?? null,
            'error_message' => $r['last_error'] ?? null,
            'next_attempt_at' => $r['status'] === 'FAILED_RETRYABLE' || $r['status'] === 'PENDING' ? ($r['next_attempt_at'] ?? null) : null,
            'created_at' => $r['created_at'] ?? null,
            'last_attempt_at' => $r['updated_at'] ?? null,
            'sent_at' => $r['sent_at'] ?? null,
            'failed_at' => $r['failed_at'] ?? null,
            'appointment_id' => isset($r['appointment_id']) ? (int) $r['appointment_id'] : null,
        ];
    }
    public static function maskEmail(string $email): string
    {
        $at = strrpos($email, '@');
        if ($at === false || $at < 1) {
            return '***';
        }
        $local = substr($email, 0, $at);
        $domain = substr($email, $at + 1);
        $dot = strrpos($domain, '.');
        $host = $dot === false ? $domain : substr($domain, 0, $dot);
        $tld = $dot === false ? '' : substr($domain, $dot);
        return substr($local, 0, 1) . str_repeat('*', max(2, min(6, strlen($local) - 1)))
            . '@' . substr($host, 0, 1) . str_repeat('*', max(2, min(6, strlen($host) - 1))) . $tld;
    }
    /** @param list<string> $allowed */
    private function enumOrNull(string $value, array $allowed): ?string
    {
        $v = strtoupper(trim($value));
        return in_array($v, $allowed, true) ? $v : null;
    }
    private function now(): string
    {
        $tz = new DateTimeZone(Config::getInstance()->getString('app_timezone', 'Asia/Manila'));
        return (new DateTimeImmutable('now', $tz))->format('Y-m-d H:i:s');
    }
}
