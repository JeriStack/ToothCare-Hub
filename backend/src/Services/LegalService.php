<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\HttpException;
use App\Repositories\AuditLogRepository;
use App\Repositories\LegalDocumentRepository;
use App\Repositories\UserLegalAcceptanceRepository;
use App\Validators\LegalValidator;

/**
 * Legal Documents & User Consent / Acceptance Service
 * Manages public policy retrieval, registration acceptance verification, re-acceptance flows,
 * versioned document drafting/publishing, and Audit Trail integration.
 */
class LegalService
{
    private LegalDocumentRepository $documentRepository;
    private UserLegalAcceptanceRepository $acceptanceRepository;
    private AuditLogRepository $auditLogRepository;
    private Database $database;

    public function __construct(
        ?LegalDocumentRepository $documentRepository = null,
        ?UserLegalAcceptanceRepository $acceptanceRepository = null,
        ?AuditLogRepository $auditLogRepository = null,
        ?Database $database = null
    ) {
        $this->database = $database ?? Database::getInstance();
        $this->documentRepository = $documentRepository ?? new LegalDocumentRepository($this->database);
        $this->acceptanceRepository = $acceptanceRepository ?? new UserLegalAcceptanceRepository($this->database);
        $this->auditLogRepository = $auditLogRepository ?? new AuditLogRepository($this->database);
    }

    /**
     * Public summary of currently PUBLISHED Terms of Service and Privacy Policy (no draft or user data).
     *
     * @return array<string, mixed>
     */
    public function getPublicCurrentDocuments(): array
    {
        $active = $this->documentRepository->findAllPublishedActive();

        $terms = $active[LegalDocumentRepository::TYPE_TERMS] ?? null;
        $privacy = $active[LegalDocumentRepository::TYPE_PRIVACY] ?? null;

        return [
            'terms_of_service' => $terms !== null ? $this->formatPublicSummary($terms) : null,
            'privacy_policy' => $privacy !== null ? $this->formatPublicSummary($privacy) : null,
        ];
    }

    /**
     * Public full document for a given type (strictly PUBLISHED active version only).
     *
     * @return array<string, mixed>
     */
    public function getPublicDocument(string $documentType): array
    {
        $doc = $this->documentRepository->findPublishedActiveByType($documentType);
        if ($doc === null) {
            throw HttpException::notFound('Published legal document not found.', 'LEGAL_DOCUMENT_NOT_FOUND');
        }

        return $this->formatPublicDocument($doc);
    }

    /**
     * Validate submitted registration legal acceptance against currently PUBLISHED versions.
     * Always ignores client-supplied timestamps; server generates acceptance timestamps on commit.
     *
     * @param array<string, mixed> $validatedLegal
     * @return array{terms: array<string, mixed>, privacy: array<string, mixed>}
     */
    public function resolveRegistrationDocuments(array $validatedLegal): array
    {
        $activeTerms = $this->documentRepository->findPublishedActiveByType(LegalDocumentRepository::TYPE_TERMS);
        $activePrivacy = $this->documentRepository->findPublishedActiveByType(LegalDocumentRepository::TYPE_PRIVACY);

        if ($activeTerms === null || $activePrivacy === null) {
            throw HttpException::internalError('Required published legal documents are not configured.');
        }

        $errors = [];

        $submittedTermsVersion = (string) ($validatedLegal['terms_version'] ?? '');
        if ($submittedTermsVersion !== (string) $activeTerms['version']) {
            $errors['terms_version'] = "Terms of Service version '{$submittedTermsVersion}' is invalid or outdated. Current published version is {$activeTerms['version']}.";
        }

        $submittedPrivacyVersion = (string) ($validatedLegal['privacy_version'] ?? '');
        if ($submittedPrivacyVersion !== (string) $activePrivacy['version']) {
            $errors['privacy_version'] = "Privacy Policy version '{$submittedPrivacyVersion}' is invalid or outdated. Current published version is {$activePrivacy['version']}.";
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity(
                'Submitted legal document versions do not match the currently published versions.',
                $errors
            );
        }

        return [
            'terms' => $activeTerms,
            'privacy' => $activePrivacy,
        ];
    }

