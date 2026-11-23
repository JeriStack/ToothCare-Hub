<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\HttpException;
use App\Core\Logger;
use App\Repositories\NotificationRepository;
use PDO;
use Throwable;

/**
 * Notification Service
 * Orchestrates database persistence of in-app notifications and enforces owner-based access.
 */
class NotificationService
{
    private NotificationRepository $notificationRepo;
    private Logger $logger;

    public function __construct(
        ?NotificationRepository $notificationRepo = null,
        ?Logger $logger = null
    ) {
        $this->notificationRepo = $notificationRepo ?? new NotificationRepository();
        $this->logger = $logger ?? Logger::getInstance();
    }

    /**
     * Create an in-app notification for a user.
     *
     * @param int $userId Target recipient user ID
     * @param string $role Target user role ('PATIENT', 'DENTIST', 'ADMIN')
     * @param string $type Notification type (e.g. 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_REQUESTED')
     * @param string $title Notification headline
     * @param string $message Detailed message
     * @param string|null $referenceType Default 'appointments'
     * @param int|null $referenceId Associated appointment ID
     * @param PDO|null $pdo Optional existing transaction
     * @return int Created notification ID
     */
    public function createNotification(
        int $userId,
        string $role,
        string $type,
        string $title,
        string $message,
        ?string $referenceType = 'appointments',
        ?int $referenceId = null,
        ?PDO $pdo = null
    ): int {
        try {
            return $this->notificationRepo->create([
                'user_id' => $userId,
                'role' => strtoupper($role),
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'reference_type' => $referenceType ?? 'appointments',
                'reference_id' => $referenceId,
            ], $pdo);
        } catch (Throwable $e) {
            $this->logger->error('Failed to create in-app notification', [
                'user_id' => $userId,
                'type' => $type,
                'error' => $e->getMessage(),
            ]);
            return 0;
        }
    }

    /**
     * Retrieve paginated notifications for the authenticated user.
     *
     * @param int $userId
     * @param array<string, mixed> $params
     * @return array<string, mixed>
     */
    public function getUserNotifications(int $userId, array $params = []): array
    {
        $page = isset($params['page']) ? max(1, (int) $params['page']) : 1;
        $rawPerPage = $params['per_page'] ?? $params['limit'] ?? 20;
        $perPage = max(1, min(100, (int) $rawPerPage));
        $role = isset($params['role']) ? (string) $params['role'] : null;
        $unreadOnly = !empty($params['unread_only']) && in_array(strtolower((string) $params['unread_only']), ['1', 'true', 'yes'], true);

        return $this->notificationRepo->findByUser($userId, $role, $page, $perPage, $unreadOnly);
    }

    /**
     * Retrieve a single notification with strict server-side ownership enforcement.
     *
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function getNotificationById(int $userId, int $notificationId): array
    {
        $notification = $this->notificationRepo->findById($notificationId);
        if (!$notification) {
            throw HttpException::notFound('Notification not found.');
        }

        if ((int) $notification['user_id'] !== $userId) {
            throw HttpException::forbidden('You do not have permission to access this notification.');
        }

        return $notification;
    }

    /**
     * Incremental REST synchronization for missed notifications after disconnect/tab wake.
     *
     * @param array<string, mixed> $params
     * @return array<string, mixed>
     */
    public function syncUserNotifications(int $userId, array $params = []): array
    {
        $afterId = isset($params['after_id']) ? max(0, (int) $params['after_id']) : 0;
        $since = isset($params['since']) && is_string($params['since']) ? trim($params['since']) : null;
        $limit = isset($params['limit']) ? max(1, min(100, (int) $params['limit'])) : 50;

        if ($since !== null && $since !== '' && strtotime($since) === false) {
            throw HttpException::badRequest('Invalid since timestamp format.');
        }

        return $this->notificationRepo->syncSince($userId, $afterId, $since, $limit);
    }

    /**
     * Get unread notifications count for the authenticated user.
     *
     * @param int $userId
     * @param string|null $role
     * @return int
     */
    public function getUnreadCount(int $userId, ?string $role = null): int
    {
        return $this->notificationRepo->getUnreadCount($userId, $role);
    }

    /**
     * Mark a single notification as read with strict ownership check.
     *
     * @param int $userId
     * @param int $notificationId
     * @return array<string, mixed>
     * @throws HttpException
     */
    public function markAsRead(int $userId, int $notificationId): array
    {
        $notification = $this->notificationRepo->findById($notificationId);
        if (!$notification) {
            throw HttpException::notFound('Notification not found.');
        }

        // Strict ownership verification: cannot mark another user's notification as read
        if ((int) $notification['user_id'] !== $userId) {
            throw HttpException::forbidden('You do not have permission to access this notification.');
        }

        $this->notificationRepo->markAsRead($notificationId, $userId);
        $updated = $this->notificationRepo->findById($notificationId);

        return [
            'success' => true,
            'message' => 'Notification marked as read.',
            'notification' => $updated,
        ];
    }

    /**
     * Mark all unread notifications as read for the user.
     *
     * @param int $userId
     * @param string|null $role
     * @return array<string, mixed>
     */
    public function markAllAsRead(int $userId, ?string $role = null): array
    {
        $updatedCount = $this->notificationRepo->markAllAsRead($userId, $role);

        return [
            'success' => true,
            'message' => "All notifications marked as read.",
            'updated_count' => $updatedCount,
        ];
    }
}
