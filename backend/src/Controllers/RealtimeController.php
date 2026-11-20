<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Services\Realtime\InternalRequestSigner;
use App\Services\Realtime\RealtimeConfig;
use App\Services\Realtime\RealtimeTicketService;

/**
 * Real-Time Connection Ticket & Internal Verification Controller.
 *
 * Public (Authenticated User):
 *   POST /api/v1/realtime/ticket
 *
 * Internal Service-to-Service ONLY (blocked at Nginx public edge, HMAC-SHA256 signed):
 *   POST /api/v1/internal/realtime/tickets/verify
 *   POST /api/v1/internal/realtime/sessions/verify
 */
class RealtimeController
{
    private RealtimeTicketService $ticketService;
    private InternalRequestSigner $signer;
    private RealtimeConfig $config;

    public function __construct(
        ?RealtimeTicketService $ticketService = null,
        ?InternalRequestSigner $signer = null,
        ?RealtimeConfig $config = null
    ) {
        $this->config = $config ?? RealtimeConfig::fromEnvironment();
        $this->ticketService = $ticketService ?? new RealtimeTicketService(null, null, null, null, $this->config);
        $this->signer = $signer ?? new InternalRequestSigner($this->config->internalSecret, $this->config->replayWindowSeconds);
    }

    /**
     * POST /api/v1/realtime/ticket
     * Issues a short-lived, single-use Socket.IO connection ticket bound to the authenticated session.
     */
    public function issueTicket(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $sessionId = session_status() === PHP_SESSION_ACTIVE ? session_id() : null;
        $ticketData = $this->ticketService->issueTicket($user, $sessionId ?: null);

        return Response::success($ticketData);
    }

    /**
     * POST /api/v1/internal/realtime/tickets/verify
     * Verifies and consumes a single-use ticket on behalf of the Node.js Socket.IO service.
     */
    public function verifyTicket(Request $request): Response
    {
        $this->requireValidInternalSignature($request);

        $body = $request->getBody();
        $rawTicket = isset($body['ticket']) && is_string($body['ticket']) ? $body['ticket'] : '';

        $identity = $this->ticketService->verifyAndConsumeTicket($rawTicket);

        return Response::success($identity);
    }

    /**
     * POST /api/v1/internal/realtime/sessions/verify
     * Revalidates an active socket's user status, role, and DRBAC permissions.
     */
    public function verifySession(Request $request): Response
    {
        $this->requireValidInternalSignature($request);

        $body = $request->getBody();
        $userId = isset($body['user_id']) ? (int) $body['user_id'] : 0;
        if ($userId <= 0) {
            throw HttpException::badRequest('Valid user_id is required.', 'INVALID_USER_ID');
        }

        $result = $this->ticketService->verifyActiveIdentity($userId);

        return Response::success($result);
    }

    private function requireValidInternalSignature(Request $request): void
    {
        $verification = $this->signer->verifyRequest($request);
        if (!$verification['valid']) {
            throw HttpException::unauthorized(
                'Internal service authentication failed.',
                $verification['reason']
            );
        }
    }
}
