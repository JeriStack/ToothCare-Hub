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
    public function findByUser(int $userId, ?string $role = null, int $page = 1, int $perPage = 20): array
    {
        $conn = $this->database->getConnection();
        $offset = ($page - 1) * $perPage;

        $where = ['user_id = :user_id'];
        $params = ['user_id' => $userId];

        if ($role !== null && $role !== '') {
            $where[] = 'role = :role';
            $params['role'] = strtoupper($role);
        }

        $whereSql = implode(' AND ', $where);

        // Count total
        $countStmt = $conn->prepare("SELECT COUNT(*) FROM notifications WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        // Count unread
        $unreadStmt = $conn->prepare("SELECT COUNT(*) FROM notifications WHERE {$whereSql} AND read_at IS NULL");
        $unreadStmt->execute($params);
        $unreadCount = (int) $unreadStmt->fetchColumn();

        // Fetch paginated rows
        $sql = "
            SELECT id, user_id, role, type, title, message, reference_type, reference_id, read_at, created_at
            FROM notifications
            WHERE {$whereSql}
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

        $totalPages = $perPage > 0 ? (int) ceil($total / $perPage) : 0;

        return [
            'items' => $items,
            'total' => $total,
            'unread_count' => $unreadCount,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => $totalPages,
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
