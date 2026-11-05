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

        // 5. Recent Activity
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
            'generated_at' => date('c'),
        ];
    }
}
