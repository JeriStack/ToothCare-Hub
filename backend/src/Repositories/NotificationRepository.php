<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Notification Repository
 * Persists and retrieves in-app notifications with strict user ownership.
 */
class NotificationRepository
{
    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Create a new in-app notification.
     *
     * @param array<string, mixed> $data
     * @param PDO|null $pdo Optional existing transaction connection
     * @return int Inserted ID
     */
    public function create(array $data, ?PDO $pdo = null): int
    {
        $conn = $pdo ?? $this->database->getConnection();

        $stmt = $conn->prepare('
            INSERT INTO notifications (
                user_id, role, type, title, message, reference_type, reference_id, created_at
            ) VALUES (
                :user_id, :role, :type, :title, :message, :reference_type, :reference_id, :created_at
            )
        ');

        $now = date('Y-m-d H:i:s');
        $stmt->execute([
            'user_id' => (int) $data['user_id'],
            'role' => (string) ($data['role'] ?? 'PATIENT'),
            'type' => (string) $data['type'],
            'title' => (string) $data['title'],
            'message' => (string) $data['message'],
            'reference_type' => $data['reference_type'] ?? 'appointments',
            'reference_id' => isset($data['reference_id']) ? (int) $data['reference_id'] : null,
            'created_at' => $data['created_at'] ?? $now,
        ]);

        return (int) $conn->lastInsertId();
    }

    /**
     * Find single notification by ID.
     *
     * @param int $id
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $conn = $this->database->getConnection();
        $stmt = $conn->prepare('SELECT * FROM notifications WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Find notifications for a specific user with pagination and total count.
     *
     * @param int $userId
     * @param string|null $role
     * @param int $page
     * @param int $perPage
     * @return array{
     *   items: list<array<string, mixed>>,
     *   total: int,
     *   unread_count: int,
     *   page: int,
     *   per_page: int,
     *   total_pages: int
     * }
     */
    public function findByUser(
        int $userId,
        ?string $role = null,
        int $page = 1,
        int $perPage = 20,
        bool $unreadOnly = false
    ): array {
        $conn = $this->database->getConnection();
        $offset = ($page - 1) * $perPage;

        $baseWhere = ['user_id = :user_id'];
        $params = ['user_id' => $userId];

        if ($role !== null && $role !== '') {
            $baseWhere[] = 'role = :role';
            $params['role'] = strtoupper($role);
        }

        $baseWhereSql = implode(' AND ', $baseWhere);
        $listWhere = $baseWhere;
        if ($unreadOnly) {
            $listWhere[] = 'read_at IS NULL';
        }
        $listWhereSql = implode(' AND ', $listWhere);

        // Count total matching current filter
        $countStmt = $conn->prepare("SELECT COUNT(*) FROM notifications WHERE {$listWhereSql}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        // Count total unread for user
        $unreadStmt = $conn->prepare("SELECT COUNT(*) FROM notifications WHERE {$baseWhereSql} AND read_at IS NULL");
        $unreadStmt->execute($params);
        $unreadCount = (int) $unreadStmt->fetchColumn();

        // Fetch paginated rows
        $sql = "
            SELECT id, user_id, role, type, title, message, reference_type, reference_id, read_at, created_at
            FROM notifications
            WHERE {$listWhereSql}
            ORDER BY created_at DESC, id DESC
            LIMIT :limit OFFSET :offset
        ";

        $stmt = $conn->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue(':' . $key, $val);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $latestIdStmt = $conn->prepare("SELECT COALESCE(MAX(id), 0) FROM notifications WHERE {$baseWhereSql}");
        $latestIdStmt->execute($params);
        $latestId = (int) $latestIdStmt->fetchColumn();

        $totalPages = $perPage > 0 ? (int) ceil($total / $perPage) : 0;

        return [
            'items' => $items,
            'total' => $total,
            'unread_count' => $unreadCount,
            'latest_id' => $latestId,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => $totalPages,
        ];
    }

    /**
     * Cursor-based incremental sync for reconnect / missed-notification recovery.
     *
     * @return array{
     *   items: list<array<string, mixed>>,
     *   unread_count: int,
     *   latest_id: int,
     *   has_more: bool,
     *   server_time: string
     * }
     */
    public function syncSince(int $userId, int $afterId = 0, ?string $since = null, int $limit = 50): array
    {
        $conn = $this->database->getConnection();
        $safeLimit = max(1, min(100, $limit));

        $where = ['user_id = :user_id'];
        $params = ['user_id' => $userId];

        if ($afterId > 0) {
            $where[] = 'id > :after_id';
            $params['after_id'] = $afterId;
        } elseif ($since !== null && trim($since) !== '') {
            $where[] = 'created_at >= :since';
            $params['since'] = trim($since);
        }

        $whereSql = implode(' AND ', $where);
        $sql = "
            SELECT id, user_id, role, type, title, message, reference_type, reference_id, read_at, created_at
            FROM notifications
            WHERE {$whereSql}
            ORDER BY id DESC
            LIMIT :limit_plus
        ";

        $stmt = $conn->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue(':' . $key, $val, is_int($val) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->bindValue(':limit_plus', $safeLimit + 1, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $hasMore = count($rows) > $safeLimit;
        if ($hasMore) {
            $rows = array_slice($rows, 0, $safeLimit);
        }

        $unreadCount = $this->getUnreadCount($userId);

        $latestStmt = $conn->prepare('SELECT COALESCE(MAX(id), 0) FROM notifications WHERE user_id = ?');
        $latestStmt->execute([$userId]);
        $latestId = (int) $latestStmt->fetchColumn();

        return [
            'items' => $rows,
            'unread_count' => $unreadCount,
            'latest_id' => $latestId,
            'has_more' => $hasMore,
            'server_time' => gmdate('Y-m-d\TH:i:s\Z'),
        ];
    }

    /**
     * Bounded aggregate notification metrics for Prometheus (no user IDs or PII).
     *
     * @return array{by_type: array<string, int>, unread_total: int}
     */
    public function aggregateMetrics(): array
    {
        $conn = $this->database->getConnection();
        $byType = [];
        $rows = $conn->query('SELECT type, COUNT(*) AS c FROM notifications GROUP BY type')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) {
            $byType[(string) $row['type']] = (int) $row['c'];
        }
        $unreadTotal = (int) $conn->query('SELECT COUNT(*) FROM notifications WHERE read_at IS NULL')->fetchColumn();

        return [
            'by_type' => $byType,
            'unread_total' => $unreadTotal,
        ];
    }

    /**
     * Get unread notifications count for a user.
     *
     * @param int $userId
     * @param string|null $role
     * @return int
     */
    public function getUnreadCount(int $userId, ?string $role = null): int
    {
        $conn = $this->database->getConnection();
        $where = ['user_id = :user_id', 'read_at IS NULL'];
        $params = ['user_id' => $userId];

        if ($role !== null && $role !== '') {
            $where[] = 'role = :role';
            $params['role'] = strtoupper($role);
        }

        $whereSql = implode(' AND ', $where);
        $stmt = $conn->prepare("SELECT COUNT(*) FROM notifications WHERE {$whereSql}");
        $stmt->execute($params);

        return (int) $stmt->fetchColumn();
    }

    /**
     * Mark single notification as read if owned by user.
     *
     * @param int $id
     * @param int $userId
     * @return bool
     */
    public function markAsRead(int $id, int $userId): bool
    {
        $conn = $this->database->getConnection();
        $stmt = $conn->prepare('
            UPDATE notifications
            SET read_at = :now
            WHERE id = :id AND user_id = :user_id AND read_at IS NULL
        ');

        $stmt->execute([
            'now' => date('Y-m-d H:i:s'),
            'id' => $id,
            'user_id' => $userId,
        ]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Mark all unread notifications as read for a user.
     *
     * @param int $userId
     * @param string|null $role
     * @return int Number of updated rows
     */
    public function markAllAsRead(int $userId, ?string $role = null): int
    {
        $conn = $this->database->getConnection();
        $where = ['user_id = :user_id', 'read_at IS NULL'];
        $params = [
            'now' => date('Y-m-d H:i:s'),
            'user_id' => $userId,
        ];

        if ($role !== null && $role !== '') {
            $where[] = 'role = :role';
            $params['role'] = strtoupper($role);
        }

        $whereSql = implode(' AND ', $where);
        $stmt = $conn->prepare("UPDATE notifications SET read_at = :now WHERE {$whereSql}");
        $stmt->execute($params);

        return $stmt->rowCount();
    }
}