    /**
     * Persist registration legal acceptances inside an active registration database transaction.
     * Records distinct ACCEPTED (Terms) and ACKNOWLEDGED (Privacy) actions + Audit Trail entries.
     *
     * @param array{terms: array<string, mixed>, privacy: array<string, mixed>} $resolvedDocs
     * @return list<array<string, mixed>>
     */
    public function recordRegistrationAcceptances(
        int $userId,
        array $resolvedDocs,
        ?string $clientIp = null,
        ?string $userAgent = null
    ): array {
        $termsDoc = $resolvedDocs['terms'];
        $privacyDoc = $resolvedDocs['privacy'];

        $termsRes = $this->acceptanceRepository->recordAcceptance(
            $userId,
            (int) $termsDoc['id'],
            LegalDocumentRepository::TYPE_TERMS,
            (string) $termsDoc['version'],
            UserLegalAcceptanceRepository::ACTION_ACCEPTED,
            $clientIp,
            $userAgent
        );

        $privacyRes = $this->acceptanceRepository->recordAcceptance(
            $userId,
            (int) $privacyDoc['id'],
            LegalDocumentRepository::TYPE_PRIVACY,
            (string) $privacyDoc['version'],
            UserLegalAcceptanceRepository::ACTION_ACKNOWLEDGED,
            $clientIp,
            $userAgent
        );

        $this->auditLogRepository->record(
            'LEGAL_TERMS_ACCEPTED',
            'user_legal_acceptances',
            (int) ($termsRes['record']['id'] ?? 0) ?: null,
            $userId,
            $clientIp,
            $userAgent,
            [
                'document_id' => (int) $termsDoc['id'],
                'document_type' => LegalDocumentRepository::TYPE_TERMS,
                'document_version' => (string) $termsDoc['version'],
                'acceptance_action' => UserLegalAcceptanceRepository::ACTION_ACCEPTED,
                'context' => 'registration',
                'result' => 'SUCCESS',
            ]
        );

        $this->auditLogRepository->record(
            'LEGAL_PRIVACY_ACKNOWLEDGED',
            'user_legal_acceptances',
            (int) ($privacyRes['record']['id'] ?? 0) ?: null,
            $userId,
            $clientIp,
            $userAgent,
            [
                'document_id' => (int) $privacyDoc['id'],
                'document_type' => LegalDocumentRepository::TYPE_PRIVACY,
                'document_version' => (string) $privacyDoc['version'],
                'acceptance_action' => UserLegalAcceptanceRepository::ACTION_ACKNOWLEDGED,
                'context' => 'registration',
                'result' => 'SUCCESS',
            ]
        );

        return [$termsRes['record'], $privacyRes['record']];
    }

    /**
     * Compute authenticated user's legal acceptance history and pending re-acceptance requirements.
     *
     * @return array<string, mixed>
     */
    public function getUserAcceptanceStatus(int $userId): array
    {
        $activeDocs = $this->documentRepository->findAllPublishedActive();
        $history = $this->acceptanceRepository->findByUserId($userId);

        $acceptedDocIds = [];
        foreach ($history as $record) {
            $acceptedDocIds[(int) $record['document_id'] . ':' . $record['acceptance_action']] = true;
        }

        $pending = [];
        foreach ($activeDocs as $type => $doc) {
            $requiredAction = LegalValidator::requiredActionForType($type);
            $key = (int) $doc['id'] . ':' . $requiredAction;
            $hasAcceptedCurrent = isset($acceptedDocIds[$key]);

            if (!$hasAcceptedCurrent && (bool) $doc['requires_reacceptance']) {
                $pending[] = [
                    'document_id' => (int) $doc['id'],
                    'document_type' => (string) $doc['document_type'],
                    'version' => (string) $doc['version'],
                    'title' => (string) $doc['title'],
                    'effective_date' => (string) $doc['effective_date'],
                    'published_at' => $doc['published_at'],
                    'is_approved' => (bool) $doc['is_approved'],
                    'change_summary' => $doc['change_summary'],
                    'required_action' => $requiredAction,
                    'content' => $doc['content'],
                ];
            }
        }

        return [
            'requires_reacceptance' => count($pending) > 0,
            'pending_documents' => $pending,
            'acceptances' => $history,
            'current_versions' => [
                'terms_of_service' => isset($activeDocs[LegalDocumentRepository::TYPE_TERMS])
                    ? (string) $activeDocs[LegalDocumentRepository::TYPE_TERMS]['version']
                    : null,
                'privacy_policy' => isset($activeDocs[LegalDocumentRepository::TYPE_PRIVACY])
                    ? (string) $activeDocs[LegalDocumentRepository::TYPE_PRIVACY]['version']
                    : null,
            ],
        ];
    }

