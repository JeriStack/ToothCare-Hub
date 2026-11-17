<?php
declare(strict_types=1);
namespace App\Services\Email;
use App\Core\Config;
use App\Core\Database;
use App\Core\Logger;
use App\Repositories\AppointmentRepository;
use App\Repositories\EmailOutboxRepository;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
/**
 * Queues appointment reminders. Safe to run repeatedly and concurrently:
 *  - each (appointment, start time) maps to one unique event key,
 *  - a MySQL advisory lock prevents overlapping scheduler processes,
 *  - reminders for appointments that are no longer CONFIRMED are invalidated.
 *
 * Policy: a reminder becomes eligible `reminder_lead_hours` before the start time
 * (clinic setting, default 24, pending clinic approval). The window is (now, now + lead].
 * All times are interpreted in the clinic time zone (Asia/Manila by default).
 */
class ReminderScheduler
{
    private const LOCK_NAME = 'toothcare_reminder_scheduler';
    private DateTimeZone $timezone;
    /** @var callable(): DateTimeImmutable */
    private $clock;
    public function __construct(
        private readonly EmailOutboxRepository $outboxRepository,
        private readonly AppointmentRepository $appointmentRepository,
        private readonly EmailOutboxService $outboxService,
        private readonly OutboxSettings $settings,
        private readonly Database $database,
        private readonly Logger $logger,
        ?callable $clock = null
    ) {
        $this->timezone = new DateTimeZone(Config::getInstance()->getString('app_timezone', 'Asia/Manila'));
        $this->clock = $clock ?? fn(): DateTimeImmutable => new DateTimeImmutable('now', $this->timezone);
    }
    public function leadHours(): int
    {
        $v = $this->outboxRepository->setting('reminder_lead_hours');
        if ($v !== null && ctype_digit($v) && (int) $v >= 1 && (int) $v <= 168) {
            return (int) $v;
        }
        return $this->settings->reminderLeadHoursDefault;
    }
    /**
     * @return array{created: int, skipped: int, invalidated: int, locked: bool}
     */
    public function run(): array
    {
        $result = ['created' => 0, 'skipped' => 0, 'invalidated' => 0, 'locked' => false];
        $pdo = $this->database->getConnection();
        $isMysql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
        if ($isMysql) {
            $got = $pdo->query("SELECT GET_LOCK('" . self::LOCK_NAME . "', 0)")->fetchColumn();
            if ((int) $got !== 1) {
                $result['locked'] = true;
                $this->logger->warning('Reminder scheduler skipped: another instance is running');
                return $result;
            }
        }
        try {
            $now = ($this->clock)();
            $nowStr = $now->format('Y-m-d H:i:s');
            $until = $now->modify('+' . $this->leadHours() . ' hours')->format('Y-m-d H:i:s');
            $result['invalidated'] += $this->outboxRepository->cancelRemindersForIneligibleAppointments($nowStr);
            foreach ($this->outboxRepository->reminderCandidateIds($nowStr, $until) as $appointmentId) {
                $appointment = $this->appointmentRepository->findById($appointmentId);
                if ($appointment === null || ($appointment['status'] ?? '') !== 'CONFIRMED') {
                    $result['skipped']++;
                    continue;
                }
                try {
                    $id = $this->outboxService->queueReminder($appointment);
                    if ($id === null) {
                        $result['skipped']++;
                    } else {
                        $result['created']++;
                        $this->logger->info('Reminder scheduled', ['appointment_id' => $appointmentId, 'job_id' => $id]);
                    }
                    // A moved appointment gets a new key; invalidate queued reminders for the old time.
                    $result['invalidated'] += $this->outboxService->cancelObsoleteReminders(
                        $appointmentId,
                        $this->outboxService->reminderEventKey($appointment)
                    );
                } catch (\Throwable $e) {
                    $result['skipped']++;
                    $this->logger->error('Reminder scheduling failed for an appointment', ['appointment_id' => $appointmentId, 'error' => $e->getMessage()]);
                }
            }
            return $result;
        } finally {
            if ($isMysql) {
                $pdo->query("SELECT RELEASE_LOCK('" . self::LOCK_NAME . "')");
            }
        }
    }
}
