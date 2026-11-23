<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Services\NotificationService;

/**
 * Notification Controller
 * Manages patient and clinic notifications with strict user ownership and read state tracking.
 */
class NotificationController
{
    private NotificationService $notificationService;

    public function __construct(?NotificationService $notificationService = null)
    {
        $this->notificationService = $notificationService ?? new NotificationService();
    }

    /**
     * GET /api/v1/notifications
     * Retrieve paginated notifications for the authenticated user.
     */
    public function index(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required to view notifications.');
        }

        $result = $this->notificationService->getUserNotifications(
            (int) $user['id'],
            $request->getQueryParams()
        );

        return Response::success($result);
    }

    /**
     * GET /api/v1/notifications/unread-count
     * Retrieve count of unread notifications for the user.
     */
    public function unreadCount(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $count = $this->notificationService->getUnreadCount((int) $user['id']);

        return Response::success(['unread_count' => $count]);
    }

    /**
     * GET /api/v1/notifications/sync
     * Cursor-based synchronization of missed notifications + authoritative unread count.
     */
    public function sync(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required to synchronize notifications.');
        }

        $result = $this->notificationService->syncUserNotifications(
            (int) $user['id'],
            $request->getQueryParams()
        );

        return Response::success($result);
    }

    /**
     * GET /api/v1/notifications/{id}
     * Retrieve a single notification with strict server-side ownership enforcement.
     */
    public function show(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required to view notifications.');
        }

        $id = (int) $request->getParam('id');
        if ($id <= 0) {
            throw HttpException::badRequest('Invalid notification ID.');
        }

        $notification = $this->notificationService->getNotificationById((int) $user['id'], $id);

        return Response::success($notification);
    }

    /**
     * PATCH /api/v1/notifications/{id}/read
     * Mark a single notification as read with strict ownership enforcement.
     */
    public function markRead(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $id = (int) $request->getParam('id');
        if ($id <= 0) {
            throw HttpException::badRequest('Invalid notification ID.');
        }

        $result = $this->notificationService->markAsRead((int) $user['id'], $id);

        return Response::success($result);
    }

    /**
     * POST /api/v1/notifications/read-all
     * or PATCH /api/v1/notifications/read-all
     * Mark all unread notifications as read for the user.
     */
    public function markAllRead(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $result = $this->notificationService->markAllAsRead((int) $user['id']);

        return Response::success($result);
    }
}
