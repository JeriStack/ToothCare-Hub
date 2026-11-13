<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthorizationMiddleware;
use PDO;

/**
 * Administrative Reports and Analytics Controller
 */
class ReportController
{
    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * GET /api/v1/admin/reports/appointments
     * Appointment volume metrics, status distributions, and daily breakdown
     */
    public function appointments(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'reports.view', ['ADMIN']);
        $pdo = $this->database->getConnection();

        $startDate = $request->getQuery('start_date') ?? date('Y-m-d', strtotime('-30 days'));
        $endDate = $request->getQuery('end_date') ?? date('Y-m-d');

        // Status counts in window
        $stmt = $pdo->prepare('
            SELECT status, COUNT(*) as count
            FROM appointments
            WHERE start_at >= ? AND start_at <= ?
            GROUP BY status
        ');
        $stmt->execute([$startDate . ' 00:00:00', $endDate . ' 23:59:59']);
        $statusCounts = $stmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        // Daily volume breakdown
        $dailyStmt = $pdo->prepare('
            SELECT DATE(start_at) as date, status, COUNT(*) as count
            FROM appointments
            WHERE start_at >= ? AND start_at <= ?
            GROUP BY DATE(start_at), status
            ORDER BY DATE(start_at) ASC
        ');
        $dailyStmt->execute([$startDate . ' 00:00:00', $endDate . ' 23:59:59']);
        $dailyRows = $dailyStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $total = array_sum($statusCounts);
        $completed = $statusCounts['COMPLETED'] ?? 0;
        $cancelled = $statusCounts['CANCELLED'] ?? 0;
        $completionRate = $total > 0 ? round(($completed / $total) * 100, 1) : 0;
        $cancellationRate = $total > 0 ? round(($cancelled / $total) * 100, 1) : 0;

        return Response::success([
            'date_range' => ['start_date' => $startDate, 'end_date' => $endDate],
            'total_appointments' => $total,
            'completion_rate' => $completionRate,
            'cancellation_rate' => $cancellationRate,
            'status_distribution' => $statusCounts,
            'daily_timeline' => $dailyRows,
        ]);
    }

    /**
     * GET /api/v1/admin/reports/revenue
     * Revenue and procedure catalog performance analytics
     */
    public function revenue(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'reports.view', ['ADMIN']);
        $pdo = $this->database->getConnection();

        $startDate = $request->getQuery('start_date') ?? date('Y-m-d', strtotime('-30 days'));
        $endDate = $request->getQuery('end_date') ?? date('Y-m-d');

        $stmt = $pdo->prepare('
            SELECT 
                s.id, s.name, s.category, s.price,
                COUNT(a.id) AS total_booked,
                SUM(CASE WHEN a.status = \'COMPLETED\' THEN 1 ELSE 0 END) AS completed_count,
                SUM(CASE WHEN a.status = \'COMPLETED\' THEN s.price ELSE 0 END) AS realized_revenue,
                SUM(s.price) AS potential_revenue
            FROM services s
            LEFT JOIN appointments a ON s.id = a.service_id 
                AND a.start_at >= ? AND a.start_at <= ?
            GROUP BY s.id, s.name, s.category, s.price
            ORDER BY realized_revenue DESC
        ');
        $stmt->execute([$startDate . ' 00:00:00', $endDate . ' 23:59:59']);
        $services = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $totalRealized = 0;
        $totalPotential = 0;
        foreach ($services as &$s) {
            $s['price'] = (float) $s['price'];
            $s['total_booked'] = (int) $s['total_booked'];
            $s['completed_count'] = (int) $s['completed_count'];
            $s['realized_revenue'] = (float) ($s['realized_revenue'] ?? 0);
            $s['potential_revenue'] = (float) ($s['potential_revenue'] ?? 0);
            $totalRealized += $s['realized_revenue'];
            $totalPotential += $s['potential_revenue'];
        }
        unset($s);

        return Response::success([
            'date_range' => ['start_date' => $startDate, 'end_date' => $endDate],
            'total_realized_revenue' => $totalRealized,
            'total_potential_revenue' => $totalPotential,
            'services' => $services,
        ]);
    }

    /**
     * GET /api/v1/admin/reports/dentists
     * Clinical provider workload and completed appointment distributions
     */
    public function dentists(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'reports.view', ['ADMIN']);
        $pdo = $this->database->getConnection();

        $startDate = $request->getQuery('start_date') ?? date('Y-m-d', strtotime('-30 days'));
        $endDate = $request->getQuery('end_date') ?? date('Y-m-d');

        $stmt = $pdo->prepare('
            SELECT 
                d.id, d.first_name, d.last_name, d.specialization, d.is_active,
                COUNT(a.id) AS total_assigned,
                SUM(CASE WHEN a.status = \'COMPLETED\' THEN 1 ELSE 0 END) AS completed_count,
                SUM(CASE WHEN a.status = \'CONFIRMED\' THEN 1 ELSE 0 END) AS confirmed_count,
                SUM(CASE WHEN a.status = \'CANCELLED\' THEN 1 ELSE 0 END) AS cancelled_count
            FROM dentists d
            LEFT JOIN appointments a ON d.id = a.dentist_id
                AND a.start_at >= ? AND a.start_at <= ?
            GROUP BY d.id, d.first_name, d.last_name, d.specialization, d.is_active
            ORDER BY completed_count DESC
        ');
        $stmt->execute([$startDate . ' 00:00:00', $endDate . ' 23:59:59']);
        $dentists = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        foreach ($dentists as &$d) {
            $d['first_name'] = (string) $d['first_name'];
            $d['last_name'] = (string) $d['last_name'];
            $d['total_assigned'] = (int) $d['total_assigned'];
            $d['completed_count'] = (int) $d['completed_count'];
            $d['confirmed_count'] = (int) $d['confirmed_count'];
            $d['cancelled_count'] = (int) $d['cancelled_count'];
        }
        unset($d);

        return Response::success([
            'date_range' => ['start_date' => $startDate, 'end_date' => $endDate],
            'dentists' => $dentists,
        ]);
    }
}
