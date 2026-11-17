<?php
declare(strict_types=1);
namespace App\Services\Email;
use App\Core\Config;
use App\Core\Database;
use App\Core\Logger;
use App\Repositories\EmailOutboxRepository;
use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
/**
 * Enqueues notification jobs into email_outbox.
 *
 * Contract: call these methods BEFORE committing the business transaction, on the shared
 * PDO connection. Any failure throws, so the caller's transaction rolls back and the business
 * change and its notification are never inconsistent. Nothing here talks to SMTP.
 *
 * Duplicate logical events return null (idempotent no-op).
 */
class EmailOutboxService
{
    public const EVENT_VERIFICATION = 'EMAIL_VERIFICATION';
    public const EVENT_PASSWORD_RESET = 'PASSWORD_RESET';
    public const EVENT_REQUESTED = 'APPOINTMENT_REQUESTED';
    public const EVENT_CONFIRMED = 'APPOINTMENT_CONFIRMED';
    public const EVENT_REJECTED = 'APPOINTMENT_REJECTED';
    public const EVENT_CANCELLED = 'APPOINTMENT_CANCELLED';
    public const EVENT_COMPLETED = 'APPOINTMENT_COMPLETED';
    public const EVENT_REMINDER = 'APPOINTMENT_REMINDER';
    /** @var array<string, array{template: string, subject: string}> */
    public const EVENTS = [
        self::EVENT_VERIFICATION => ['template' => 'verify-email', 'subject' => 'Verify your ToothCare Hub email address'],
        self::EVENT_PASSWORD_RESET => ['template' => 'password-reset', 'subject' => 'Reset your ToothCare Hub password'],
        self::EVENT_REQUESTED => ['template' => 'appointment-requested', 'subject' => 'We received your appointment request'],
        self::EVENT_CONFIRMED => ['template' => 'appointment-confirmed', 'subject' => 'Your appointment is confirmed'],
        self::EVENT_REJECTED => ['template' => 'appointment-rejected', 'subject' => 'Your appointment request could not be accepted'],
        self::EVENT_CANCELLED => ['template' => 'appointment-cancelled', 'subject' => 'Your appointment has been cancelled'],
        self::EVENT_COMPLETED => ['template' => 'appointment-completed', 'subject' => 'Thank you for visiting ToothCare Hub'],
        self::EVENT_REMINDER => ['template' => 'appointment-reminder', 'subject' => 'Reminder: your upcoming dental appointment'],
    ];
    private EmailOutboxRepository $repository;
    private OutboxSettings $settings;
    private ?PayloadCipher $cipher;
    private Logger $logger;
    private DateTimeZone $timezone;
    /** @var callable(): DateTimeImmutable */
    private $clock;
    public function __construct(
        ?EmailOutboxRepository $repository = null,
        ?OutboxSettings $settings = null,
        ?PayloadCipher $cipher = null,
        ?Logger $logger = null,
        ?callable $clock = null,
        ?Database $database = null
    ) {
        $this->repository = $repository ?? new EmailOutboxRepository($database);
        $this->settings = $settings ?? OutboxSettings::fromEnvironment();
        $this->cipher = $cipher; // created lazily so a missing EMAIL_PAYLOAD_KEY only affects token emails
        $this->logger = $logger ?? Logger::getInstance();
        $this->timezone = new DateTimeZone(Config::getInstance()->getString('app_timezone', 'Asia/Manila'));
        $this->clock = $clock ?? fn(): DateTimeImmutable => new DateTimeImmutable('now', $this->timezone);
    }
    private function cipher(): PayloadCipher
    {
        return $this->cipher ??= PayloadCipher::fromEnvironment();
    }

