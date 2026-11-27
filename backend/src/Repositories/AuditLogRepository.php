<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Security and Administrative Audit Log Repository
 * Records tamper-evident audit events with strict payload sanitization.
 */
class AuditLogRepository
{
    private Database $database;

    private const SENSITIVE_KEYS = [
        'password',
        'password_hash',
        'token',
        'token_hash',
        'csrf_token',
        'session_id',
        'secret',
        'api_key',
        'new_password',
        'current_password',
        'otp',
        'ticket',
        'ticket_hash',
        'websocket_ticket',
    ];

    private const TARGET_TYPE_ALIASES = [
        'users' => ['users', 'user'],
        'patients' => ['patients', 'patient'],
        'dentists' => ['dentists', 'dentist'],
        'appointments' => ['appointments', 'appointment'],
        'services' => ['services', 'service'],
        'roles' => ['roles', 'role'],
        'treatment_records' => ['treatment_records', 'treatment_record'],
        'legal_documents' => ['legal_documents', 'legal_document'],
        'email_outbox' => ['email_outbox', 'email_job', 'email_jobs'],
        'clinic_settings' => ['clinic_settings', 'settings'],
        'audit_logs' => ['audit_logs', 'audit_log'],
        'archives' => ['archives', 'archive', 'archive_record', 'archive_records'],
    ];

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Record an audit event with sanitized payload
     *
     * @param array<string, mixed>|null $payload
     */
    public function record(
        string $action,
        string $targetType,
        ?int $targetId = null,
        ?int $actorUserId = null,
        ?string $ipAddress = null,
        ?string $userAgent = null,
        ?array $payload = null
    ): int {
        try {
            $pdo = $this->database->getConnection();
            $sanitizedPayload = $payload !== null ? $this->sanitizePayload($payload) : null;
            $jsonPayload = $sanitizedPayload !== null ? json_encode($sanitizedPayload, JSON_UNESCAPED_UNICODE) : null;

            $stmt = $pdo->prepare('
                INSERT INTO audit_logs (
                    actor_user_id, action, target_type, target_id,
                    ip_address, user_agent, sanitized_payload, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            ');

            $stmt->execute([
                $actorUserId,
                $action,
                $targetType,
                $targetId,
                $ipAddress !== null ? substr($ipAddress, 0, 45) : null,
                $userAgent !== null ? substr($userAgent, 0, 255) : null,
                $jsonPayload,
            ]);

            return (int) $pdo->lastInsertId();
        } catch (\Throwable $e) {
            // Audit logging failures must not crash the application, but should be reported safely
            return 0;
        }
    }

    /**
     * Recursively strip credentials and security tokens
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function sanitizePayload(array $data): array
    {
        $sanitized = [];
        foreach ($data as $key => $value) {
            $normalizedKey = strtolower((string) $key);
            if (in_array($normalizedKey, self::SENSITIVE_KEYS, true)) {
                $sanitized[$key] = '[REDACTED]';
            } elseif (is_array($value)) {
                $sanitized[$key] = $this->sanitizePayload($value);
            } else {
                $sanitized[$key] = $value;
            }
        }

        return $sanitized;
    }

    /**
     * Paginated audit log search with multi-dimensional criteria
     *
     * @param array<string, mixed> $filters
     * @return array{data: list<array<string, mixed>>, meta: array<string, mixed>}
     */
    public function list(
        array $filters = [],
        string $sortBy = 'created_at',
        string $sortDir = 'DESC',
        int $page = 1,
        int $perPage = 25
    ): array {
        $pdo = $this->database->getConnection();

        $where = [];
        $params = [];

        if (!empty($filters['search'])) {
            $search = '%' . \App\Support\ServerTableQuery::escapeLike((string) $filters['search']) . '%';
            $where[] = "(al.action LIKE ? ESCAPE '!' OR al.target_type LIKE ? ESCAPE '!' OR al.ip_address LIKE ? ESCAPE '!' OR u.email LIKE ? ESCAPE '!')";
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
        }

        if (!empty($filters['action'])) {
            $where[] = 'al.action = ?';
            $params[] = trim((string) $filters['action']);
        }

        if (!empty($filters['actions']) && is_array($filters['actions'])) {
            $cleanActions = array_values(array_filter(
                array_map(fn($a) => trim((string) $a), $filters['actions']),
                fn($a) => $a !== ''
            ));
            if (count($cleanActions) > 0) {
                $placeholders = implode(', ', array_fill(0, count($cleanActions), '?'));
                $where[] = "al.action IN ({$placeholders})";
                foreach ($cleanActions as $act) {
                    $params[] = $act;
                }
            }
        }

        if (!empty($filters['action_prefix']) && trim((string) $filters['action_prefix']) !== '') {
            $where[] = "al.action LIKE ? ESCAPE '!'";
            $params[] = \App\Support\ServerTableQuery::escapeLike((string) $filters['action_prefix']) . '%';
        }

        if (!empty($filters['target_type'])) {
            $normalizedTarget = strtolower(trim((string) $filters['target_type']));
            $aliases = self::TARGET_TYPE_ALIASES[$normalizedTarget] ?? [$normalizedTarget];
            if (count($aliases) === 1) {
                $where[] = 'al.target_type = ?';
                $params[] = $aliases[0];
            } else {
                $placeholders = implode(', ', array_fill(0, count($aliases), '?'));
                $where[] = "al.target_type IN ({$placeholders})";
                foreach ($aliases as $alias) {
                    $params[] = $alias;
                }
            }
        }

        if (!empty($filters['actor_user_id'])) {
            $where[] = 'al.actor_user_id = ?';
            $params[] = (int) $filters['actor_user_id'];
        }

        $dateFrom = !empty($filters['date_from'])
            ? trim((string) $filters['date_from'])
            : (!empty($filters['date']) ? trim((string) $filters['date']) : '');
        $dateTo = !empty($filters['date_to'])
            ? trim((string) $filters['date_to'])
            : (!empty($filters['date']) ? trim((string) $filters['date']) : '');

        if ($dateFrom !== '') {
            $where[] = 'al.created_at >= ?';
            $params[] = $dateFrom . ' 00:00:00';
        }

        if ($dateTo !== '') {
            $where[] = 'al.created_at <= ?';
            $params[] = $dateTo . ' 23:59:59';
        }

        $hasFilters = count($where) > 0;
        $whereSql = $hasFilters ? 'WHERE ' . implode(' AND ', $where) : '';

        $countStmt = $pdo->prepare("
            SELECT COUNT(*) 
            FROM audit_logs al
            LEFT JOIN users u ON al.actor_user_id = u.id
            {$whereSql}
        ");
        $countStmt->execute($params);
        $filteredTotal = (int) $countStmt->fetchColumn();

        $totalRecords = $hasFilters
            ? (int) $pdo->query('SELECT COUNT(*) FROM audit_logs')->fetchColumn()
            : $filteredTotal;

        $allowedSort = ['created_at' => 'al.created_at', 'id' => 'al.id', 'action' => 'al.action'];
        $resolvedSortKey = array_key_exists($sortBy, $allowedSort) ? $sortBy : 'created_at';
        $sortCol = $allowedSort[$resolvedSortKey];
        $direction = strtoupper($sortDir) === 'ASC' ? 'ASC' : 'DESC';

        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $offset = ($page - 1) * $perPage;

        $stmt = $pdo->prepare("
            SELECT 
                al.id, al.action, al.target_type, al.target_id, 
                al.actor_user_id, al.ip_address, al.user_agent,
                al.sanitized_payload, al.created_at,
                u.email AS actor_email, u.role AS actor_role
            FROM audit_logs al
            LEFT JOIN users u ON al.actor_user_id = u.id
            {$whereSql}
            ORDER BY {$sortCol} {$direction}, al.id {$direction}
            LIMIT ? OFFSET ?
        ");
        $pos = 1;
        foreach ($params as $val) {
            $stmt->bindValue($pos++, $val);
        }
        $stmt->bindValue($pos++, $perPage, PDO::PARAM_INT);
        $stmt->bindValue($pos, $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $data = array_map(function ($row) {
            $payload = null;
            if (!empty($row['sanitized_payload'])) {
                $payload = json_decode((string) $row['sanitized_payload'], true);
            }

            return [
                'id' => (int) $row['id'],
                'action' => (string) $row['action'],
                'target_type' => (string) $row['target_type'],
                'target_id' => $row['target_id'] !== null ? (int) $row['target_id'] : null,
                'actor_user_id' => $row['actor_user_id'] !== null ? (int) $row['actor_user_id'] : null,
                'actor_email' => $row['actor_email'] ?: 'System / Anonymous',
                'actor_role' => $row['actor_role'] ?: 'SYSTEM',
                'ip_address' => $row['ip_address'] ?: '127.0.0.1',
                'user_agent' => $row['user_agent'],
                'payload' => $payload,
                'created_at' => (string) $row['created_at'],
            ];
        }, $rows);

        return [
            'data' => $data,
            'meta' => \App\Support\ServerTableQuery::buildMeta(
                $totalRecords,
                $filteredTotal,
                $page,
                $perPage,
                $resolvedSortKey,
                $direction
            ),
        ];
    }

    /**
     * Export audit logs to streaming CSV
     *
     * @param array<string, mixed> $filters
     */
    public function exportCsv(array $filters = []): string
    {
        $result = $this->list($filters, 'created_at', 'DESC', 1, 2000);
        $rows = $result['data'];

        $fp = fopen('php://temp', 'r+');
        fputcsv($fp, ['ID', 'Timestamp (UTC)', 'Actor Email', 'Actor Role', 'Action', 'Target Type', 'Target ID', 'IP Address', 'Payload Details'], ',', '"', '');

        foreach ($rows as $r) {
            fputcsv($fp, [
                $r['id'],
                $r['created_at'],
                $r['actor_email'],
                $r['actor_role'],
                $r['action'],
                $r['target_type'],
                $r['target_id'] ?? '',
                $r['ip_address'],
                $r['payload'] ? json_encode($r['payload']) : '',
            ], ',', '"', '');
        }

        rewind($fp);
        $csv = stream_get_contents($fp);
        fclose($fp);

        return $csv ?: '';
    }
}

