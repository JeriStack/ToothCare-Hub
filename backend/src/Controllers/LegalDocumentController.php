<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\LegalDocumentRepository;
use App\Services\LegalService;

/**
 * Legal Documents & User Consent Management Controller
 * Exposes public policy endpoints, authenticated acceptance endpoints, and DRBAC-guarded admin lifecycle endpoints.
 */
class LegalDocumentController
{
    private LegalService $legalService;

    public function __construct(?LegalService $legalService = null)
    {
        $this->legalService = $legalService ?? new LegalService();
    }

    /**
     * GET /api/v1/legal/documents (Public)
     */
    public function listPublicCurrent(Request $request): Response
    {
        return Response::success($this->legalService->getPublicCurrentDocuments());
    }

    /**
     * GET /api/v1/legal/terms-of-service (Public)
     */
    public function showTermsOfService(Request $request): Response
    {
        return Response::success(
            $this->legalService->getPublicDocument(LegalDocumentRepository::TYPE_TERMS)
        );
    }

    /**
     * GET /api/v1/legal/privacy-policy (Public)
     */
    public function showPrivacyPolicy(Request $request): Response
    {
        return Response::success(
            $this->legalService->getPublicDocument(LegalDocumentRepository::TYPE_PRIVACY)
        );
    }

    /**
     * GET /api/v1/legal/acceptances/me (Authenticated User)
     */
    public function myAcceptances(Request $request): Response
    {
        $user = $request->getUser();
        $userId = (int) ($user['id'] ?? 0);
        if ($userId <= 0) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        return Response::success($this->legalService->getUserAcceptanceStatus($userId));
    }

    /**
     * POST /api/v1/legal/acceptances (Authenticated User)
     */
    public function submitAcceptances(Request $request): Response
    {
        $user = $request->getUser();
        $userId = (int) ($user['id'] ?? 0);
        if ($userId <= 0) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        $result = $this->legalService->submitAuthenticatedAcceptance(
            $userId,
            $request->getBody(),
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::created($result);
    }

    /**
     * GET /api/v1/admin/legal/documents (DRBAC: legal_documents.view)
     */
    public function adminListDocuments(Request $request): Response
    {
        $type = $request->getQuery('document_type');
        $status = $request->getQuery('status');

        $documents = $this->legalService->listAllDocuments(
            is_string($type) && trim($type) !== '' ? strtoupper(trim($type)) : null,
            is_string($status) && trim($status) !== '' ? strtoupper(trim($status)) : null
        );

        return Response::success($documents);
    }

    /**
     * POST /api/v1/admin/legal/documents (DRBAC: legal_documents.create)
     */
    public function adminCreateDraft(Request $request): Response
    {
        $actorId = (int) ($request->getUser()['id'] ?? 0);
        $draft = $this->legalService->createDraft(
            $request->getBody(),
            $actorId,
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::created($draft);
    }

    /**
     * PATCH /api/v1/admin/legal/documents/{id} (DRBAC: legal_documents.edit)
     */
    public function adminUpdateDraft(Request $request): Response
    {
        $id = (int) ($request->getParam('id') ?? 0);
        $actorId = (int) ($request->getUser()['id'] ?? 0);

        $updated = $this->legalService->updateDraft(
            $id,
            $request->getBody(),
            $actorId,
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::success($updated);
    }

    /**
     * POST /api/v1/admin/legal/documents/{id}/publish (DRBAC: legal_documents.publish)
     */
    public function adminPublishDocument(Request $request): Response
    {
        $id = (int) ($request->getParam('id') ?? 0);
        $actorId = (int) ($request->getUser()['id'] ?? 0);

        $published = $this->legalService->publishDocument(
            $id,
            $request->getBody(),
            $actorId,
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::success($published);
    }

    /**
     * POST /api/v1/admin/legal/documents/{id}/withdraw (DRBAC: legal_documents.publish)
     */
    public function adminWithdrawDocument(Request $request): Response
    {
        $id = (int) ($request->getParam('id') ?? 0);
        $actorId = (int) ($request->getUser()['id'] ?? 0);

        $withdrawn = $this->legalService->withdrawDocument(
            $id,
            $actorId,
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::success($withdrawn);
    }

    /**
     * GET /api/v1/admin/legal/acceptances (DRBAC: legal_acceptances.view)
     */
    public function adminListAcceptances(Request $request): Response
    {
        $filters = [
            'user_id' => $request->getQuery('user_id'),
            'document_type' => $request->getQuery('document_type'),
            'document_version' => $request->getQuery('document_version'),
            'acceptance_action' => $request->getQuery('acceptance_action'),
        ];

        $page = max(1, (int) ($request->getQuery('page') ?? 1));
        $perPage = max(1, min(100, (int) ($request->getQuery('per_page') ?? 25)));

        $result = $this->legalService->listAcceptances($filters, $page, $perPage);
        return Response::paginated($result['data'], $result['meta']);
    }
}
