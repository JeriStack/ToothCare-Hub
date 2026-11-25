<?php

declare(strict_types=1);

namespace App\OpenApi\Paths;

use OpenApi\Attributes as OA;

/**
 * OpenAPI 3.0.3 Path Definitions: Legal Documents, Versioning, and User Consent / Acceptance Management.
 */
final class LegalPaths
{
    #[OA\Get(
        path: '/legal/documents',
        operationId: 'listPublicLegalDocuments',
        summary: 'List Currently Published Legal Documents (Public)',
        description: 'Returns version, effective date, approval flag, and metadata for the currently PUBLISHED Terms of Service and Privacy Policy.',
        tags: ['Legal'],
        responses: [new OA\Response(response: 200, description: 'Active published legal documents summary')]
    )]
    public function listPublic(): void {}

    #[OA\Get(
        path: '/legal/terms-of-service',
        operationId: 'getPublicTermsOfService',
        summary: 'Retrieve Active Published Terms of Service (Public)',
        tags: ['Legal'],
        responses: [
            new OA\Response(response: 200, description: 'Active Terms of Service document'),
            new OA\Response(response: 404, description: 'No published Terms of Service found'),
        ]
    )]
    public function showTerms(): void {}

    #[OA\Get(
        path: '/legal/privacy-policy',
        operationId: 'getPublicPrivacyPolicy',
        summary: 'Retrieve Active Published Privacy Policy (Public)',
        tags: ['Legal'],
        responses: [
            new OA\Response(response: 200, description: 'Active Privacy Policy document'),
            new OA\Response(response: 404, description: 'No published Privacy Policy found'),
        ]
    )]
    public function showPrivacy(): void {}

    #[OA\Get(
        path: '/legal/acceptances/me',
        operationId: 'getMyLegalAcceptances',
        summary: 'Get Authenticated User Legal Acceptance Status & History',
        tags: ['Legal'],
        security: [['CookieAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'User acceptance history and pending re-acceptance documents'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
        ]
    )]
    public function myAcceptances(): void {}

    #[OA\Post(
        path: '/legal/acceptances',
        operationId: 'submitLegalAcceptances',
        summary: 'Submit Authenticated Legal Acceptance or Acknowledgment',
        description: 'Records server-timestamped acceptance (Terms of Service) or acknowledgment (Privacy Policy) bound strictly to the authenticated session user.',
        tags: ['Legal'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['acceptances'],
                properties: [
                    new OA\Property(
                        property: 'acceptances',
                        type: 'array',
                        items: new OA\Items(
                            type: 'object',
                            required: ['document_type', 'document_version'],
                            properties: [
                                new OA\Property(property: 'document_type', type: 'string', enum: ['TERMS_OF_SERVICE', 'PRIVACY_POLICY']),
                                new OA\Property(property: 'document_version', type: 'string', example: '2.0'),
                                new OA\Property(property: 'acceptance_action', type: 'string', enum: ['ACCEPTED', 'ACKNOWLEDGED']),
                                new OA\Property(property: 'accepted', type: 'boolean', example: true),
                            ]
                        )
                    ),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Legal acceptance(s) recorded'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden (IDOR or CSRF failure)'),
            new OA\Response(response: 422, description: 'Invalid, unpublished, or outdated document version'),
        ]
    )]
    public function submitAcceptances(): void {}

    #[OA\Get(
        path: '/admin/legal/documents',
        operationId: 'adminListLegalDocuments',
        summary: 'List All Legal Documents & Version History (DRBAC: legal_documents.view)',
        tags: ['Legal'],
        security: [['CookieAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'All legal document versions'),
            new OA\Response(response: 403, description: 'Missing legal_documents.view permission'),
        ]
    )]
    public function adminListDocuments(): void {}

    #[OA\Post(
        path: '/admin/legal/documents',
        operationId: 'adminCreateLegalDraft',
        summary: 'Create Legal Document Draft (DRBAC: legal_documents.create)',
        tags: ['Legal'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Draft legal document created'),
            new OA\Response(response: 403, description: 'Missing legal_documents.create permission'),
            new OA\Response(response: 409, description: 'Version already exists'),
            new OA\Response(response: 422, description: 'Validation error'),
        ]
    )]
    public function adminCreateDraft(): void {}

    #[OA\Patch(
        path: '/admin/legal/documents/{id}',
        operationId: 'adminUpdateLegalDraft',
        summary: 'Update Unpublished Legal Document Draft (DRBAC: legal_documents.edit)',
        tags: ['Legal'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Draft updated'),
            new OA\Response(response: 403, description: 'Missing legal_documents.edit permission'),
            new OA\Response(response: 409, description: 'Published/historical document is immutable'),
        ]
    )]
    public function adminUpdateDraft(): void {}

    #[OA\Post(
        path: '/admin/legal/documents/{id}/publish',
        operationId: 'adminPublishLegalDocument',
        summary: 'Publish Approved Legal Document Version (DRBAC: legal_documents.publish)',
        tags: ['Legal'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Draft published and previous active version superseded'),
            new OA\Response(response: 403, description: 'Missing explicit legal_documents.publish permission'),
            new OA\Response(response: 409, description: 'Target document is not a draft'),
        ]
    )]
    public function adminPublishDocument(): void {}

    #[OA\Post(
        path: '/admin/legal/documents/{id}/withdraw',
        operationId: 'adminWithdrawLegalDocument',
        summary: 'Withdraw Legal Document Version (DRBAC: legal_documents.publish)',
        tags: ['Legal'],
        security: [['CookieAuth' => [], 'CsrfToken' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Document marked as WITHDRAWN while preserving history'),
            new OA\Response(response: 403, description: 'Missing explicit legal_documents.publish permission'),
        ]
    )]
    public function adminWithdrawDocument(): void {}

    #[OA\Get(
        path: '/admin/legal/acceptances',
        operationId: 'adminListLegalAcceptances',
        summary: 'List User Legal Acceptance Audit Records (DRBAC: legal_acceptances.view)',
        tags: ['Legal'],
        security: [['CookieAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Paginated user legal acceptance records'),
            new OA\Response(response: 403, description: 'Missing legal_acceptances.view permission'),
        ]
    )]
    public function adminListAcceptances(): void {}
}
