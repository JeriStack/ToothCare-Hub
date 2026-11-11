<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\UserRepository;
use App\Services\AuthService;

/**
 * Authentication Middleware
 * Enforces session-based authentication on protected routes.
 */
class AuthenticationMiddleware implements MiddlewareInterface
{
    private UserRepository $userRepository;
    private AuthService $authService;

    public function __construct(?UserRepository $userRepository = null, ?AuthService $authService = null)
    {
        $this->userRepository = $userRepository ?? new UserRepository();
        $this->authService = $authService ?? new AuthService();
    }

    public function handle(Request $request, callable $next): Response
    {
        // If an authenticated user is already attached to request context (e.g. testing or upstream gateway)
        if ($request->getUser() !== null) {
            return $next($request);
        }

        $this->authService->initializeSession();

        if (session_status() !== PHP_SESSION_ACTIVE || empty($_SESSION['user_id'])) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $userId = (int) $_SESSION['user_id'];
        $user = $this->userRepository->findById($userId);

        if ($user === null) {
            $this->authService->logout();
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        if ((int) $user['is_active'] !== 1) {
            $this->authService->logout($userId);
            throw HttpException::unauthorized('Account is inactive or disabled.', 'ACCOUNT_DISABLED');
        }

        // Attach resolved identity to request context
        $request->setUser($user);
        $request->setAttribute('user_id', $userId);
        $request->setAttribute('user_role', (string) $user['role']);

        return $next($request);
    }
}