    /**
     * Lightweight summary for auth/me & login payloads (never leaks private history of other users).
     *
     * @return array{requires_reacceptance: bool, pending_count: int, pending_types: list<string>}
     */
    public function getCompactLegalStatusForUser(int $userId): array
    {
        try {
            $status = $this->getUserAcceptanceStatus($userId);
            $pendingTypes = array_values(array_map(
                fn(array $doc) => (string) $doc['document_type'],
                $status['pending_documents']
            ));

            return [
                'requires_reacceptance' => (bool) $status['requires_reacceptance'],
                'pending_count' => count($pendingTypes),
                'pending_types' => $pendingTypes,
            ];
        } catch (\Throwable) {
            return [
                'requires_reacceptance' => false,
                'pending_count' => 0,
                'pending_types' => [],
            ];
        }
    }

    /**
     * Record authenticated user's acceptance/acknowledgment of published document version(s).
     * Strictly bound to the authenticated session userId (prevents IDOR / acting on behalf of another user).
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function submitAuthenticatedAcceptance(
        int $authenticatedUserId,
        array $payload,
        ?string $clientIp = null,
        ?string $userAgent = null
    ): array {
        // Explicit ownership protection: reject attempts to submit on behalf of another user
        if (isset($payload['user_id']) && (int) $payload['user_id'] !== $authenticatedUserId) {
            throw HttpException::forbidden(
                'You cannot record legal acceptance on behalf of another user.',
                'FORBIDDEN'
            );
        }

        $items = LegalValidator::validateAuthenticatedAcceptances($payload);

        // Validate every submitted version against the currently PUBLISHED document before opening transaction
        $resolvedItems = [];
        $errors = [];

        foreach ($items as $index => $item) {
            $activeDoc = $this->documentRepository->findPublishedActiveByType($item['document_type']);
            if ($activeDoc === null) {
                $errors["acceptances.{$index}.document_type"] = 'No active published document exists for this type.';
                continue;
            }
            if ((string) $activeDoc['version'] !== $item['document_version']) {
                $errors["acceptances.{$index}.document_version"] = "Version '{$item['document_version']}' is not the currently published version ({$activeDoc['version']}).";
                continue;
            }
            $resolvedItems[] = [
                'doc' => $activeDoc,
                'action' => $item['acceptance_action'],
            ];
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Submitted legal document version is invalid, unpublished, or outdated.', $errors);
        }

        $recorded = [];
        $this->database->beginTransaction();
        try {
            foreach ($resolvedItems as $entry) {
                $doc = $entry['doc'];
                $action = $entry['action'];
                $res = $this->acceptanceRepository->recordAcceptance(
                    $authenticatedUserId,
                    (int) $doc['id'],
                    (string) $doc['document_type'],
                    (string) $doc['version'],
                    $action,
                    $clientIp,
                    $userAgent
                );

                $recorded[] = $res['record'];

                if ($res['created']) {
                    $auditAction = $doc['document_type'] === LegalDocumentRepository::TYPE_PRIVACY
                        ? 'LEGAL_PRIVACY_ACKNOWLEDGED'
                        : 'LEGAL_TERMS_ACCEPTED';

                    $this->auditLogRepository->record(
                        $auditAction,
                        'user_legal_acceptances',
                        (int) ($res['record']['id'] ?? 0) ?: null,
                        $authenticatedUserId,
                        $clientIp,
                        $userAgent,
                        [
                            'document_id' => (int) $doc['id'],
                            'document_type' => (string) $doc['document_type'],
                            'document_version' => (string) $doc['version'],
                            'acceptance_action' => $action,
                            'context' => 'authenticated_reacceptance',
                            'result' => 'SUCCESS',
                        ]
                    );
                }
            }

            $this->database->commit();
        } catch (\Throwable $e) {
            $this->database->rollBack();
            if ($e instanceof HttpException) {
                throw $e;
            }
            throw HttpException::internalError('Failed to record legal acceptance.');
        }

        $status = $this->getUserAcceptanceStatus($authenticatedUserId);

        return [
            'recorded' => $recorded,
            'legal_status' => $status,
        ];
    }

    /**
     * Admin: list all legal documents (drafts, published, superseded, withdrawn).
     *
     * @return list<array<string, mixed>>
     */
    public function listAllDocuments(?string $documentType = null, ?string $status = null): array
    {
        return $this->documentRepository->listDocuments($documentType, $status);
    }

