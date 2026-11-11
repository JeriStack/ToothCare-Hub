<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Middleware\CsrfMiddleware;
use App\Services\AuthService;
use App\Validators\AuthValidator;

/**
 * Authentication and Account Security Controller
 * Exposes REST API endpoints for user registration, sessions, email verification, and password recovery.
 */
class AuthController
{
    private AuthService $authService;

    public function __construct(?AuthService $authService = null)
    {
        $this->authService = $authService ?? new AuthService();
    }

    /**
     * POST /api/v1/auth/register
     */
    public function register(Request $request): Response
    {
        $result = $this->authService->register(
            $request->getBody(),
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::created($result);
    }

    /**
     * POST /api/v1/auth/login
     */
    public function login(Request $request): Response
    {
        $result = $this->authService->login(
            $request->getBody(),
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::success($result);
    }

    /**
     * POST /api/v1/auth/logout
     */
    public function logout(Request $request): Response
    {
        $user = $request->getUser();
        $userId = $user !== null ? (int) $user['id'] : null;

        $this->authService->logout(
            $userId,
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::success(['message' => 'Successfully logged out.']);
    }

    /**
     * GET /api/v1/auth/me
     */
    public function me(Request $request): Response
    {
        $user = $request->getUser();
        $userId = (int) ($user['id'] ?? 0);

        $currentUser = $this->authService->getCurrentUser($userId);

        return Response::success($currentUser);
    }

    /**
     * GET /api/v1/auth/csrf-token
     */
    public function csrfToken(Request $request): Response
    {
        $token = CsrfMiddleware::getToken();
        return Response::success(['csrf_token' => $token]);
    }

    /**
     * POST /api/v1/auth/verify-email
     */
    public function verifyEmail(Request $request): Response
    {
        $validated = AuthValidator::validateVerifyEmail($request->getBody());
        $result = $this->authService->verifyEmail(
            $validated['token'],
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::success($result);
    }

    /**
     * POST /api/v1/auth/resend-verification
     */
    public function resendVerification(Request $request): Response
    {
        $validated = AuthValidator::validateResendVerification($request->getBody());
        $result = $this->authService->resendVerification(
            $validated['email'],
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::success($result);
    }

    /**
     * POST /api/v1/auth/forgot-password or POST /api/v1/auth/password/forgot
     */
    public function forgotPassword(Request $request): Response
    {
        $validated = AuthValidator::validateForgotPassword($request->getBody());
        $result = $this->authService->forgotPassword(
            $validated['email'],
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::success($result);
    }

    /**
     * POST /api/v1/auth/reset-password or POST /api/v1/auth/password/reset
     */
    public function resetPassword(Request $request): Response
    {
        $validated = AuthValidator::validateResetPassword($request->getBody());
        $result = $this->authService->resetPassword(
            $validated['token'],
            $validated['password'],
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::success($result);
    }
}