    public static function appointmentReference(int $appointmentId): string
    {
        return 'TC-' . str_pad((string) $appointmentId, 6, '0', STR_PAD_LEFT);
    }
    /**
     * Generic enqueue. $data must be non-sensitive; $secure values are sealed (encrypted).
     *
     * @param array<string, mixed> $data
     * @param array<string, string>|null $secure
     * @throws InvalidArgumentException|\Throwable
     */
    public function enqueue(
        string $eventType,
        string $eventKey,
        string $recipientEmail,
        string $recipientName,
        array $data,
        ?array $secure = null,
        ?int $userId = null,
        ?int $appointmentId = null,
        ?\DateTimeInterface $availableAt = null
    ): ?int {
        if (!isset(self::EVENTS[$eventType])) {
            throw new InvalidArgumentException('Unknown email event type.');
        }
        if (!EmailService::isDeliverableAddress($recipientEmail)) {
            throw new InvalidArgumentException('Recipient email address is invalid.');
        }
        if ($eventKey === '' || strlen($eventKey) > 191) {
            throw new InvalidArgumentException('Event key must be 1-191 characters.');
        }
        $payload = $data;
        if ($secure !== null && $secure !== []) {
            $payload['secure'] = $this->cipher()->seal((string) json_encode($secure, JSON_UNESCAPED_UNICODE));
        }
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $now = ($this->clock)()->format('Y-m-d H:i:s');
        $id = $this->repository->insertIdempotent([
            'event_key' => $eventKey,
            'event_type' => $eventType,
            'template_key' => self::EVENTS[$eventType]['template'],
            'payload_json' => $json,
            'user_id' => $userId,
            'appointment_id' => $appointmentId,
            'recipient_email' => strtolower(trim($recipientEmail)),
            'recipient_name' => mb_substr(trim($recipientName) !== '' ? trim($recipientName) : 'Patient', 0, 150),
            'subject' => self::EVENTS[$eventType]['subject'],
            'max_attempts' => $this->settings->maxAttempts,
            'available_at' => $availableAt !== null ? $availableAt->format('Y-m-d H:i:s') : $now,
            'now' => $now,
        ]);
        $this->logger->info($id === null ? 'Email job already queued (duplicate event ignored)' : 'Email job created', [
            'event_type' => $eventType,
            'job_id' => $id,
            'appointment_id' => $appointmentId,
        ]);
        return $id;
    }
    public function queueVerification(string $email, string $name, int $userId, string $rawToken, int $tokenId, int $ttlSeconds): ?int
    {
        return $this->enqueue(
            self::EVENT_VERIFICATION,
            "user:{$userId}:email_verify:{$tokenId}",
            $email,
            $name,
            ['name' => $name, 'ttl_hours' => max(1, (int) round($ttlSeconds / 3600))],
            ['token' => $rawToken],
            $userId
        );
    }
    public function queuePasswordReset(string $email, string $name, int $userId, string $rawToken, int $tokenId, int $ttlSeconds): ?int
    {
        return $this->enqueue(
            self::EVENT_PASSWORD_RESET,
            "user:{$userId}:password_reset:{$tokenId}",
            $email,
            $name,
            ['name' => $name, 'ttl_minutes' => max(1, (int) round($ttlSeconds / 60))],
            ['token' => $rawToken],
            $userId
        );
    }
    /**
     * Enqueue a lifecycle notification from a persisted appointment row.
     * $historyId identifies the exact transition so repeated or retried requests cannot duplicate it.
     *
     * @param array<string, mixed> $appointment row from AppointmentRepository::findById
     * @param array<string, mixed> $extra optional: reason, cancelled_by
     */
    public function queueAppointmentEvent(string $eventType, array $appointment, int $historyId, array $extra = []): ?int
    {
        $email = (string) ($appointment['patient_email'] ?? '');
        if ($email === '') {
            $this->logger->warning('Appointment email skipped: patient has no email address', [
                'event_type' => $eventType,
                'appointment_id' => $appointment['id'] ?? null,
            ]);
            return null;
        }
        $appointmentId = (int) $appointment['id'];
        $data = $this->appointmentData($appointment) + array_filter($extra, static fn($v) => $v !== null && $v !== '');
        $userId = isset($appointment['patient_user_id']) ? (int) $appointment['patient_user_id'] : null;
        $id = $this->enqueue(
            $eventType,
            "appointment:{$appointmentId}:{$eventType}:{$historyId}",
            $email,
            (string) $data['name'],
            $data,
            null,
            $userId,
            $appointmentId
        );
        if (in_array($eventType, [self::EVENT_CANCELLED, self::EVENT_REJECTED, self::EVENT_COMPLETED], true)) {
            $this->cancelObsoleteReminders($appointmentId);
        }
        return $id;
    }
    /**
     * Queue a reminder. The key embeds the appointment start time, so one reminder exists per
     * (appointment, start time). Moving an appointment in place yields a fresh reminder and the
     * old queued one is invalidated by the scheduler.
     *
     * @param array<string, mixed> $appointment
     */
    public function queueReminder(array $appointment): ?int
    {
        $appointmentId = (int) $appointment['id'];
        $email = (string) ($appointment['patient_email'] ?? '');
        if ($email === '') {
            return null;
        }
        $data = $this->appointmentData($appointment);
        $data['start_at'] = (string) $appointment['start_at'];
        return $this->enqueue(
            self::EVENT_REMINDER,
            $this->reminderEventKey($appointment),
            $email,
            (string) $data['name'],
            $data,
            null,
            isset($appointment['patient_user_id']) ? (int) $appointment['patient_user_id'] : null,
            $appointmentId
        );
    }
    /** @param array<string, mixed> $appointment */
    public function reminderEventKey(array $appointment): string
    {
        $startTs = (new DateTimeImmutable((string) $appointment['start_at'], $this->timezone))->getTimestamp();
        return 'appointment:' . (int) $appointment['id'] . ':reminder:' . $startTs;
    }
    public function cancelObsoleteReminders(int $appointmentId, ?string $exceptEventKey = null): int
    {
        $now = ($this->clock)()->format('Y-m-d H:i:s');
        return $this->repository->cancelQueuedForAppointment($appointmentId, [self::EVENT_REMINDER], 'REMINDER_OBSOLETE', $now, $exceptEventKey);
    }
    /**
     * Minimal, non-clinical template data. Never include diagnosis, notes, or chief complaint.
     *
     * @param array<string, mixed> $a
     * @return array<string, mixed>
     */
    private function appointmentData(array $a): array
    {
        $first = trim((string) ($a['patient_first_name'] ?? ''));
        $last = trim((string) ($a['patient_last_name'] ?? ''));
        $name = trim($first . ' ' . $last) !== '' ? trim($first . ' ' . $last) : 'Patient';
        $dentist = trim((string) ($a['dentist_first_name'] ?? '') . ' ' . (string) ($a['dentist_last_name'] ?? ''));
        $display = '';
        if (!empty($a['start_at'])) {
            try {
                $display = (new DateTimeImmutable((string) $a['start_at'], $this->timezone))->format('l, F j, Y \a\t g:i A');
            } catch (\Throwable) {
                $display = '';
            }
        }
        return array_filter([
            'name' => $name,
            'reference' => self::appointmentReference((int) $a['id']),
            'service' => (string) ($a['service_name'] ?? ''),
            'dentist' => $dentist !== '' ? 'Dr. ' . $dentist : '',
            'start_display' => $display,
        ], static fn($v) => $v !== '');
    }
}