    /**
     * Admin: create a new DRAFT legal document version.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function createDraft(
        array $payload,
        int $actorUserId,
        ?string $clientIp = null,
        ?string $userAgent = null
    ): array {
        $validated = LegalValidator::validateCreateDraft($payload);

        $existing = $this->documentRepository->findByTypeAndVersion(
            $validated['document_type'],
            $validated['version']
        );
        if ($existing !== null) {
            throw HttpException::conflict(
                "Document version '{$validated['version']}' already exists for {$validated['document_type']}.",
                'LEGAL_VERSION_EXISTS',
                ['version' => 'This document version identifier already exists.']
            );
        }

        $draft = $this->documentRepository->createDraft(
            $validated['document_type'],
            $validated['version'],
            $validated['title'],
            $validated['effective_date'],
            $validated['content'],
            $validated['change_summary'],
            (bool) $validated['requires_reacceptance'],
            $actorUserId,
            (bool) $validated['is_approved']
        );

        $this->auditLogRepository->record(
            'LEGAL_DOCUMENT_DRAFT_CREATED',
            'legal_documents',
            (int) $draft['id'],
            $actorUserId,
            $clientIp,
            $userAgent,
            [
                'document_type' => $draft['document_type'],
                'document_version' => $draft['version'],
                'status' => $draft['status'],
                'requires_reacceptance' => $draft['requires_reacceptance'],
                'result' => 'SUCCESS',
            ]
        );

        return $draft;
    }

    /**
     * Admin: update an unpublished DRAFT document (strictly blocks editing PUBLISHED/SUPERSEDED/WITHDRAWN).
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function updateDraft(
        int $documentId,
        array $payload,
        int $actorUserId,
        ?string $clientIp = null,
        ?string $userAgent = null
    ): array {
        $existing = $this->documentRepository->findById($documentId);
        if ($existing === null) {
            throw HttpException::notFound('Legal document not found.', 'LEGAL_DOCUMENT_NOT_FOUND');
        }
        if ($existing['status'] !== LegalDocumentRepository::STATUS_DRAFT) {
            throw HttpException::conflict(
                'Published or historical legal documents are immutable. Create a new draft version instead.',
                'LEGAL_DOCUMENT_IMMUTABLE'
            );
        }

        $fields = LegalValidator::validateUpdateDraft($payload);
        $updated = $this->documentRepository->updateDraft($documentId, $fields);
        if ($updated === null) {
            throw HttpException::internalError('Failed to update legal document draft.');
        }

        $this->auditLogRepository->record(
            'LEGAL_DOCUMENT_DRAFT_UPDATED',
            'legal_documents',
            $documentId,
            $actorUserId,
            $clientIp,
            $userAgent,
            [
                'document_type' => $updated['document_type'],
                'document_version' => $updated['version'],
                'updated_fields' => array_keys($fields),
                'result' => 'SUCCESS',
            ]
        );

        return $updated;
    }

    /**
     * Admin (requires explicit legal_documents.publish permission): publish an approved DRAFT version.
     * Supersedes any prior PUBLISHED version without overwriting its content or acceptance records.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function publishDocument(
        int $documentId,
        array $payload,
        int $actorUserId,
        ?string $clientIp = null,
        ?string $userAgent = null
    ): array {
        $existing = $this->documentRepository->findById($documentId);
        if ($existing === null) {
            throw HttpException::notFound('Legal document not found.', 'LEGAL_DOCUMENT_NOT_FOUND');
        }
        if ($existing['status'] !== LegalDocumentRepository::STATUS_DRAFT) {
            throw HttpException::conflict(
                'Only DRAFT legal documents can be published.',
                'LEGAL_DOCUMENT_NOT_DRAFT'
            );
        }

        $options = LegalValidator::validatePublish($payload);

        $this->database->beginTransaction();
        try {
            $published = $this->documentRepository->publishDraft(
                $documentId,
                $actorUserId,
                $options['effective_date'],
                $options['requires_reacceptance'],
                $options['is_approved']
            );
            if ($published === null) {
                throw HttpException::conflict('Draft could not be published.', 'LEGAL_PUBLISH_CONFLICT');
            }

            $this->auditLogRepository->record(
                'LEGAL_DOCUMENT_PUBLISHED',
                'legal_documents',
                $documentId,
                $actorUserId,
                $clientIp,
                $userAgent,
                [
                    'document_type' => $published['document_type'],
                    'document_version' => $published['version'],
                    'effective_date' => $published['effective_date'],
                    'requires_reacceptance' => $published['requires_reacceptance'],
                    'is_approved' => $published['is_approved'],
                    'result' => 'SUCCESS',
                ]
            );

            $this->database->commit();
            return $published;
        } catch (\Throwable $e) {
            $this->database->rollBack();
            if ($e instanceof HttpException) {
                throw $e;
            }
            throw HttpException::internalError('Failed to publish legal document.');
        }
    }

    /**
     * Admin (requires explicit legal_documents.publish permission): withdraw a document while preserving history.
     *
     * @return array<string, mixed>
     */
    public function withdrawDocument(
        int $documentId,
        int $actorUserId,
        ?string $clientIp = null,
        ?string $userAgent = null
    ): array {
        $existing = $this->documentRepository->findById($documentId);
        if ($existing === null) {
            throw HttpException::notFound('Legal document not found.', 'LEGAL_DOCUMENT_NOT_FOUND');
        }

        $withdrawn = $this->documentRepository->withdrawDocument($documentId);
        if ($withdrawn === null) {
            throw HttpException::internalError('Failed to withdraw legal document.');
        }

        $this->auditLogRepository->record(
            'LEGAL_DOCUMENT_WITHDRAWN',
            'legal_documents',
            $documentId,
            $actorUserId,
            $clientIp,
            $userAgent,
            [
                'document_type' => $withdrawn['document_type'],
                'document_version' => $withdrawn['version'],
                'previous_status' => $existing['status'],
                'result' => 'SUCCESS',
            ]
        );

        return $withdrawn;
    }

