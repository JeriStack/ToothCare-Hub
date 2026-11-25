<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Config;
use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Repositories\RateLimitRepository;
use App\Repositories\UserRepository;
use App\Services\AuthService;
use App\Services\Email\EmailOutboxService;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/**
 * Integration & Security Test Suite for Legal Documents & User Consent Management.
 * Covers public policy endpoints, registration acceptance validation, transaction atomicity,
 * server-generated timestamps, versioning, re-acceptance, Audit Trail, IDOR, and strict DRBAC.
 */
class LegalDocumentsApiTest extends TestCase
{
    private Application $app;
    private PDO $pdo;
    private UserRepository $userRepo;
    private AuthService $authService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->pdo = TestDb::create();
        RateLimitRepository::resetInMemory();

        $config = Config::getInstance();
        $config->set('auth_password_min_length', 8);
        $config->set('auth_register_rate_limit', 50);
        $config->set('auth_register_rate_window', 3600);

        $this->app = new Application();
        $this->userRepo = new UserRepository();
        $this->authService = new AuthService();
    }

    protected function tearDown(): void
    {
        restore_error_handler();
        restore_exception_handler();
        parent::tearDown();
    }

    /**
     * @param array<string, mixed>|null $body
     * @param array<string, mixed>|null $user
     */
    private function req(string $method, string $uri, ?array $user = null, ?array $body = null, array $query = []): Request
    {
        $headers = ['content-type' => 'application/json', 'user-agent' => 'ToothCare-LegalTest/1.0'];
        if (in_array(strtoupper($method), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            if (session_status() === PHP_SESSION_ACTIVE) {
                $_SESSION['csrf_token'] = 'legal-test-csrf';
                $headers['x-csrf-token'] = 'legal-test-csrf';
            }
        }
        $rawBody = $body !== null ? (string) json_encode($body) : '';
        $req = Request::create($method, $uri, $headers, $rawBody, $query);
        if ($user !== null) {
            $req->setUser($user);
        }
        return $req;
    }

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function validRegistrationPayload(string $email, array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'email' => $email,
            'password' => 'StrongPass123!',
            'phone' => '+639171234567',
            'date_of_birth' => '1995-04-12',
            'gender' => 'FEMALE',
            'accept_legal' => true,
            'terms_version' => '1.0',
            'privacy_version' => '1.0',
        ], $overrides);
    }

    /**
     * @return array<string, mixed>
     */
    private function createUserWithRole(string $email, string $role): array
    {
        $id = $this->userRepo->create($email, password_hash('AdminPass123!', PASSWORD_DEFAULT), $role, 1, 1, 'Test', $role);
        return $this->userRepo->findById($id) ?? [];
    }

    public function testPublicLegalEndpointsAccessibleWithoutAuthAndExposeNoDraftsOrPrivateData(): void
    {
        $listRes = $this->app->handle($this->req('GET', '/api/v1/legal/documents'));
        $this->assertSame(200, $listRes->getStatusCode());
        $listData = $listRes->getData();
        $this->assertSame('1.0', $listData['terms_of_service']['version']);
        $this->assertSame('1.0', $listData['privacy_policy']['version']);
        $this->assertFalse($listData['terms_of_service']['is_approved']);
        $this->assertArrayNotHasKey('acceptances', $listData);

        $tosRes = $this->app->handle($this->req('GET', '/api/v1/legal/terms-of-service'));
        $this->assertSame(200, $tosRes->getStatusCode());
        $this->assertSame('TERMS_OF_SERVICE', $tosRes->getData()['document_type']);
        $this->assertNotEmpty($tosRes->getData()['content']['sections']);

        $privacyRes = $this->app->handle($this->req('GET', '/api/v1/legal/privacy-policy'));
        $this->assertSame(200, $privacyRes->getStatusCode());
        $this->assertSame('PRIVACY_POLICY', $privacyRes->getData()['document_type']);
        $this->assertNotEmpty($privacyRes->getData()['content']['sections']);
    }

    public function testRegistrationRejectsMissingFalseInvalidOrOutdatedLegalAcceptance(): void
    {
        // 1. Missing accept_legal
        $missing = $this->validRegistrationPayload('missing.legal@example.com');
        unset($missing['accept_legal']);
        $resMissing = $this->app->handle($this->req('POST', '/api/v1/auth/register', null, $missing));
        $this->assertSame(422, $resMissing->getStatusCode());
        $this->assertArrayHasKey('accept_legal', $resMissing->getError()['details'] ?? []);

        // 2. accept_legal = false
        $falsePayload = $this->validRegistrationPayload('false.legal@example.com', ['accept_legal' => false]);
        $resFalse = $this->app->handle($this->req('POST', '/api/v1/auth/register', null, $falsePayload));
        $this->assertSame(422, $resFalse->getStatusCode());
        $this->assertArrayHasKey('accept_legal', $resFalse->getError()['details'] ?? []);

        // 3. Invalid / outdated / unpublished version
        $badVerPayload = $this->validRegistrationPayload('badver.legal@example.com', [
            'terms_version' => '9.9',
            'privacy_version' => '0.1',
        ]);
        $resBadVer = $this->app->handle($this->req('POST', '/api/v1/auth/register', null, $badVerPayload));
        $this->assertSame(422, $resBadVer->getStatusCode());
        $this->assertArrayHasKey('terms_version', $resBadVer->getError()['details'] ?? []);
        $this->assertArrayHasKey('privacy_version', $resBadVer->getError()['details'] ?? []);

        // Ensure zero accounts or acceptances were created
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM users')->fetchColumn());
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM user_legal_acceptances')->fetchColumn());
    }

    public function testRegistrationRecordsServerTimestampDistinctActionsAndAuditLogsIgnoringClientTimestamp(): void
    {
        $payload = $this->validRegistrationPayload('audit.legal@example.com', [
            'accepted_at' => '1999-01-01 00:00:00', // Forged client timestamp must be ignored
        ]);

        $res = $this->app->handle($this->req('POST', '/api/v1/auth/register', null, $payload));
        $this->assertSame(201, $res->getStatusCode());
        $userId = (int) $res->getData()['id'];

        $rows = $this->pdo->query("SELECT * FROM user_legal_acceptances WHERE user_id = {$userId} ORDER BY document_type ASC")->fetchAll(PDO::FETCH_ASSOC);
        $this->assertCount(2, $rows);

        $byType = [];
        foreach ($rows as $row) {
            $byType[$row['document_type']] = $row;
        }

        $this->assertSame('ACCEPTED', $byType['TERMS_OF_SERVICE']['acceptance_action']);
        $this->assertSame('1.0', $byType['TERMS_OF_SERVICE']['document_version']);
        $this->assertNotSame('1999-01-01 00:00:00', $byType['TERMS_OF_SERVICE']['accepted_at']);

        $this->assertSame('ACKNOWLEDGED', $byType['PRIVACY_POLICY']['acceptance_action']);
        $this->assertSame('1.0', $byType['PRIVACY_POLICY']['document_version']);
        $this->assertNotSame('1999-01-01 00:00:00', $byType['PRIVACY_POLICY']['accepted_at']);

        // Verify Audit Trail entries recorded without exposing passwords
        $auditRows = $this->pdo->query("SELECT action, sanitized_payload FROM audit_logs WHERE actor_user_id = {$userId}")->fetchAll(PDO::FETCH_ASSOC);
        $actions = array_column($auditRows, 'action');
        $this->assertContains('LEGAL_TERMS_ACCEPTED', $actions);
        $this->assertContains('LEGAL_PRIVACY_ACKNOWLEDGED', $actions);
        foreach ($auditRows as $audit) {
            $this->assertStringNotContainsString('StrongPass123!', (string) ($audit['sanitized_payload'] ?? ''));
        }
    }

    public function testFailedRegistrationRollsBackLegalAcceptancesAtomically(): void
    {
        $failingOutbox = new class (null, null, null, null, null, null) extends EmailOutboxService {
            public function queueVerification(string $email, string $name, int $userId, string $rawToken, int $tokenId, int $ttlSeconds): ?int
            {
                throw new \RuntimeException('Simulated email outbox failure');
            }
        };

        $auth = new AuthService(null, null, null, null, null, null, $failingOutbox);
        $payload = $this->validRegistrationPayload('atomic.rollback@example.com');

        try {
            $auth->register($payload);
            $this->fail('Expected HttpException when outbox fails');
        } catch (HttpException $e) {
            $this->assertSame(500, $e->getStatusCode());
        }

        $this->assertSame(0, (int) $this->pdo->query("SELECT COUNT(*) FROM users WHERE email = 'atomic.rollback@example.com'")->fetchColumn());
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM user_legal_acceptances')->fetchColumn());
    }

    public function testSecurityBoundariesIdorProtectionAndStrictDrbacPublishRestriction(): void
    {
        // Unauthenticated requests to private acceptance and admin endpoints fail with 401
        $this->assertSame(401, $this->app->handle($this->req('GET', '/api/v1/legal/acceptances/me'))->getStatusCode());
        $this->assertSame(401, $this->app->handle($this->req('GET', '/api/v1/admin/legal/documents'))->getStatusCode());

        // Register two patients
        $reg1 = $this->authService->register($this->validRegistrationPayload('patient.one@example.com'));
        $reg2 = $this->authService->register($this->validRegistrationPayload('patient.two@example.com'));
        $patient1 = $this->userRepo->findById((int) $reg1['id']);

        // Patient cannot access admin legal endpoints
        $this->assertSame(403, $this->app->handle($this->req('GET', '/api/v1/admin/legal/documents', $patient1))->getStatusCode());
        $this->assertSame(403, $this->app->handle($this->req('GET', '/api/v1/admin/legal/acceptances', $patient1))->getStatusCode());

        // Patient cannot submit acceptance on behalf of another user (IDOR prevention)
        $idorRes = $this->app->handle($this->req('POST', '/api/v1/legal/acceptances', $patient1, [
            'user_id' => (int) $reg2['id'],
            'acceptances' => [
                ['document_type' => 'TERMS_OF_SERVICE', 'document_version' => '1.0', 'accepted' => true],
            ],
        ]));
        $this->assertSame(403, $idorRes->getStatusCode());

        // Standard ADMIN (without explicit legal_documents.publish) can create/edit draft, CANNOT publish
        $admin = $this->createUserWithRole('clinic.admin@example.com', 'ADMIN');

        $draftRes = $this->app->handle($this->req('POST', '/api/v1/admin/legal/documents', $admin, [
            'document_type' => 'TERMS_OF_SERVICE',
            'version' => '2.0',
            'title' => 'Terms of Service',
            'effective_date' => '2026-12-01',
            'requires_reacceptance' => true,
            'change_summary' => 'Material update to clinic appointment policy.',
            'content' => [
                'introduction' => 'Updated v2.0 Terms of Service.',
                'sections' => [
                    ['id' => 'intro', 'heading' => '1. Introduction', 'paragraphs' => ['Updated terms body.']],
                ],
            ],
        ]));
        $this->assertSame(201, $draftRes->getStatusCode());
        $draftId = (int) $draftRes->getData()['id'];
        $this->assertSame('DRAFT', $draftRes->getData()['status']);

        // Draft document must NOT appear on public endpoint
        $publicTos = $this->app->handle($this->req('GET', '/api/v1/legal/terms-of-service'));
        $this->assertSame('1.0', $publicTos->getData()['version']);

        // Attempting to register using unpublished DRAFT version 2.0 must fail with 422
        $draftReg = $this->app->handle($this->req('POST', '/api/v1/auth/register', null, $this->validRegistrationPayload('draft.user@example.com', [
            'terms_version' => '2.0',
        ])));
        $this->assertSame(422, $draftReg->getStatusCode());

        // Admin can edit DRAFT, but CANNOT edit already PUBLISHED v1.0
        $editDraftRes = $this->app->handle($this->req('PATCH', "/api/v1/admin/legal/documents/{$draftId}", $admin, [
            'change_summary' => 'Refined summary after legal review.',
        ]));
        $this->assertSame(200, $editDraftRes->getStatusCode());

        $publishedId = (int) $publicTos->getData()['id'];
        $editPublishedRes = $this->app->handle($this->req('PATCH', "/api/v1/admin/legal/documents/{$publishedId}", $admin, [
            'title' => 'Tampered Historical Terms',
        ]));
        $this->assertSame(409, $editPublishedRes->getStatusCode());

        // Standard ADMIN WITHOUT legal_documents.publish MUST be blocked with 403
        $blockedPubRes = $this->app->handle($this->req('POST', "/api/v1/admin/legal/documents/{$draftId}/publish", $admin, [
            'requires_reacceptance' => true,
            'is_approved' => true,
        ]));
        $this->assertSame(403, $blockedPubRes->getStatusCode());
    }

    public function testVersioningMaterialReacceptanceWorkflowAndPreservationOfHistoricalRecords(): void
    {
        // Register patient on v1.0
        $reg = $this->authService->register($this->validRegistrationPayload('reaccept.patient@example.com'));
        $patientId = (int) $reg['id'];
        $patient = $this->userRepo->findById($patientId);

        // Initially no pending re-acceptance
        $initialStatus = $this->app->handle($this->req('GET', '/api/v1/legal/acceptances/me', $patient));
        $this->assertSame(200, $initialStatus->getStatusCode());
        $this->assertFalse($initialStatus->getData()['requires_reacceptance']);
        $this->assertCount(2, $initialStatus->getData()['acceptances']);

        // Grant explicit legal_documents.publish permission to admin role for authorized publication
        $this->pdo->exec("
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM roles r JOIN permissions p ON p.slug = 'legal_documents.publish' WHERE r.slug = 'admin'
        ");
        $publisher = $this->createUserWithRole('authorized.publisher@example.com', 'ADMIN');

        // 1. Publish a MINOR Privacy Policy v1.1 (requires_reacceptance = false) -> must NOT force re-acceptance
        $minorDraft = $this->app->handle($this->req('POST', '/api/v1/admin/legal/documents', $publisher, [
            'document_type' => 'PRIVACY_POLICY',
            'version' => '1.1',
            'title' => 'Privacy Policy',
            'effective_date' => '2026-12-01',
            'requires_reacceptance' => false,
            'change_summary' => 'Minor typo clarification.',
            'content' => ['sections' => [['id' => 's1', 'heading' => '1. Clarified', 'paragraphs' => ['Minor wording fix.']]]],
        ]));
        $this->assertSame(201, $minorDraft->getStatusCode());
        $minorId = (int) $minorDraft->getData()['id'];

        $minorPub = $this->app->handle($this->req('POST', "/api/v1/admin/legal/documents/{$minorId}/publish", $publisher, [
            'requires_reacceptance' => false,
        ]));
        $this->assertSame(200, $minorPub->getStatusCode());

        $afterMinor = $this->app->handle($this->req('GET', '/api/v1/legal/acceptances/me', $patient));
        $this->assertFalse($afterMinor->getData()['requires_reacceptance']);

        // 2. Publish a MATERIAL Terms of Service v2.0 (requires_reacceptance = true) -> MUST require re-acceptance
        $majorDraft = $this->app->handle($this->req('POST', '/api/v1/admin/legal/documents', $publisher, [
            'document_type' => 'TERMS_OF_SERVICE',
            'version' => '2.0',
            'title' => 'Terms of Service',
            'effective_date' => '2026-12-15',
            'requires_reacceptance' => true,
            'change_summary' => 'Approved clinic cancellation policy added.',
            'content' => ['sections' => [['id' => 's1', 'heading' => '1. Updated Terms', 'paragraphs' => ['New approved terms.']]]],
        ]));
        $majorId = (int) $majorDraft->getData()['id'];

        $majorPub = $this->app->handle($this->req('POST', "/api/v1/admin/legal/documents/{$majorId}/publish", $publisher, [
            'requires_reacceptance' => true,
            'is_approved' => true,
        ]));
        $this->assertSame(200, $majorPub->getStatusCode());
        $this->assertSame('PUBLISHED', $majorPub->getData()['status']);

        // Old v1.0 must be SUPERSEDED, never deleted or overwritten
        $v1Row = $this->pdo->query("SELECT status, content_json FROM legal_documents WHERE document_type = 'TERMS_OF_SERVICE' AND version = '1.0'")->fetch(PDO::FETCH_ASSOC);
        $this->assertSame('SUPERSEDED', $v1Row['status']);
        $this->assertStringContainsString('ToothCare Hub', (string) $v1Row['content_json']);

        // Patient now sees pending re-acceptance for Terms v2.0
        $afterMajor = $this->app->handle($this->req('GET', '/api/v1/legal/acceptances/me', $patient));
        $this->assertTrue($afterMajor->getData()['requires_reacceptance']);
        $this->assertCount(1, $afterMajor->getData()['pending_documents']);
        $this->assertSame('2.0', $afterMajor->getData()['pending_documents'][0]['version']);

        // Patient submits acceptance of v2.0
        $acceptRes = $this->app->handle($this->req('POST', '/api/v1/legal/acceptances', $patient, [
            'acceptances' => [
                [
                    'document_type' => 'TERMS_OF_SERVICE',
                    'document_version' => '2.0',
                    'acceptance_action' => 'ACCEPTED',
                    'accepted' => true,
                ],
            ],
        ]));
        $this->assertSame(201, $acceptRes->getStatusCode());
        $this->assertFalse($acceptRes->getData()['legal_status']['requires_reacceptance']);

        // Duplicate submission is idempotent (still 3 total records: ToS 1.0, Privacy 1.0, ToS 2.0)
        $dupRes = $this->app->handle($this->req('POST', '/api/v1/legal/acceptances', $patient, [
            'acceptances' => [
                [
                    'document_type' => 'TERMS_OF_SERVICE',
                    'document_version' => '2.0',
                    'acceptance_action' => 'ACCEPTED',
                    'accepted' => true,
                ],
            ],
        ]));
        $this->assertSame(201, $dupRes->getStatusCode());
        $this->assertCount(3, $dupRes->getData()['legal_status']['acceptances']);

        // Admin with legal_acceptances.view can audit acceptance records
        $adminList = $this->app->handle($this->req('GET', '/api/v1/admin/legal/acceptances', $publisher, null, ['user_id' => (string) $patientId]));
        $this->assertSame(200, $adminList->getStatusCode());
        $this->assertCount(3, $adminList->getData());
    }
}
