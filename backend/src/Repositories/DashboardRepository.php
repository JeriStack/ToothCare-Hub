<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use DateTimeImmutable;
use DateTimeZone;
use PDO;

/**
 * Administrative Dashboard & Operational Intelligence Repository
 * Computes real-time MySQL aggregate metrics, appointment trends, outbox health,
 * and safe operational error summaries using Asia/Manila clinic boundaries.
 */
class DashboardRepository
{
    private Database $database;
    private DateTimeZone $timezone;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
        $this->timezone = new DateTimeZone('Asia/Manila');
    }

    /**
     * Compute comprehensive clinic operational aggregates.
     *
     * @return array<string, mixed>
     */
    public function getMetrics(): array
    {
        $pdo = $this->database->getConnection();
        $now = new DateTimeImmutable('now', $this->timezone);
        $today = $now->format('Y-m-d');
        $nowStr = $now->format('Y-m-d H:i:s');
        $todayStart = $today . ' 00:00:00';
        $todayEnd = $today . ' 23:59:59';

        // 1. Patient Aggregates (unique patient rows; active requires users.is_active = 1)
        $totalPatients = (int) $pdo->query('SELECT COUNT(*) FROM patients')->fetchColumn();
        $activePatients = (int) $pdo->query('
            SELECT COUNT(*)
            FROM patients p
            INNER JOIN users u ON p.user_id = u.id
            WHERE u.is_active = 1
        ')->fetchColumn();

        // 2. Dentist Aggregates (active requires both dentist profile and linked user account active)
        $totalDentists = (int) $pdo->query('SELECT COUNT(*) FROM dentists')->fetchColumn();
        $activeDentists = (int) $pdo->query('
            SELECT COUNT(*)
            FROM dentists d
            INNER JOIN users u ON d.user_id = u.id
            WHERE d.is_active = 1 AND u.is_active = 1
        ')->fetchColumn();
        $inactiveDentists = max(0, $totalDentists - $activeDentists);

        // 3. Service Aggregates
        $totalServices = (int) $pdo->query('SELECT COUNT(*) FROM services')->fetchColumn();
        $activeServices = (int) $pdo->query('SELECT COUNT(*) FROM services WHERE is_active = 1')->fetchColumn();
        $inactiveServices = max(0, $totalServices - $activeServices);

        // 4. Appointment Aggregates (single conditional aggregate pass — avoids repeated full scans)
        $totalAppointments = 0;
        $pendingAppointments = 0;
        $confirmedAppointments = 0;
        $upcomingAppointments = 0;
        $completedAppointments = 0;
        $cancelledAppointments = 0;
        $rejectedAppointments = 0;
        $todayAppointments = 0;

        try {
            $apptStmt = $pdo->prepare("
                SELECT
                    COUNT(*) AS total_appointments,
                    COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_appointments,
                    COALESCE(SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END), 0) AS confirmed_appointments,
                    COALESCE(SUM(CASE WHEN status IN ('PENDING', 'CONFIRMED') AND start_at >= :now_str THEN 1 ELSE 0 END), 0) AS upcoming_appointments,
                    COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_appointments,
                    COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelled_appointments,
                    COALESCE(SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END), 0) AS rejected_appointments,
                    COALESCE(SUM(CASE WHEN start_at >= :today_start AND start_at <= :today_end THEN 1 ELSE 0 END), 0) AS today_appointments
                FROM appointments
            ");
            $apptStmt->execute([
                ':now_str' => $nowStr,
                ':today_start' => $todayStart,
                ':today_end' => $todayEnd,
            ]);
            $row = $apptStmt->fetch(PDO::FETCH_ASSOC) ?: [];

            $totalAppointments = (int) ($row['total_appointments'] ?? 0);
            $pendingAppointments = (int) ($row['pending_appointments'] ?? 0);
            $confirmedAppointments = (int) ($row['confirmed_appointments'] ?? 0);
            $upcomingAppointments = (int) ($row['upcoming_appointments'] ?? 0);
            $completedAppointments = (int) ($row['completed_appointments'] ?? 0);
            $cancelledAppointments = (int) ($row['cancelled_appointments'] ?? 0);
            $rejectedAppointments = (int) ($row['rejected_appointments'] ?? 0);
            $todayAppointments = (int) ($row['today_appointments'] ?? 0);
        } catch (\Throwable $e) {
            // Appointments table may be unmigrated in isolated unit tests
        }

        // 5. Recent Activity & Operational Queues
        $recentPatients = $pdo->query('
            SELECT p.id, p.first_name, p.last_name, p.created_at, u.email
            FROM patients p
            INNER JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC, p.id DESC
            LIMIT 5
        ')->fetchAll(PDO::FETCH_ASSOC);

        $recentServices = $pdo->query('
            SELECT id, name, category, price, duration_minutes, is_active, created_at
            FROM services
            ORDER BY created_at DESC, id DESC
            LIMIT 5
        ')->fetchAll(PDO::FETCH_ASSOC);

        // 6. Today's Schedule (Asia/Manila day bounds)
        $todaySchedule = [];
        try {
            $schedStmt = $pdo->prepare("
                SELECT
                    a.id, a.start_at, a.end_at, a.status,
                    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
                    CONCAT('Dr. ', d.first_name, ' ', d.last_name) AS dentist_name,
                    s.name AS service_name,
                    s.duration_minutes
                FROM appointments a
                INNER JOIN patients p ON a.patient_id = p.id
                INNER JOIN dentists d ON a.dentist_id = d.id
                INNER JOIN services s ON a.service_id = s.id
                WHERE a.start_at >= ? AND a.start_at <= ?
                ORDER BY a.start_at ASC, a.id ASC
                LIMIT 10
            ");
            $schedStmt->execute([$todayStart, $todayEnd]);
            $todaySchedule = $schedStmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\Throwable $e) {
            $todaySchedule = [];
        }

        // 7. Review Queue Peek (Pending Triage)
        $reviewQueuePeek = [];
        try {
            $reviewStmt = $pdo->query("
                SELECT
                    a.id, a.start_at, a.created_at, a.status,
                    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
                    CONCAT('Dr. ', d.first_name, ' ', d.last_name) AS dentist_name,
                    s.name AS service_name
                FROM appointments a
                INNER JOIN patients p ON a.patient_id = p.id
                INNER JOIN dentists d ON a.dentist_id = d.id
                INNER JOIN services s ON a.service_id = s.id
                WHERE a.status = 'PENDING'
                ORDER BY a.created_at ASC, a.id ASC
                LIMIT 5
            ");
            $reviewQueuePeek = $reviewStmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\Throwable $e) {
            $reviewQueuePeek = [];
        }

        // 8. 14-Day Real Appointment Trend (Clinic-local dates)
        $appointmentTrends = $this->getAppointmentTrends($now, 14);

        // 9. Recent Administrative and Clinical Activity (from append-only audit_logs)
        $recentActivity = [];
        try {
            $activityStmt = $pdo->query('
                SELECT
                    al.id, al.action, al.target_type, al.target_id,
                    al.ip_address, al.sanitized_payload, al.created_at,
                    u.email AS actor_email, u.role AS actor_role
                FROM audit_logs al
                LEFT JOIN users u ON al.actor_user_id = u.id
                ORDER BY al.created_at DESC, al.id DESC
                LIMIT 8
            ');
            $recentActivity = $activityStmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($recentActivity as &$act) {
                if (!empty($act['sanitized_payload'])) {
                    $act['payload'] = json_decode((string) $act['sanitized_payload'], true);
                } else {
                    $act['payload'] = null;
                }
            }
            unset($act);
        } catch (\Throwable $e) {
            $recentActivity = [];
        }

        // 10. System Alerts
        $unverifiedCount = 0;
        $recentSecurityAlerts = 0;
        $activeRateLimits = 0;
        try {
            $unverifiedCount = (int) $pdo->query('SELECT COUNT(*) FROM users WHERE email_verified = 0')->fetchColumn();
            $secStmt = $pdo->prepare("
                SELECT COUNT(*) FROM audit_logs
                WHERE action IN ('AUTH_LOGIN_FAILED', 'AUTH_LOGIN_RATE_LIMITED', 'AUTH_LOGIN_BLOCKED')
                AND created_at >= ?
            ");
            $secStmt->execute([$now->modify('-24 hours')->format('Y-m-d H:i:s')]);
            $recentSecurityAlerts = (int) $secStmt->fetchColumn();

            $rateStmt = $pdo->prepare('SELECT COUNT(*) FROM rate_limits WHERE reset_at > ?');
            $rateStmt->execute([$nowStr]);
            $activeRateLimits = (int) $rateStmt->fetchColumn();
        } catch (\Throwable $e) {
            // Safe fallback
        }

        // 11. Outbox Delivery Summary (Email + Realtime)
        $outboxSummary = $this->getOutboxSummary();

        // 12. Recent Safe Operational Errors
        $recentErrors = $this->getOperationalErrors(1, 5)['items'];

        return [
            'counts' => [
                'patients' => [
                    'total' => $totalPatients,
                    'active' => $activePatients,
                    'inactive' => max(0, $totalPatients - $activePatients),
                ],
                'dentists' => [
                    'total' => $totalDentists,
                    'active' => $activeDentists,
                    'inactive' => $inactiveDentists,
                ],
                'services' => [
                    'total' => $totalServices,
                    'active' => $activeServices,
                    'inactive' => $inactiveServices,
                ],
                'appointments' => [
                    'total' => $totalAppointments,
                    'pending' => $pendingAppointments,
                    'confirmed' => $confirmedAppointments,
                    'upcoming' => $upcomingAppointments,
                    'completed' => $completedAppointments,
                    'cancelled' => $cancelledAppointments,
                    'rejected' => $rejectedAppointments,
                    'today' => $todayAppointments,
                ],
            ],
            'appointment_trends' => $appointmentTrends,
            'recent' => [
                'patients' => $recentPatients,
                'services' => $recentServices,
            ],
            'today_schedule' => $todaySchedule,
            'review_queue_peek' => $reviewQueuePeek,
            'recent_activity' => $recentActivity,
            'outbox_summary' => $outboxSummary,
            'recent_errors' => $recentErrors,
            'system_alerts' => [
                'pending_triage' => $pendingAppointments,
                'unverified_users' => $unverifiedCount,
                'recent_security_events' => $recentSecurityAlerts,
                'active_rate_limits' => $activeRateLimits,
                'failed_outbox_jobs' => $outboxSummary['totals']['failed'],
            ],
            'timezone' => 'Asia/Manila',
            'generated_at' => $now->format('c'),
        ];
    }

    /**
     * Real daily appointment counts over the last N clinic-local days.
     *
     * @return list<array<string, mixed>>
     */
    private function getAppointmentTrends(DateTimeImmutable $now, int $days = 14): array
    {
        $pdo = $this->database->getConnection();
        $startDate = $now->modify('-' . ($days - 1) . ' days')->format('Y-m-d');
        $endDate = $now->format('Y-m-d');

        $rows = [];
        try {
            $stmt = $pdo->prepare("
                SELECT
                    SUBSTR(start_at, 1, 10) AS date,
                    COUNT(*) AS total,
                    COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending,
                    COALESCE(SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END), 0) AS confirmed,
                    COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed,
                    COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelled
                FROM appointments
                WHERE start_at >= :start_at AND start_at <= :end_at
                GROUP BY SUBSTR(start_at, 1, 10)
                ORDER BY date ASC
            ");
            $stmt->execute([
                ':start_at' => $startDate . ' 00:00:00',
                ':end_at' => $endDate . ' 23:59:59',
            ]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $rows[(string) $r['date']] = [
                    'date' => (string) $r['date'],
                    'total' => (int) $r['total'],
                    'pending' => (int) $r['pending'],
                    'confirmed' => (int) $r['confirmed'],
                    'completed' => (int) $r['completed'],
                    'cancelled' => (int) $r['cancelled'],
                ];
            }
        } catch (\Throwable $e) {
            return [];
        }

        $series = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $d = $now->modify("-{$i} days")->format('Y-m-d');
            $series[] = $rows[$d] ?? [
                'date' => $d,
                'total' => 0,
                'pending' => 0,
                'confirmed' => 0,
                'completed' => 0,
                'cancelled' => 0,
            ];
        }

        return $series;
    }

    /**
     * Unified read-only summary across email_outbox and realtime_outbox.
     *
     * @return array<string, mixed>
     */
    public function getOutboxSummary(): array
    {
        $pdo = $this->database->getConnection();

        $email = [
            'pending' => 0,
            'processing' => 0,
            'sent' => 0,
            'retry_scheduled' => 0,
            'failed' => 0,
            'abandoned' => 0,
        ];
        try {
            $stmt = $pdo->query('SELECT status, COUNT(*) AS cnt FROM email_outbox GROUP BY status');
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $k = strtolower((string) $r['status']);
                if (array_key_exists($k, $email)) {
                    $email[$k] = (int) $r['cnt'];
                }
            }
        } catch (\Throwable $e) {
            // Table may not exist in minimal test fixtures
        }

        $realtime = [
            'pending' => 0,
            'processing' => 0,
            'published' => 0,
            'failed_retryable' => 0,
            'failed_permanent' => 0,
        ];
        try {
            $stmt = $pdo->query('SELECT status, COUNT(*) AS cnt FROM realtime_outbox GROUP BY status');
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $k = strtolower((string) $r['status']);
                if (array_key_exists($k, $realtime)) {
                    $realtime[$k] = (int) $r['cnt'];
                }
            }
        } catch (\Throwable $e) {
            // Table may not exist in minimal test fixtures
        }

        $pendingTotal = $email['pending'] + $email['retry_scheduled'] + $realtime['pending'] + $realtime['failed_retryable'];
        $processingTotal = $email['processing'] + $realtime['processing'];
        $completedTotal = $email['sent'] + $realtime['published'];
        $failedTotal = $email['failed'] + $email['abandoned'] + $realtime['failed_permanent'];

        return [
            'email_outbox' => $email,
            'realtime_outbox' => $realtime,
            'totals' => [
                'pending' => $pendingTotal,
                'processing' => $processingTotal,
                'completed' => $completedTotal,
                'failed' => $failedTotal,
            ],
        ];
    }

    /**
     * Paginated list of outbox jobs (email or realtime) with safe, redacted metadata only.
     *
     * @return array{items: list<array<string, mixed>>, meta: array<string, int>, summary: array<string, mixed>}
     */
    public function getOutboxJobs(string $channel = 'email', ?string $status = null, int $page = 1, int $perPage = 20): array
    {
        $pdo = $this->database->getConnection();
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $offset = ($page - 1) * $perPage;
        $summary = $this->getOutboxSummary();

        $channel = strtolower(trim($channel));
        if ($channel === 'realtime') {
            $where = ['1=1'];
            $params = [];
            if ($status !== null && $status !== '') {
                $where[] = 'status = :status';
                $params[':status'] = strtoupper($status);
            }
            $whereSql = implode(' AND ', $where);

            try {
                $countStmt = $pdo->prepare("SELECT COUNT(*) FROM realtime_outbox WHERE {$whereSql}");
                $countStmt->execute($params);
                $total = (int) $countStmt->fetchColumn();

                $stmt = $pdo->prepare("
                    SELECT id, event_id, event_type, notification_id, recipient_user_id,
                           status, attempt_count, max_attempts, available_at,
                           created_at, published_at, last_error
                    FROM realtime_outbox
                    WHERE {$whereSql}
                    ORDER BY created_at DESC, id DESC
                    LIMIT :limit OFFSET :offset
                ");
                foreach ($params as $k => $v) {
                    $stmt->bindValue($k, $v);
                }
                $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
                $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
                $stmt->execute();
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                foreach ($rows as &$r) {
                    $r['channel'] = 'realtime';
                    $r['last_error'] = $this->sanitizeErrorSummary($r['last_error'] ?? null);
                }
                unset($r);
            } catch (\Throwable $e) {
                $total = 0;
                $rows = [];
            }

            return [
                'items' => $rows,
                'meta' => [
                    'total' => $total,
                    'page' => $page,
                    'per_page' => $perPage,
                    'last_page' => $total > 0 ? (int) ceil($total / $perPage) : 1,
                ],
                'summary' => $summary,
            ];
        }

        // Default: email outbox (redacted — never expose raw encrypted/HTML payload)
        $where = ['1=1'];
        $params = [];
        if ($status !== null && $status !== '') {
            $where[] = 'status = :status';
            $params[':status'] = strtoupper($status);
        }
        $whereSql = implode(' AND ', $where);

        try {
            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM email_outbox WHERE {$whereSql}");
            $countStmt->execute($params);
            $total = (int) $countStmt->fetchColumn();

            $stmt = $pdo->prepare("
                SELECT id, event_key, template_name, status, attempt_count, max_attempts,
                       next_attempt_at, sent_at, created_at, updated_at, last_error
                FROM email_outbox
                WHERE {$whereSql}
                ORDER BY created_at DESC, id DESC
                LIMIT :limit OFFSET :offset
            ");
            foreach ($params as $k => $v) {
                $stmt->bindValue($k, $v);
            }
            $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as &$r) {
                $r['channel'] = 'email';
                $r['last_error'] = $this->sanitizeErrorSummary($r['last_error'] ?? null);
            }
            unset($r);
        } catch (\Throwable $e) {
            $total = 0;
            $rows = [];
        }

        return [
            'items' => $rows,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'last_page' => $total > 0 ? (int) ceil($total / $perPage) : 1,
            ],
            'summary' => $summary,
        ];
    }

    /**
     * Paginated safe operational errors aggregated from failed outbox deliveries
     * and security/system failure audit records (no stack traces, credentials, or clinical notes).
     *
     * @return array{items: list<array<string, mixed>>, meta: array<string, int>}
     */
    public function getOperationalErrors(int $page = 1, int $perPage = 20): array
    {
        $pdo = $this->database->getConnection();
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $events = [];

        // 1. Failed/Retryable email outbox jobs (bounded slice)
        try {
            $stmt = $pdo->query("
                SELECT id, event_key, template_name, status, attempt_count, last_error, updated_at, created_at
                FROM email_outbox
                WHERE status IN ('FAILED', 'RETRY_SCHEDULED', 'ABANDONED')
                ORDER BY updated_at DESC, id DESC
                LIMIT 100
            ");
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $events[] = [
                    'id' => 'email-' . $row['id'],
                    'timestamp' => (string) ($row['updated_at'] ?: $row['created_at']),
                    'severity' => $row['status'] === 'RETRY_SCHEDULED' ? 'WARNING' : 'ERROR',
                    'module' => 'email_outbox',
                    'correlation_id' => (string) ($row['event_key'] ?? ('email-' . $row['id'])),
                    'summary' => $this->sanitizeErrorSummary($row['last_error'] ?? ('Email delivery ' . strtolower((string) $row['status']))),
                    'resolution_status' => (string) $row['status'],
                ];
            }
        } catch (\Throwable $e) {
            // Optional table
        }

        // 2. Failed realtime outbox jobs (bounded slice)
        try {
            $stmt = $pdo->query("
                SELECT id, event_id, event_type, status, attempt_count, last_error, created_at
                FROM realtime_outbox
                WHERE status IN ('FAILED_RETRYABLE', 'FAILED_PERMANENT')
                ORDER BY created_at DESC, id DESC
                LIMIT 100
            ");
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $events[] = [
                    'id' => 'realtime-' . $row['id'],
                    'timestamp' => (string) $row['created_at'],
                    'severity' => $row['status'] === 'FAILED_RETRYABLE' ? 'WARNING' : 'ERROR',
                    'module' => 'realtime_outbox',
                    'correlation_id' => (string) ($row['event_id'] ?? ('realtime-' . $row['id'])),
                    'summary' => $this->sanitizeErrorSummary($row['last_error'] ?? ('Realtime publish ' . strtolower((string) $row['status']))),
                    'resolution_status' => (string) $row['status'],
                ];
            }
        } catch (\Throwable $e) {
            // Optional table
        }

        // 3. Security & Access-Control Failure Audit Events (bounded slice)
        try {
            $stmt = $pdo->query("
                SELECT id, action, target_type, target_id, created_at
                FROM audit_logs
                WHERE action IN (
                    'AUTH_LOGIN_RATE_LIMITED',
                    'AUTH_LOGIN_BLOCKED',
                    'UNAUTHORIZED_APPOINTMENT_ACCESS_ATTEMPT',
                    'ADMIN_LOCKOUT_PREVENTED'
                )
                ORDER BY created_at DESC, id DESC
                LIMIT 100
            ");
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $events[] = [
                    'id' => 'audit-' . $row['id'],
                    'timestamp' => (string) $row['created_at'],
                    'severity' => 'WARNING',
                    'module' => (string) ($row['target_type'] ?: 'security'),
                    'correlation_id' => 'audit-' . $row['id'],
                    'summary' => sprintf('%s on %s%s', $row['action'], $row['target_type'], $row['target_id'] ? (' #' . $row['target_id']) : ''),
                    'resolution_status' => 'LOGGED',
                ];
            }
        } catch (\Throwable $e) {
            // Optional table
        }

        usort($events, static function (array $a, array $b): int {
            $cmp = strcmp($b['timestamp'], $a['timestamp']);
            return $cmp !== 0 ? $cmp : strcmp($b['id'], $a['id']);
        });

        $total = count($events);
        $offset = ($page - 1) * $perPage;
        $paged = array_slice($events, $offset, $perPage);

        return [
            'items' => $paged,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'last_page' => $total > 0 ? (int) ceil($total / $perPage) : 1,
            ],
        ];
    }

    /**
     * Strip potential file paths, credentials, tokens, or stack traces from error summaries.
     */
    private function sanitizeErrorSummary(?string $message): ?string
    {
        if ($message === null || trim($message) === '') {
            return null;
        }

        $clean = preg_replace('/\s+/', ' ', trim($message)) ?? '';
        // Strip stack traces
        $clean = preg_replace('/\bStack trace:.*$/i', '', $clean) ?? $clean;
        // Redact filesystem paths (Windows & Unix)
        $clean = preg_replace('/([A-Za-z]:\\\\[^\s]+|\/(?:var|home|usr|etc|app|xampp)\/[^\s]+)/', '[path-redacted]', $clean) ?? $clean;
        // Redact key=value secrets
        $clean = preg_replace('/\b(password|passwd|secret|token|authorization|api_key)\s*[:=]\s*\S+/i', '$1=[redacted]', $clean) ?? $clean;

        return mb_substr(trim($clean), 0, 220);
    }
}