    /**
     * Admin (requires legal_acceptances.view): inspect user legal acceptance audit records.
     *
     * @param array<string, mixed> $filters
     * @return array{data: list<array<string, mixed>>, meta: array<string, mixed>}
     */
    public function listAcceptances(array $filters = [], int $page = 1, int $perPage = 25): array
    {
        return $this->acceptanceRepository->listAcceptances($filters, $page, $perPage);
    }

    /**
     * @param array<string, mixed> $doc
     * @return array<string, mixed>
     */
    private function formatPublicSummary(array $doc): array
    {
        return [
            'id' => (int) $doc['id'],
            'document_type' => (string) $doc['document_type'],
            'version' => (string) $doc['version'],
            'title' => (string) $doc['title'],
            'status' => (string) $doc['status'],
            'is_approved' => (bool) $doc['is_approved'],
            'requires_reacceptance' => (bool) $doc['requires_reacceptance'],
            'effective_date' => (string) $doc['effective_date'],
            'published_at' => $doc['published_at'],
            'updated_at' => (string) $doc['updated_at'],
            'change_summary' => $doc['change_summary'],
        ];
    }

    /**
     * @param array<string, mixed> $doc
     * @return array<string, mixed>
     */
    private function formatPublicDocument(array $doc): array
    {
        $summary = $this->formatPublicSummary($doc);
        $summary['content'] = $doc['content'];
        $summary['content_sha256'] = (string) $doc['content_sha256'];
        return $summary;
    }
}
