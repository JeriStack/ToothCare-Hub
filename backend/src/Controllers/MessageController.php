<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Services\MessageService;

/**
 * Patient-Dentist Messaging Controller
 * Exposes strictly participant-scoped Messenger-style chat endpoints.
 */
class MessageController
{
    private MessageService $messageService;

    public function __construct(?MessageService $messageService = null)
    {
        $this->messageService = $messageService ?? new MessageService();
    }

    /**
     * GET /api/v1/messages/conversations
     */
    public function listConversations(Request $request): Response
    {
        $user = $this->requireUser($request);
        $data = $this->messageService->listConversations($user, $request->getQueryParams());
        return Response::success($data);
    }

    /**
     * GET /api/v1/messages/unread-count
     */
    public function unreadCount(Request $request): Response
    {
        $user = $this->requireUser($request);
        $count = $this->messageService->getUnreadCount($user);
        return Response::success(['unread_count' => $count]);
    }

    /**
     * GET /api/v1/messages/presence
     */
    public function presence(Request $request): Response
    {
        $user = $this->requireUser($request);
        $data = $this->messageService->getPresence($user);
        return Response::success($data);
    }

    /**
     * POST /api/v1/messages/conversations
     */
    public function startConversation(Request $request): Response
    {
        $user = $this->requireUser($request);
        $conversation = $this->messageService->startOrFindConversation($user, $request->getBody());
        return Response::created(['conversation' => $conversation]);
    }

    /**
     * GET /api/v1/messages/conversations/{id}/messages
     */
    public function getMessages(Request $request): Response
    {
        $user = $this->requireUser($request);
        $conversationId = (int) $request->getParam('id');
        $data = $this->messageService->getConversationMessages($user, $conversationId, $request->getQueryParams());
        return Response::success($data);
    }

    /**
     * POST /api/v1/messages/conversations/{id}/messages
     */
    public function sendMessage(Request $request): Response
    {
        $user = $this->requireUser($request);
        $conversationId = (int) $request->getParam('id');
        $result = $this->messageService->sendMessage($user, $conversationId, $request->getBody());
        return Response::created($result);
    }

    /**
     * POST /api/v1/messages/conversations/{id}/delivered
     */
    public function markDelivered(Request $request): Response
    {
        $user = $this->requireUser($request);
        $conversationId = (int) $request->getParam('id');
        $result = $this->messageService->markDelivered($user, $conversationId);
        return Response::success($result);
    }

    /**
     * POST /api/v1/messages/conversations/{id}/read
     */
    public function markRead(Request $request): Response
    {
        $user = $this->requireUser($request);
        $conversationId = (int) $request->getParam('id');
        $result = $this->messageService->markRead($user, $conversationId);
        return Response::success($result);
    }

    /**
     * POST /api/v1/messages/conversations/{id}/typing
     */
    public function typing(Request $request): Response
    {
        $user = $this->requireUser($request);
        $conversationId = (int) $request->getParam('id');
        $body = $request->getBody();
        $isTyping = isset($body['is_typing']) ? (bool) $body['is_typing'] : true;
        $result = $this->messageService->sendTypingSignal($user, $conversationId, $isTyping);
        return Response::success($result);
    }

    /**
     * @return array<string, mixed>
     */
    private function requireUser(Request $request): array
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required to access messages.');
        }
        return $user;
    }
}
