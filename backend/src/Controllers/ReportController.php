<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthorizationMiddleware;
use DateTimeImmutable;
use DateTimeZone;
use PDO;

/**
 * Administrative Reports and Analytics Controller
 * Database-driven operational reports using explicit Asia/Manila date boundaries.
 */
class ReportController
{
    private Database $database;
    private DateTimeZone $timezone;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
        $this->timezone = new DateTimeZone('Asia/Manila');
    }

    /**
     * Validate and resolve inclusive [start_date, end_date] range in Asia/Manila timezone.
     *
     * @return array{start_date: string, end_date: string, start_at: string, end_at: string, now_str: string}
     */
    private function resolveDateRange(Request $request): array
    {
        $now = new DateTimeImmutable('now', $this->timezone);
        $rawStart = $request->getQuery('start_date');
        $rawEnd = $request->getQuery('end_date');

        $startDate = (is_string($rawStart) && trim($rawStart) !== '')
            ? trim($rawStart)
            : $now->modify('-30 days')->format('Y-m-d');
        $endDate = (is_string($rawEnd) && trim($rawEnd) !== '')
            ? trim($rawEnd)
            : $now->format('Y-m-d');

        $startObj = DateTimeImmutable::createFromFormat('!Y-m-d', $startDate, $this->timezone);
        if (!$startObj || $startObj->format('Y-m-d') !== $startDate) {
            throw HttpException::unprocessableEntity('Invalid start_date format. Expected YYYY-MM-DD.', [
                'start_date' => ['start_date must be a valid date in YYYY-MM-DD format.'],
            ]);
        }

        $endObj = DateTimeImmutable::createFromFormat('!Y-m-d', $endDate, $this->timezone);
        if (!$endObj || $endObj->format('Y-m-d') !== $endDate) {
            throw HttpException::unprocessableEntity('Invalid end_date format. Expected YYYY-MM-DD.', [
                'end_date' => ['end_date must be a valid date in YYYY-MM-DD format.'],
            ]);
        }

        if ($endObj < $startObj) {
            throw HttpException::unprocessableEntity('end_date cannot be earlier than start_date.', [
                'end_date' => ['end_date must be on or after start_date.'],
            ]);
        }

        return [
            'start_date' => $startDate,
            'end_date' => $endDate,
            'start_at' => $startDate . ' 00:00:00',
            'end_at' => $endDate . ' 23:59:59',
            'now_str' => $now->format('Y-m-d H:i:s'),
        ];
    }

    /**
     * GET /api/v1/admin/reports/appointments
     * Appointment volume metrics, status distributions, daily breakdown, and optional filterable appointment list
     * by date, dentist, service, and status.
     */
    public function appointments(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'reports.view', ['ADMIN']);
        $pdo = $this->database->getConnection();
        $range = $this->resolveDateRange($request);

        $whereClauses = ['a.start_at >= :start_at', 'a.start_at <= :end_at'];
        $params = [
            ':start_at' => $range['start_at'],
            ':end_at' => $range['end_at'],
        ];

        $appliedFilters = [
            'start_date' => $range['start_date'],
            'end_date' => $range['end_date'],
            'dentist_id' => null,
            'service_id' => null,
            'patient_id' => null,
            'status' => null,
            'search' => null,
        ];

        // Optional filter: dentist_id
        $rawDentistId = $request->getQuery('dentist_id');
        if ($rawDentistId !== null && trim((string) $rawDentistId) !== '') {
            $dentistStr = trim((string) $rawDentistId);
            if (!ctype_digit($dentistStr) || (int) $dentistStr <= 0) {
                throw HttpException::unprocessableEntity('Invalid dentist_id filter.', [
                    'dentist_id' => ['dentist_id must be a positive integer.'],
                ]);
            }
            $dentistId = (int) $dentistStr;
            $whereClauses[] = 'a.dentist_id = :dentist_id';
            $params[':dentist_id'] = $dentistId;
            $appliedFilters['dentist_id'] = $dentistId;
        }

        // Optional filter: service_id
        $rawServiceId = $request->getQuery('service_id');
        if ($rawServiceId !== null && trim((string) $rawServiceId) !== '') {
            $serviceStr = trim((string) $rawServiceId);
            if (!ctype_digit($serviceStr) || (int) $serviceStr <= 0) {
                throw HttpException::unprocessableEntity('Invalid service_id filter.', [
                    'service_id' => ['service_id must be a positive integer.'],
                ]);
            }
            $serviceId = (int) $serviceStr;
            $whereClauses[] = 'a.service_id = :service_id';
            $params[':service_id'] = $serviceId;
            $appliedFilters['service_id'] = $serviceId;
        }

        // Optional filter: patient_id
        $rawPatientId = $request->getQuery('patient_id');
        if ($rawPatientId !== null && trim((string) $rawPatientId) !== '') {
            $patientStr = trim((string) $rawPatientId);
            if (!ctype_digit($patientStr) || (int) $patientStr <= 0) {
                throw HttpException::unprocessableEntity('Invalid patient_id filter.', [
                    'patient_id' => ['patient_id must be a positive integer.'],
                ]);
            }
            $patientId = (int) $patientStr;
            $whereClauses[] = 'a.patient_id = :patient_id';
            $params[':patient_id'] = $patientId;
            $appliedFilters['patient_id'] = $patientId;
        }

        // Optional filter: status
        $rawStatus = $request->getQuery('status');
        if ($rawStatus !== null && trim((string) $rawStatus) !== '') {
            $status = strtoupper(trim((string) $rawStatus));
            if ($status !== 'ALL') {
                $validStatuses = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'];
                if (!in_array($status, $validStatuses, true)) {
                    throw HttpException::unprocessableEntity('Invalid status filter.', [
                        'status' => ['status must be one of: ' . implode(', ', $validStatuses)],
                    ]);
                }
                $whereClauses[] = 'a.status = :status';
                $params[':status'] = $status;
                $appliedFilters['status'] = $status;
            }
        }

        // Optional filter: search (patient name)
        $rawSearch = $request->getQuery('search');
        if ($rawSearch !== null && is_string($rawSearch) && trim($rawSearch) !== '') {
            $cleanSearch = mb_substr(trim($rawSearch), 0, 120);
            $escaped = str_replace(['%', '_'], ['\\%', '\\_'], $cleanSearch);
            $term = '%' . $escaped . '%';
            $whereClauses[] = 'EXISTS (SELECT 1 FROM patients p_f WHERE p_f.id = a.patient_id AND (p_f.first_name LIKE :p_search1 OR p_f.last_name LIKE :p_search2))';
            $params[':p_search1'] = $term;
            $params[':p_search2'] = $term;
            $appliedFilters['search'] = $cleanSearch;
        }

        $whereSql = implode(' AND ', $whereClauses);

        // Status counts in window (respecting dentist/service/status filters)
        $stmt = $pdo->prepare("
            SELECT a.status, COUNT(*) as count
            FROM appointments a
            WHERE {$whereSql}
            GROUP BY a.status
        ");
        $stmt->execute($params);
        $rawStatusCounts = $stmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        $statusCounts = [];
        foreach ($rawStatusCounts as $k => $v) {
            $statusCounts[(string) $k] = (int) $v;
        }

        // Upcoming appointments within selected window (respecting filters)
        $upcomingParams = $params;
        $upcomingParams[':now_str'] = $range['now_str'];
        $upcomingStmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM appointments a
            WHERE {$whereSql}
              AND a.start_at >= :now_str
              AND a.status IN ('PENDING', 'CONFIRMED')
        ");
        $upcomingStmt->execute($upcomingParams);
        $upcomingCount = (int) $upcomingStmt->fetchColumn();

        // Daily volume breakdown (SQLite & MySQL compatible SUBSTR(start_at, 1, 10))
        $dailyStmt = $pdo->prepare("
            SELECT SUBSTR(a.start_at, 1, 10) as date, a.status, COUNT(*) as count
            FROM appointments a
            WHERE {$whereSql}
            GROUP BY SUBSTR(a.start_at, 1, 10), a.status
            ORDER BY date ASC
        ");
        $dailyStmt->execute($params);
        $dailyRows = $dailyStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($dailyRows as &$row) {
            $row['count'] = (int) $row['count'];
        }
        unset($row);

        // Filterable appointment list by date, dentist, service, and status (paginated, max 100)
        $rawPage = $request->getQuery('page');
        $page = ($rawPage !== null && ctype_digit(trim((string) $rawPage))) ? max(1, (int) $rawPage) : 1;
        $rawPerPage = $request->getQuery('per_page') ?? $request->getQuery('limit') ?? 25;
        $perPage = (is_numeric($rawPerPage)) ? max(1, min(100, (int) $rawPerPage)) : 25;
        $offset = ($page - 1) * $perPage;

        $listStmt = $pdo->prepare("
            SELECT
                a.id,
                a.patient_id,
                a.dentist_id,
                a.service_id,
                a.start_at,
                a.end_at,
                a.status,
                a.duration_snapshot,
                a.price_snapshot,
                a.operatory_chair,
                p.first_name AS patient_first_name,
                p.last_name AS patient_last_name,
                d.first_name AS dentist_first_name,
                d.last_name AS dentist_last_name,
                d.specialization AS dentist_specialization,
                s.name AS service_name,
                s.category AS service_category
            FROM appointments a
            LEFT JOIN patients p ON a.patient_id = p.id
            LEFT JOIN dentists d ON a.dentist_id = d.id
            LEFT JOIN services s ON a.service_id = s.id
            WHERE {$whereSql}
            ORDER BY a.start_at DESC, a.id DESC
            LIMIT {$perPage} OFFSET {$offset}
        ");
        $listStmt->execute($params);
        $appointmentRows = $listStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($appointmentRows as &$appt) {
            $appt['id'] = (int) $appt['id'];
            $appt['patient_id'] = (int) $appt['patient_id'];
            $appt['dentist_id'] = (int) $appt['dentist_id'];
            $appt['service_id'] = (int) $appt['service_id'];
            $appt['duration_snapshot'] = (int) ($appt['duration_snapshot'] ?? 30);
            $appt['price_snapshot'] = (float) ($appt['price_snapshot'] ?? 0);
        }
        unset($appt);

        $total = array_sum($statusCounts);
        $pending = $statusCounts['PENDING'] ?? 0;
        $confirmed = $statusCounts['CONFIRMED'] ?? 0;
        $completed = $statusCounts['COMPLETED'] ?? 0;
        $cancelled = $statusCounts['CANCELLED'] ?? 0;
        $rejected = $statusCounts['REJECTED'] ?? 0;
        $completionRate = $total > 0 ? round(($completed / $total) * 100, 1) : 0.0;
        $cancellationRate = $total > 0 ? round(($cancelled / $total) * 100, 1) : 0.0;
        $lastPage = max(1, (int) ceil($total / $perPage));

        return Response::success([
            'date_range' => ['start_date' => $range['start_date'], 'end_date' => $range['end_date']],
            'filters' => $appliedFilters,
            'timezone' => 'Asia/Manila',
            'total_appointments' => $total,
            'pending_count' => $pending,
            'confirmed_count' => $confirmed,
            'upcoming_count' => $upcomingCount,
            'completed_count' => $completed,
            'cancelled_count' => $cancelled,
            'rejected_count' => $rejected,
            'completion_rate' => $completionRate,
            'cancellation_rate' => $cancellationRate,
            'status_distribution' => $statusCounts,
            'daily_timeline' => $dailyRows,
            'appointments' => $appointmentRows,
            'appointments_meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'last_page' => $lastPage,
            ],
        ]);
    }

    /**
     * GET /api/v1/admin/reports/services
     * Operational dental service utilization report (appointment counts only — no fabricated revenue)
     */
    public function services(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'reports.view', ['ADMIN']);
        $pdo = $this->database->getConnection();
        $range = $this->resolveDateRange($request);

        $stmt = $pdo->prepare("
            SELECT
                s.id, s.name, s.category, s.duration_minutes, s.is_active,
                COUNT(a.id) AS total_booked,
                COALESCE(SUM(CASE WHEN a.status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_count,
                COALESCE(SUM(CASE WHEN a.status = 'CONFIRMED' THEN 1 ELSE 0 END), 0) AS confirmed_count,
                COALESCE(SUM(CASE WHEN a.status IN ('PENDING', 'CONFIRMED') AND a.start_at >= :now_str THEN 1 ELSE 0 END), 0) AS upcoming_count,
                COALESCE(SUM(CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_count,
                COALESCE(SUM(CASE WHEN a.status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelled_count
            FROM services s
            LEFT JOIN appointments a ON s.id = a.service_id
                AND a.start_at >= :start_at AND a.start_at <= :end_at
            GROUP BY s.id, s.name, s.category, s.duration_minutes, s.is_active
            ORDER BY total_booked DESC, s.id ASC
        ");
        $stmt->execute([
            ':now_str' => $range['now_str'],
            ':start_at' => $range['start_at'],
            ':end_at' => $range['end_at'],
        ]);
        $services = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $totalBookedAll = 0;
        foreach ($services as $s) {
            $totalBookedAll += (int) $s['total_booked'];
        }

        foreach ($services as &$s) {
            $s['id'] = (int) $s['id'];
            $s['duration_minutes'] = (int) $s['duration_minutes'];
            $s['is_active'] = (bool) $s['is_active'];
            $s['total_booked'] = (int) $s['total_booked'];
            $s['pending_count'] = (int) $s['pending_count'];
            $s['confirmed_count'] = (int) $s['confirmed_count'];
            $s['upcoming_count'] = (int) $s['upcoming_count'];
            $s['completed_count'] = (int) $s['completed_count'];
            $s['cancelled_count'] = (int) $s['cancelled_count'];
            $s['utilization_share_pct'] = $totalBookedAll > 0
                ? round(($s['total_booked'] / $totalBookedAll) * 100, 1)
                : 0.0;
        }
        unset($s);

        return Response::success([
            'date_range' => ['start_date' => $range['start_date'], 'end_date' => $range['end_date']],
            'timezone' => 'Asia/Manila',
            'total_appointments' => $totalBookedAll,
            'services' => $services,
        ]);
    }

    /**
     * GET /api/v1/admin/reports/patients
     * Patient directory totals and registration trend over the selected date range
     */
    public function patients(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'reports.view', ['ADMIN']);
        $pdo = $this->database->getConnection();
        $range = $this->resolveDateRange($request);

        $totalPatients = (int) $pdo->query('SELECT COUNT(*) FROM patients')->fetchColumn();
        $activePatients = (int) $pdo->query('
            SELECT COUNT(*)
            FROM patients p
            INNER JOIN users u ON p.user_id = u.id
            WHERE u.is_active = 1
        ')->fetchColumn();

        $trendStmt = $pdo->prepare('
            SELECT SUBSTR(created_at, 1, 10) AS date, COUNT(*) AS registrations
            FROM patients
            WHERE created_at >= ? AND created_at <= ?
            GROUP BY SUBSTR(created_at, 1, 10)
            ORDER BY date ASC
        ');
        $trendStmt->execute([$range['start_at'], $range['end_at']]);
        $timeline = $trendStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $newInPeriod = 0;
        foreach ($timeline as &$row) {
            $row['registrations'] = (int) $row['registrations'];
            $newInPeriod += $row['registrations'];
        }
        unset($row);

        return Response::success([
            'date_range' => ['start_date' => $range['start_date'], 'end_date' => $range['end_date']],
            'timezone' => 'Asia/Manila',
            'total_patients' => $totalPatients,
            'active_patients' => $activePatients,
            'inactive_patients' => max(0, $totalPatients - $activePatients),
            'new_in_period' => $newInPeriod,
            'registration_timeline' => $timeline,
        ]);
    }

    /**
     * GET /api/v1/admin/reports/revenue
     * Legacy procedure catalog endpoint kept for backward compatibility.
     */
    public function revenue(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'reports.view', ['ADMIN']);
        $pdo = $this->database->getConnection();
        $range = $this->resolveDateRange($request);

        $stmt = $pdo->prepare("
            SELECT
                s.id, s.name, s.category, s.price,
                COUNT(a.id) AS total_booked,
                COALESCE(SUM(CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_count,
                COALESCE(SUM(CASE WHEN a.status = 'COMPLETED' THEN s.price ELSE 0 END), 0) AS realized_revenue,
                COALESCE(SUM(CASE WHEN a.id IS NOT NULL THEN s.price ELSE 0 END), 0) AS potential_revenue
            FROM services s
            LEFT JOIN appointments a ON s.id = a.service_id
                AND a.start_at >= ? AND a.start_at <= ?
            GROUP BY s.id, s.name, s.category, s.price
            ORDER BY realized_revenue DESC, s.id ASC
        ");
        $stmt->execute([$range['start_at'], $range['end_at']]);
        $services = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $totalRealized = 0.0;
        $totalPotential = 0.0;
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
            'date_range' => ['start_date' => $range['start_date'], 'end_date' => $range['end_date']],
            'total_realized_revenue' => $totalRealized,
            'total_potential_revenue' => $totalPotential,
            'services' => $services,
        ]);
    }

    /**
     * GET /api/v1/admin/reports/dentists
     * Clinical provider workload, upcoming workload, and completed appointment distributions
     */
    public function dentists(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'reports.view', ['ADMIN']);
        $pdo = $this->database->getConnection();
        $range = $this->resolveDateRange($request);

        $stmt = $pdo->prepare("
            SELECT
                d.id, d.first_name, d.last_name, d.specialization, d.is_active,
                COUNT(a.id) AS total_assigned,
                COALESCE(SUM(CASE WHEN a.status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_count,
                COALESCE(SUM(CASE WHEN a.status IN ('PENDING', 'CONFIRMED') AND a.start_at >= :now_str THEN 1 ELSE 0 END), 0) AS upcoming_count,
                COALESCE(SUM(CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_count,
                COALESCE(SUM(CASE WHEN a.status = 'CONFIRMED' THEN 1 ELSE 0 END), 0) AS confirmed_count,
                COALESCE(SUM(CASE WHEN a.status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelled_count
            FROM dentists d
            LEFT JOIN appointments a ON d.id = a.dentist_id
                AND a.start_at >= :start_at AND a.start_at <= :end_at
            GROUP BY d.id, d.first_name, d.last_name, d.specialization, d.is_active
            ORDER BY completed_count DESC, d.id ASC
        ");
        $stmt->execute([
            ':now_str' => $range['now_str'],
            ':start_at' => $range['start_at'],
            ':end_at' => $range['end_at'],
        ]);
        $dentists = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        foreach ($dentists as &$d) {
            $d['id'] = (int) $d['id'];
            $d['first_name'] = (string) $d['first_name'];
            $d['last_name'] = (string) $d['last_name'];
            $d['is_active'] = (bool) $d['is_active'];
            $d['total_assigned'] = (int) $d['total_assigned'];
            $d['pending_count'] = (int) $d['pending_count'];
            $d['upcoming_count'] = (int) $d['upcoming_count'];
            $d['completed_count'] = (int) $d['completed_count'];
            $d['confirmed_count'] = (int) $d['confirmed_count'];
            $d['cancelled_count'] = (int) $d['cancelled_count'];
        }
        unset($d);

        return Response::success([
            'date_range' => ['start_date' => $range['start_date'], 'end_date' => $range['end_date']],
            'timezone' => 'Asia/Manila',
            'dentists' => $dentists,
        ]);
    }
}
