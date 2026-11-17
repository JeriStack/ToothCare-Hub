<?php
declare(strict_types=1);
namespace App\Services\Email;
use App\Core\Config;
use App\Core\Logger;
use App\Repositories\EmailOutboxRepository;
use DateTimeImmutable;
use DateTimeZone;
/**
 * Claims eligible outbox jobs, renders and sends them OUTSIDE any database transaction, and
 * records the outcome. Safe to run as several concurrent processes.
 *
 * Flow per batch: recover expired locks, claim (short transaction), then for each job
 * revalidate, render, send, and write the result guarded by worker ownership.
 */
class EmailOutboxWorker
{
    private DateTimeZone $timezone;
    /** @var callable(): DateTimeImmutable */
    private $clock;
    /** @var array<string, string>|null */
    private ?array $clinic = null;
    public function __construct(
        private readonly EmailOutboxRepository $repository,
        private readonly EmailService $mailer,
        private readonly EmailTemplateRenderer $renderer,
        private readonly PayloadCipher $cipher,
        private readonly OutboxSettings $settings,
        private readonly Logger $logger,
        private readonly string $workerId,
        ?callable $clock = null
    ) {
        $this->timezone = new DateTimeZone(Config::getInstance()->getString('app_timezone', 'Asia/Manila'));
        $this->clock = $clock ?? fn(): DateTimeImmutable => new DateTimeImmutable('now', $this->timezone);
    }
    public static function newWorkerId(): string
    {
        return substr((gethostname() ?: 'host') . '-' . getmypid() . '-' . bin2hex(random_bytes(3)), 0, 64);
    }
    public function workerId(): string
    {
        return $this->workerId;
    }
    /**
     * Process one batch.
     *
     * @return array{recovered: int, claimed: int, sent: int, retried: int, failed: int, cancelled: int}
     */
    public function runBatch(): array
    {
        $stats = ['recovered' => 0, 'claimed' => 0, 'sent' => 0, 'retried' => 0, 'failed' => 0, 'cancelled' => 0];
        $now = $this->now();
        $stats['recovered'] = $this->repository->recoverExpiredLocks($now, $this->settings->lockTimeoutSeconds);
        if ($stats['recovered'] > 0) {
            $this->logger->warning('Email worker recovered expired locks', ['worker_id' => $this->workerId, 'count' => $stats['recovered']]);
        }
        if (!$this->mailer->isOperational()) {
            // Leave jobs queued; operators are informed through the CLI status code and logs.
            return $stats;
        }
        $jobs = $this->repository->claimBatch($this->workerId, $this->settings->batchSize, $now);
        $stats['claimed'] = count($jobs);
        foreach ($jobs as $job) {
            $outcome = $this->processJob($job);
            $stats[$outcome]++;
        }
        return $stats;
    }
    /**
     * @param array<string, mixed> $job
     * @return 'sent'|'retried'|'failed'|'cancelled'
     */
    private function processJob(array $job): string
    {
        $id = (int) $job['id'];
        $eventType = (string) ($job['event_type'] ?? 'LEGACY');
        $attempt = (int) $job['attempts'];
        $max = (int) $job['max_attempts'];
        $this->logger->info('Email job claimed', ['job_id' => $id, 'event_type' => $eventType, 'attempt' => $attempt, 'worker_id' => $this->workerId]);
        try {
            $prepared = $this->prepare($job);
            if ($prepared === null) {
                $this->repository->markCancelled($id, $this->workerId, 'REMINDER_OBSOLETE', 'Reminder no longer applicable.', $this->now());
                $this->logger->info('Email job cancelled before delivery', ['job_id' => $id, 'event_type' => $eventType]);
                return 'cancelled';
            }
            [$message, $payload] = $prepared;
            $result = $this->mailer->send($message);
        } catch (OutboxJobException $e) {
            return $this->fail($id, $eventType, $attempt, DeliveryResult::CATEGORY_PERMANENT, $e->errorCode, $e->getMessage());
        } catch (\Throwable $e) {
            $c = $this->settings->retryPolicy->classify($e);
            return $this->handleFailure($id, $eventType, $attempt, $max, $c['category'], $c['code'], 'Unexpected error while preparing the email.');
        }
        if ($result->success) {
            $scrubbed = $payload;
            unset($scrubbed['secure']);
            $ok = $this->repository->markSent($id, $this->workerId, $this->now(), $scrubbed);
            $this->logger->info($ok ? 'Email delivered' : 'Email delivered but lock was lost before recording', [
                'job_id' => $id, 'event_type' => $eventType, 'attempt' => $attempt, 'worker_id' => $this->workerId,
            ]);
            return 'sent';
        }
        return $this->handleFailure($id, $eventType, $attempt, $max, $result->category, $result->errorCode, $result->message);
    }
    /**
     * Validate, decrypt, revalidate and render. Returns null when the job became obsolete.
     *
     * @param array<string, mixed> $job
     * @return array{0: EmailMessage, 1: array<string, mixed>}|null
     */
    private function prepare(array $job): ?array
    {
        $email = (string) $job['recipient_email'];
        $name = (string) $job['recipient_name'];
        $templateKey = (string) ($job['template_key'] ?? '');
        if ($templateKey === '') {
            // Legacy row created before Phase 13: pre-rendered bodies.
            $html = (string) ($job['body_html'] ?? '');
            $text = (string) ($job['body_text'] ?? '');
            if ($html === '' && $text === '') {
                throw new OutboxJobException('LEGACY_BODY_MISSING', 'Legacy outbox row has no message body.');
            }
            return [new EmailMessage($email, $name, (string) $job['subject'], $html !== '' ? $html : nl2br(htmlspecialchars($text)), $text), []];
        }
        $raw = $job['payload_json'] ?? null;
        $payload = is_string($raw) && $raw !== '' ? json_decode($raw, true) : (is_array($raw) ? $raw : null);
        if (!is_array($payload)) {
            throw new OutboxJobException('PAYLOAD_MALFORMED', 'Outbox payload is missing or not valid JSON.');
        }
        $data = $payload;
        if (isset($payload['secure'])) {
            $opened = json_decode($this->cipher->open((string) $payload['secure']), true);
            if (!is_array($opened)) {
                throw new OutboxJobException('PAYLOAD_UNREADABLE', 'Sealed payload content is invalid.');
            }
            $data['secure'] = $opened;
        }
        if (($job['event_type'] ?? '') === EmailOutboxService::EVENT_REMINDER && !$this->reminderStillValid($job, $payload)) {
            return null;
        }
        if ($this->clinic === null) {
            $this->clinic = $this->repository->clinicContact();
        }
        $rendered = $this->renderer->render($templateKey, $data, $this->clinic);
        return [new EmailMessage($email, $name, $rendered['subject'], $rendered['html'], $rendered['text']), $payload];
    }
    /**
     * @param array<string, mixed> $job
     * @param array<string, mixed> $payload
     */
    private function reminderStillValid(array $job, array $payload): bool
    {
        if (empty($job['appointment_id'])) {
            return false;
        }
        $state = $this->repository->appointmentState((int) $job['appointment_id']);
        if ($state === null || $state['status'] !== 'CONFIRMED') {
            return false;
        }
        if (isset($payload['start_at']) && $payload['start_at'] !== $state['start_at']) {
            return false;
        }
        $start = new DateTimeImmutable($state['start_at'], $this->timezone);
        return $start > ($this->clock)();
    }
    /** @return 'retried'|'failed' */
    private function handleFailure(int $id, string $eventType, int $attempt, int $max, string $category, string $code, string $message): string
    {
        $policy = $this->settings->retryPolicy;
        if ($category === DeliveryResult::CATEGORY_PERMANENT) {
            return $this->fail($id, $eventType, $attempt, $category, $code, $message);
        }
        if ($policy->isExhausted($attempt, $max)) {
            return $this->fail($id, $eventType, $attempt, $category, $code, $message, true);
        }
        $delay = $policy->delayAfterAttempt($attempt);
        $next = ($this->clock)()->modify("+{$delay} seconds")->format('Y-m-d H:i:s');
        $this->repository->markRetry($id, $this->workerId, $next, $category, $code, $message, $this->now());
        $this->logger->warning('Email delivery failed; retry scheduled', [
            'job_id' => $id, 'event_type' => $eventType, 'attempt' => $attempt, 'category' => $category,
            'error_code' => $code, 'next_attempt_at' => $next, 'worker_id' => $this->workerId,
        ]);
        return 'retried';
    }
    private function fail(int $id, string $eventType, int $attempt, string $category, string $code, string $message, bool $exhausted = false): string
    {
        $this->repository->markFailed($id, $this->workerId, $category, $code, $message, $this->now());
        $this->logger->error($exhausted ? 'Email job exhausted all attempts' : 'Email delivery failed permanently', [
            'job_id' => $id, 'event_type' => $eventType, 'attempt' => $attempt, 'category' => $category,
            'error_code' => $code, 'worker_id' => $this->workerId,
        ]);
        return 'failed';
    }
    private function now(): string
    {
        return ($this->clock)()->format('Y-m-d H:i:s');
    }
}
