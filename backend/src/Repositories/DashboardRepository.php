<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Administrative Dashboard Repository
 * Computes real-time MySQL aggregate metrics, counts, and recent activity streams.
 */
class DashboardRepository
{
    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Compute comprehensive clinic operational aggregates.
     *
     * @return array<string, mixed>
     */
    public function getMetrics(): array
    {
        $pdo = $this->database->getConnection();

        // 1. Patient Aggregates
        $totalPatients = (int) $pdo->query('SELECT COUNT(*) FROM patients')->fetchColumn();
        $activePatients = (int) $pdo->query('
            SELECT COUNT(*) 
            FROM patients p 
            INNER JOIN users u ON p.user_id = u.id 
            WHERE u.is_active = 1
        ')->fetchColumn();

        // 2. Dentist Aggregates
        $totalDentists = (int) $pdo->query('SELECT COUNT(*) FROM dentists')->fetchColumn();
        $activeDentists = (int) $pdo->query('SELECT COUNT(*) FROM dentists WHERE is_active = 1')->fetchColumn();
        $inactiveDentists = $totalDentists - $activeDentists;

        // 3. Service Aggregates
        $totalServices = (int) $pdo->query('SELECT COUNT(*) FROM services')->fetchColumn();
        $activeServices = (int) $pdo->query('SELECT COUNT(*) FROM services WHERE is_active = 1')->fetchColumn();
        $inactiveServices = $totalServices - $activeServices;

        // 4. Appointment Aggregates
        $totalAppointments = 0;
        $pendingAppointments = 0;
        $confirmedAppointments = 0;
        $completedAppointments = 0;
        $cancelledAppointments = 0;
        $todayAppointments = 0;

        try {
            $totalAppointments = (int) $pdo->query('SELECT COUNT(*) FROM appointments')->fetchColumn();
            $pendingAppointments = (int) $pdo->query("SELECT COUNT(*) FROM appointments WHERE status = 'PENDING'")->fetchColumn();
            $confirmedAppointments = (int) $pdo->query("SELECT COUNT(*) FROM appointments WHERE status = 'CONFIRMED'")->fetchColumn();
            $completedAppointments = (int) $pdo->query("SELECT COUNT(*) FROM appointments WHERE status = 'COMPLETED'")->fetchColumn();
            $cancelledAppointments = (int) $pdo->query("SELECT COUNT(*) FROM appointments WHERE status = 'CANCELLED'")->fetchColumn();

            $today = date('Y-m-d');
            $todayStmt = $pdo->prepare('SELECT COUNT(*) FROM appointments WHERE start_at >= ? AND start_at <= ?');
            $todayStmt->execute([$today . ' 00:00:00', $today . ' 23:59:59']);
            $todayAppointments = (int) $todayStmt->fetchColumn();
        } catch (\Throwable $e) {
            // Appointments table may be empty or unmigrated in isolated unit tests
        }

        // 5. Recent Activity & Operational Queues
        $recentPatients = $pdo->query('
            SELECT p.id, p.first_name, p.last_name, p.created_at, u.email
            FROM patients p
            INNER JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
            LIMIT 5
        ')->fetchAll(PDO::FETCH_ASSOC);

        $recentServices = $pdo->query('
            SELECT id, name, category, price, duration_minutes, is_active, created_at
            FROM services
            ORDER BY created_at DESC
            LIMIT 5
        ')->fetchAll(PDO::FETCH_ASSOC);

        // 6. Today\'s Schedule
        $todaySchedule = [];
        try {
            $schedStmt = $pdo->prepare('
                SELECT 
                    a.id, a.start_at, a.end_at, a.status,
                    CONCAT(p.first_name, \' \', p.last_name) AS patient_name,
                    CONCAT(\'Dr. \', d.first_name, \' \', d.last_name) AS dentist_name,
                    s.name AS service_name,
                    s.duration_minutes
                FROM appointments a
                INNER JOIN patients p ON a.patient_id = p.id
                INNER JOIN dentists d ON a.dentist_id = d.id
                INNER JOIN services s ON a.service_id = s.id
                WHERE a.start_at >= ? AND a.start_at <= ?
                ORDER BY a.start_at ASC
                LIMIT 10
            ');
            $schedStmt->execute([$today . ' 00:00:00', $today . ' 23:59:59']);
            $todaySchedule = $schedStmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\Throwable $e) {
            $todaySchedule = [];
        }

        // 7. Review Queue Peek (Pending Triage)
        $reviewQueuePeek = [];
        try {
            $reviewStmt = $pdo->query('
                SELECT 
                    a.id, a.start_at, a.created_at, a.status,
                    CONCAT(p.first_name, \' \', p.last_name) AS patient_name,
                    CONCAT(\'Dr. \', d.first_name, \' \', d.last_name) AS dentist_name,
                    s.name AS service_name
                FROM appointments a
                INNER JOIN patients p ON a.patient_id = p.id
                INNER JOIN dentists d ON a.dentist_id = d.id
                INNER JOIN services s ON a.service_id = s.id
                WHERE a.status = \'PENDING\'
                ORDER BY a.created_at ASC
                LIMIT 5
            ');
            $reviewQueuePeek = $reviewStmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\Throwable $e) {
            $reviewQueuePeek = [];
        }

        // 8. Recent Administrative and Clinical Activity (from audit_logs)
        $recentActivity = [];
        try {
            $activityStmt = $pdo->query('
                SELECT 
                    al.id, al.action, al.target_type, al.target_id, 
                    al.ip_address, al.sanitized_payload, al.created_at,
                    u.email AS actor_email, u.role AS actor_role
                FROM audit_logs al
                LEFT JOIN users u ON al.actor_user_id = u.id
                ORDER BY al.created_at DESC
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

        // 9. System Alerts
        $unverifiedCount = 0;
        $recentSecurityAlerts = 0;
        $activeRateLimits = 0;
        try {
            $unverifiedCount = (int) $pdo->query('SELECT COUNT(*) FROM users WHERE email_verified = 0')->fetchColumn();
            $secStmt = $pdo->prepare('
                SELECT COUNT(*) FROM audit_logs 
                WHERE action IN (\'AUTH_LOGIN_FAILED\', \'AUTH_LOGIN_RATE_LIMITED\', \'AUTH_LOGIN_BLOCKED\')
                AND created_at >= ?
            ');
            $secStmt->execute([date('Y-m-d H:i:s', time() - 86400)]);
            $recentSecurityAlerts = (int) $secStmt->fetchColumn();

            $rateStmt = $pdo->prepare('SELECT COUNT(*) FROM rate_limits WHERE reset_at > ?');
            $rateStmt->execute([date('Y-m-d H:i:s')]);
            $activeRateLimits = (int) $rateStmt->fetchColumn();
        } catch (\Throwable $e) {
            // Safe fallback
        }

        return [
            'counts' => [
                'patients' => [
                    'total' => $totalPatients,
                    'active' => $activePatients,
                    'inactive' => $totalPatients - $activePatients,
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
                    'completed' => $completedAppointments,
                    'cancelled' => $cancelledAppointments,
                    'today' => $todayAppointments,
                ],
            ],
            'recent' => [
                'patients' => $recentPatients,
                'services' => $recentServices,
            ],
            'today_schedule' => $todaySchedule,
            'review_queue_peek' => $reviewQueuePeek,
            'recent_activity' => $recentActivity,
            'system_alerts' => [
                'pending_triage' => $pendingAppointments,
                'unverified_users' => $unverifiedCount,
                'recent_security_events' => $recentSecurityAlerts,
                'active_rate_limits' => $activeRateLimits,
            ],
            'generated_at' => date('c'),
        ];
    }
}
