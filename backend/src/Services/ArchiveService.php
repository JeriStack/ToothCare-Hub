<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\HttpException;
use App\Repositories\AppointmentRepository;
use App\Repositories\ArchiveRepository;
use App\Repositories\AuditLogRepository;
use App\Repositories\DentistRepository;
use App\Repositories\PatientRepository;
use App\Repositories\RoleRepository;
use App\Repositories\ServiceRepository;
use App\Repositories\TreatmentRecordRepository;
use App\Repositories\UserRepository;
use App\Support\ServerTableQuery;
use DateTimeImmutable;
use DateTimeZone;
use Throwable;

/**
 * Role-Aware Clinic Archive & Retention Service
 *
 * Enforces healthcare retention compliance, role-based entity visibility,
 * ownership isolation, tamper-evident SHA-256 snapshotting, reversible soft-restore,
 * and forensic audit logging across Patients, Dentists, Receptionists, and Admins.
 */
class ArchiveService
{
    private const ROLE_ALLOWED_VIEW_TYPES = [
        'ADMIN' => ['appointment', 'treatment_record', 'patient', 'dentist', 'service', 'user'],
        'RECEPTIONIST' => ['appointment', 'patient', 'service'],
        'DENTIST' => ['appointment', 'treatment_record'],
        'PATIENT' => ['appointment', 'treatment_record'],
    ];

    private const ROLE_ALLOWED_CREATE_TYPES = [
        'ADMIN' => ['appointment', 'treatment_record', 'patient', 'dentist', 'service', 'user'],
        'RECEPTIONIST' => ['appointment'],
        'DENTIST' => ['appointment', 'treatment_record'],
        'PATIENT' => [],
    ];

    private const DEFAULT_RETENTION_BY_ENTITY = [
        'treatment_record' => ['category' => 'CLINICAL_7Y', 'years' => 7],
        'appointment' => ['category' => 'OPERATIONAL_3Y', 'years' => 3],
        'patient' => ['category' => 'ACCOUNT_5Y', 'years' => 5],
        'dentist' => ['category' => 'ACCOUNT_5Y', 'years' => 5],
        'user' => ['category' => 'ACCOUNT_5Y', 'years' => 5],
        'service' => ['category' => 'CATALOG_LEGACY', 'years' => 3],
    ];

    private const RETENTION_YEARS = [
        'CLINICAL_7Y' => 7,
        'OPERATIONAL_3Y' => 3,
        'ACCOUNT_5Y' => 5,
        'CATALOG_LEGACY' => 3,
    ];

    private Database $database;
    private ArchiveRepository $archiveRepo;
    private AuditLogRepository $auditRepo;
    private AppointmentRepository $appointmentRepo;
    private TreatmentRecordRepository $treatmentRepo;
    private PatientRepository $patientRepo;
    private DentistRepository $dentistRepo;
    private ServiceRepository $serviceRepo;
    private UserRepository $userRepo;
    private RoleRepository $roleRepo;
    private DateTimeZone $tz;

    public function __construct(?Database $database = null)
    {
        $db = $database ?? Database::getInstance();
        $this->database = $db;
        $this->archiveRepo = new ArchiveRepository($db);
        $this->auditRepo = new AuditLogRepository($db);
        $this->appointmentRepo = new AppointmentRepository($db);
        $this->treatmentRepo = new TreatmentRecordRepository($db);
        $this->patientRepo = new PatientRepository($db);
        $this->dentistRepo = new DentistRepository($db);
        $this->serviceRepo = new ServiceRepository($db);
        $this->userRepo = new UserRepository($db);
        $this->roleRepo = new RoleRepository($db);
        $this->tz = new DateTimeZone('Asia/Manila');
    }

    /**
     * Evaluate live DRBAC permission for a role with a safe fallback when DRBAC tables are unavailable.
     */
    private function roleHasArchivePermission(string $role, string $permissionSlug, bool $fallback): bool
    {
        try {
            return $this->roleRepo->roleHasPermission($role, $permissionSlug);
        } catch (Throwable $e) {
            return $fallback;
        }
    }

    /**
     * Resolve strict server-side visibility & ownership scope for the authenticated user.
     *
     * @param array<string, mixed> $user
     * @return array{role: string, user_id: int, patient_id: ?int, dentist_id: ?int, allowed_types: list<string>, creatable_types: list<string>}
     */
    public function resolveActorScope(array $user): array
    {
        $role = strtoupper((string) ($user['role'] ?? 'PATIENT'));
        $userId = (int) ($user['id'] ?? 0);
        $patientId = null;
        $dentistId = null;

        if ($role === 'PATIENT' && $userId > 0) {
            $patient = $this->patientRepo->findByUserId($userId);
            $patientId = $patient ? (int) $patient['id'] : null;
        } elseif ($role === 'DENTIST' && $userId > 0) {
            $dentist = $this->dentistRepo->findByUserId($userId);
            $dentistId = $dentist ? (int) $dentist['id'] : null;
        }

        return [
            'role' => $role,
            'user_id' => $userId,
            'patient_id' => $patientId,
            'dentist_id' => $dentistId,
            'allowed_types' => self::ROLE_ALLOWED_VIEW_TYPES[$role] ?? [],
            'creatable_types' => self::ROLE_ALLOWED_CREATE_TYPES[$role] ?? [],
        ];
    }

    /**
     * Validate list/export filter query parameters strictly against allowlists and actor scope.
     *
     * @param array{role: string, user_id: int, patient_id: ?int, dentist_id: ?int, allowed_types: list<string>, creatable_types: list<string>} $scope
     * @param array<string, mixed> $query
     * @return array<string, mixed>
     */
    private function validateListFilters(array $scope, array $query): array
    {
        $sort = ServerTableQuery::parseSort(
            $query,
            ArchiveRepository::SORT_ALLOWLIST,
            'archived_at',
            'DESC',
            'ar.id',
            true
        );

        $filters = [
            'sort_by' => $sort['sort_by'],
            'sort_dir' => $sort['sort_dir'],
        ];

        if (isset($query['entity_type']) && trim((string) $query['entity_type']) !== '') {
            $entityType = strtolower(trim((string) $query['entity_type']));
            if (!in_array($entityType, ArchiveRepository::ENTITY_TYPES, true)) {
                throw HttpException::unprocessableEntity('Invalid entity_type filter.', [
                    'entity_type' => ['Allowed entity types: ' . implode(', ', ArchiveRepository::ENTITY_TYPES)],
                ]);
            }
            if (!in_array($entityType, $scope['allowed_types'], true)) {
                throw HttpException::forbidden('Your role is not authorized to view archives for this entity type.');
            }
            $filters['entity_type'] = $entityType;
        }

        if (isset($query['status']) && trim((string) $query['status']) !== '') {
            $status = strtoupper(trim((string) $query['status']));
            if (!in_array($status, ArchiveRepository::STATUSES, true)) {
                throw HttpException::unprocessableEntity('Invalid status filter.', [
                    'status' => ['Allowed statuses: ' . implode(', ', ArchiveRepository::STATUSES)],
                ]);
            }
            $filters['status'] = $status;
        }

        if (isset($query['retention_category']) && trim((string) $query['retention_category']) !== '') {
            $ret = strtoupper(trim((string) $query['retention_category']));
            if (!in_array($ret, ArchiveRepository::RETENTION_CATEGORIES, true)) {
                throw HttpException::unprocessableEntity('Invalid retention_category filter.', [
                    'retention_category' => ['Allowed retention categories: ' . implode(', ', ArchiveRepository::RETENTION_CATEGORIES)],
                ]);
            }
            $filters['retention_category'] = $ret;
        }

        if (isset($query['include_examples']) && trim((string) $query['include_examples']) !== '') {
            $rawEx = strtolower(trim((string) $query['include_examples']));
            if (in_array($rawEx, ['0', 'false', 'no'], true)) {
                $filters['include_examples'] = false;
            }
        }

        if (isset($query['search']) && trim((string) $query['search']) !== '') {
            $filters['search'] = trim((string) $query['search']);
        }

        $dateFrom = isset($query['date_from']) && trim((string) $query['date_from']) !== ''
            ? trim((string) $query['date_from'])
            : (isset($query['date']) && trim((string) $query['date']) !== '' ? trim((string) $query['date']) : '');
        $dateTo = isset($query['date_to']) && trim((string) $query['date_to']) !== ''
            ? trim((string) $query['date_to'])
            : (isset($query['date']) && trim((string) $query['date']) !== '' ? trim((string) $query['date']) : '');

        if ($dateFrom !== '') {
            $this->assertValidDate($dateFrom, 'date_from');
            $filters['date_from'] = $dateFrom;
        }
        if ($dateTo !== '') {
            $this->assertValidDate($dateTo, 'date_to');
            $filters['date_to'] = $dateTo;
        }
        if ($dateFrom !== '' && $dateTo !== '' && $dateTo < $dateFrom) {
            throw HttpException::unprocessableEntity('date_to cannot be earlier than date_from.', [
                'date_to' => ['date_to must be on or after date_from.'],
            ]);
        }

        return $filters;
    }

    /**
     * Validate and list role-scoped archive records.
     *
     * @param array<string, mixed> $user
     * @param array<string, mixed> $query
     * @return array{data: list<array<string, mixed>>, meta: array<string, mixed>}
     */
    public function listArchives(array $user, array $query): array
    {
        $scope = $this->resolveActorScope($user);
        $paging = ServerTableQuery::parsePagination($query, 10, 100);
        $filters = $this->validateListFilters($scope, $query);

        $canRestore = $scope['role'] === 'ADMIN'
            && $this->roleHasArchivePermission($scope['role'], 'archives.restore', true);

        $result = $this->archiveRepo->listForActor($scope, $filters, $paging['page'], $paging['per_page']);
        $rows = array_map(
            fn (array $row): array => $this->presentSummaryRow($row, $scope['role'], $canRestore),
            $result['data']
        );

        return [
            'data' => $rows,
            'meta' => $result['meta'],
        ];
    }

    /**
     * Return role-scoped archive KPI summary and live DRBAC-synchronized capabilities.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function getSummary(array $user): array
    {
        $scope = $this->resolveActorScope($user);
        $summary = $this->archiveRepo->summaryForActor($scope);

        $canArchive = count($scope['creatable_types']) > 0
            && $this->roleHasArchivePermission($scope['role'], 'archives.create', count($scope['creatable_types']) > 0);
        $canRestore = $scope['role'] === 'ADMIN'
            && $this->roleHasArchivePermission($scope['role'], 'archives.restore', true);
        $canExport = in_array($scope['role'], ['ADMIN', 'RECEPTIONIST'], true)
            && $this->roleHasArchivePermission($scope['role'], 'archives.export', true);

        return array_merge($summary, [
            'role' => $scope['role'],
            'allowed_entity_types' => $scope['allowed_types'],
            'creatable_entity_types' => $canArchive ? $scope['creatable_types'] : [],
            'capabilities' => [
                'can_archive' => $canArchive,
                'can_restore' => $canRestore,
                'can_export' => $canExport,
            ],
        ]);
    }

    /**
     * Inspect a single archive record with SHA-256 tamper verification.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function getArchiveDetail(array $user, int $archiveId): array
    {
        $scope = $this->resolveActorScope($user);
        $record = $this->archiveRepo->findById($archiveId);
        if ($record === null) {
            throw HttpException::notFound("Archive record #{$archiveId} was not found.");
        }

        $this->assertCanViewRecord($scope, $record);

        $rawJson = (string) ($record['snapshot_json'] ?? '{}');
        $computedHash = hash('sha256', $rawJson);
        $storedHash = strtolower(trim((string) ($record['snapshot_sha256'] ?? '')));
        $integrityVerified = $storedHash !== '' && hash_equals($storedHash, $computedHash);

        $snapshot = json_decode($rawJson, true);
        if (!is_array($snapshot)) {
            $snapshot = [];
        }

        // Strip sensitive or staff-only fields for patients
        $snapshot = $this->auditRepo->sanitizePayload($snapshot);
        if ($scope['role'] === 'PATIENT') {
            unset($snapshot['archived_by_email'], $snapshot['restored_by_email'], $snapshot['ip_address']);
        }

        $canRestore = $scope['role'] === 'ADMIN'
            && $this->roleHasArchivePermission($scope['role'], 'archives.restore', true);

        return array_merge($this->presentSummaryRow($record, $scope['role'], $canRestore), [
            'snapshot' => $snapshot,
            'snapshot_sha256' => $storedHash,
            'integrity_verified' => $integrityVerified,
        ]);
    }

    /**
     * Archive a live clinic entity atomically with a tamper-evident snapshot and audit log entry.
     *
     * @param array<string, mixed> $user
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function archiveEntity(
        array $user,
        array $input,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): array {
        $scope = $this->resolveActorScope($user);
        $entityType = strtolower(trim((string) ($input['entity_type'] ?? '')));
        $entityId = (int) ($input['entity_id'] ?? 0);
        $reason = trim((string) ($input['reason'] ?? ''));

        $errors = [];
        if (!in_array($entityType, ArchiveRepository::ENTITY_TYPES, true)) {
            $errors['entity_type'] = ['Valid entity_type is required: ' . implode(', ', ArchiveRepository::ENTITY_TYPES)];
        }
        if ($entityId <= 0) {
            $errors['entity_id'] = ['entity_id must be a positive integer.'];
        }
        if (mb_strlen($reason) < 5 || mb_strlen($reason) > 500) {
            $errors['reason'] = ['Archive reason must be between 5 and 500 characters for audit compliance.'];
        }

        $defaultRet = self::DEFAULT_RETENTION_BY_ENTITY[$entityType] ?? ['category' => 'OPERATIONAL_3Y', 'years' => 3];
        $retentionCategory = !empty($input['retention_category'])
            ? strtoupper(trim((string) $input['retention_category']))
            : $defaultRet['category'];
        if (!in_array($retentionCategory, ArchiveRepository::RETENTION_CATEGORIES, true)) {
            $errors['retention_category'] = ['Invalid retention_category.'];
        } elseif ($entityType === 'treatment_record' && $retentionCategory !== 'CLINICAL_7Y') {
            $errors['retention_category'] = ['Clinical treatment records must use CLINICAL_7Y (7-year minimum healthcare retention).'];
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Archive request validation failed.', $errors);
        }

        if (!in_array($entityType, $scope['creatable_types'], true)) {
            throw HttpException::forbidden("Your role ({$scope['role']}) is not authorized to archive {$entityType} records.");
        }

        // Prevent duplicate active archive entries
        $existing = $this->archiveRepo->findActiveByEntity($entityType, $entityId);
        if ($existing !== null) {
            throw HttpException::conflict(
                "This {$entityType} (#{$entityId}) is already archived under {$existing['reference_code']}.",
                'ALREADY_ARCHIVED'
            );
        }

        $built = $this->buildEntitySnapshot($scope, $entityType, $entityId);

        $years = self::RETENTION_YEARS[$retentionCategory] ?? 3;
        $retentionUntil = (new DateTimeImmutable('now', $this->tz))->modify("+{$years} years")->format('Y-m-d');
        $prefixMap = [
            'appointment' => 'APT',
            'treatment_record' => 'TR',
            'patient' => 'PAT',
            'dentist' => 'DNT',
            'service' => 'SRV',
            'user' => 'USR',
        ];
        $refPrefix = $prefixMap[$entityType] ?? 'REC';
        $referenceCode = sprintf('ARC-%s-%06d-%s', $refPrefix, $entityId, strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)));

        $sanitizedSnapshot = $this->auditRepo->sanitizePayload($built['snapshot']);
        $snapshotJson = json_encode($sanitizedSnapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
        $snapshotHash = hash('sha256', $snapshotJson);

        $status = $entityType === 'treatment_record' ? 'LOCKED_RETENTION' : 'ARCHIVED';

        $pdo = $this->database->getConnection();
        $startedTx = !$pdo->inTransaction();
        if ($startedTx) {
            $pdo->beginTransaction();
        }

        try {
            $archiveId = $this->archiveRepo->create([
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'reference_code' => $referenceCode,
                'title' => $built['title'],
                'summary' => $built['summary'],
                'owner_patient_id' => $built['owner_patient_id'],
                'owner_dentist_id' => $built['owner_dentist_id'],
                'owner_user_id' => $built['owner_user_id'],
                'status' => $status,
                'retention_category' => $retentionCategory,
                'retention_until' => $retentionUntil,
                'archive_reason' => $reason,
                'archived_by_user_id' => $scope['user_id'] > 0 ? $scope['user_id'] : null,
                'archived_by_role' => $scope['role'],
                'snapshot_json' => $snapshotJson,
                'snapshot_sha256' => $snapshotHash,
                'is_example' => 0,
            ]);

            // Synchronize reversible active flags safely without deleting relational history
            $this->deactivateSourceIfApplicable($entityType, $entityId);

            $this->auditRepo->record(
                'RECORD_ARCHIVED',
                'archives',
                $archiveId,
                $scope['user_id'] > 0 ? $scope['user_id'] : null,
                $ipAddress,
                $userAgent,
                [
                    'reference_code' => $referenceCode,
                    'entity_type' => $entityType,
                    'entity_id' => $entityId,
                    'status' => $status,
                    'retention_category' => $retentionCategory,
                    'retention_until' => $retentionUntil,
                    'reason' => $reason,
                    'snapshot_sha256' => $snapshotHash,
                ]
            );

            if ($startedTx) {
                $pdo->commit();
            }
        } catch (Throwable $e) {
            if ($startedTx && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        return $this->getArchiveDetail($user, $archiveId);
    }

    /**
     * Restore a soft-archived record atomically (Admin only; blocks immutable clinical retention locks).
     *
     * @param array<string, mixed> $user
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function restoreArchive(
        array $user,
        int $archiveId,
        array $input,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): array {
        $scope = $this->resolveActorScope($user);
        if ($scope['role'] !== 'ADMIN') {
            throw HttpException::forbidden('Only administrators with archives.restore permission can restore archived records.');
        }

        $reason = trim((string) ($input['reason'] ?? ''));
        if (mb_strlen($reason) < 5 || mb_strlen($reason) > 500) {
            throw HttpException::unprocessableEntity('Restore reason must be between 5 and 500 characters.', [
                'reason' => ['Restore reason must be between 5 and 500 characters.'],
            ]);
        }

        $record = $this->archiveRepo->findById($archiveId);
        if ($record === null) {
            throw HttpException::notFound("Archive record #{$archiveId} was not found.");
        }

        if ((int) ($record['is_example'] ?? 0) === 1) {
            throw HttpException::conflict('Example audit records are read-only demonstration snapshots and cannot be restored.', 'EXAMPLE_RECORD_READ_ONLY');
        }

        if (strtoupper((string) $record['status']) === 'LOCKED_RETENTION') {
            throw HttpException::conflict(
                'Clinical records under LOCKED_RETENTION are permanently immutable for healthcare compliance and cannot be restored.',
                'CLINICAL_ARCHIVE_IMMUTABLE'
            );
        }

        if (strtoupper((string) $record['status']) === 'RESTORED') {
            throw HttpException::conflict('This archive record has already been restored.', 'ALREADY_RESTORED');
        }

        $pdo = $this->database->getConnection();
        $startedTx = !$pdo->inTransaction();
        if ($startedTx) {
            $pdo->beginTransaction();
        }

        try {
            $marked = $this->archiveRepo->markRestored($archiveId, $scope['user_id'], $reason);
            if (!$marked) {
                throw HttpException::conflict('This archive record has already been restored.', 'ALREADY_RESTORED');
            }

            $this->reactivateSourceIfApplicable((string) $record['entity_type'], (int) $record['entity_id']);

            $this->auditRepo->record(
                'RECORD_RESTORED',
                'archives',
                $archiveId,
                $scope['user_id'] > 0 ? $scope['user_id'] : null,
                $ipAddress,
                $userAgent,
                [
                    'reference_code' => $record['reference_code'],
                    'entity_type' => $record['entity_type'],
                    'entity_id' => (int) $record['entity_id'],
                    'reason' => $reason,
                ]
            );

            if ($startedTx) {
                $pdo->commit();
            }
        } catch (Throwable $e) {
            if ($startedTx && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        return $this->getArchiveDetail($user, $archiveId);
    }

    /**
     * Export filtered role-scoped archive records to CSV with spreadsheet formula-injection neutralization.
     *
     * @param array<string, mixed> $user
     * @param array<string, mixed> $query
     */
    public function exportCsv(
        array $user,
        array $query,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): string {
        $scope = $this->resolveActorScope($user);
        if (!in_array($scope['role'], ['ADMIN', 'RECEPTIONIST'], true)) {
            throw HttpException::forbidden('Your role is not authorized to export clinic archives.');
        }

        $filters = $this->validateListFilters($scope, $query);
        $rawRows = $this->archiveRepo->listForExport($scope, $filters, 5000);
        $rows = array_map(
            fn (array $row): array => $this->presentSummaryRow($row, $scope['role'], false),
            $rawRows
        );

        $fp = fopen('php://temp', 'r+');
        fputcsv($fp, [
            'Reference Code',
            'Entity Type',
            'Entity ID',
            'Title',
            'Status',
            'Retention Category',
            'Retention Until',
            'Archived By Role',
            'Archived At',
            'Archive Reason',
            'Example Record',
            'Snapshot SHA-256',
        ], ',', '"', '');

        $escapeCsv = static function ($value): string {
            $str = (string) ($value ?? '');
            return preg_match('/^[=+\-@\t\r]/', $str) === 1 ? "'" . $str : $str;
        };

        foreach ($rows as $r) {
            fputcsv($fp, [
                $escapeCsv($r['reference_code']),
                $escapeCsv($r['entity_type']),
                $escapeCsv($r['entity_id']),
                $escapeCsv($r['title']),
                $escapeCsv($r['status']),
                $escapeCsv($r['retention_category']),
                $escapeCsv($r['retention_until'] ?? ''),
                $escapeCsv($r['archived_by_role']),
                $escapeCsv($r['archived_at']),
                $escapeCsv($r['archive_reason']),
                $r['is_example'] ? 'Yes' : 'No',
                $escapeCsv($r['snapshot_sha256']),
            ], ',', '"', '');
        }

        rewind($fp);
        $csv = stream_get_contents($fp);
        fclose($fp);

        $this->auditRepo->record(
            'ARCHIVE_EXPORTED',
            'archives',
            null,
            $scope['user_id'] > 0 ? $scope['user_id'] : null,
            $ipAddress,
            $userAgent,
            [
                'exported_rows' => count($rows),
                'filters' => [
                    'entity_type' => $filters['entity_type'] ?? null,
                    'status' => $filters['status'] ?? null,
                    'retention_category' => $filters['retention_category'] ?? null,
                    'search' => $filters['search'] ?? null,
                    'date_from' => $filters['date_from'] ?? null,
                    'date_to' => $filters['date_to'] ?? null,
                    'include_examples' => $filters['include_examples'] ?? true,
                ],
            ]
        );

        return $csv ?: '';
    }

    /**
     * Verify role and ownership access to a specific archive record.
     *
     * @param array{role: string, user_id: int, patient_id: ?int, dentist_id: ?int, allowed_types: list<string>} $scope
     * @param array<string, mixed> $record
     */
    private function assertCanViewRecord(array $scope, array $record): void
    {
        $entityType = (string) ($record['entity_type'] ?? '');
        if (!in_array($entityType, $scope['allowed_types'], true)) {
            throw HttpException::forbidden('You are not authorized to inspect this archive record.');
        }

        if ((int) ($record['is_example'] ?? 0) === 1) {
            return;
        }

        if ($scope['role'] === 'PATIENT') {
            $ownerPatientId = isset($record['owner_patient_id']) ? (int) $record['owner_patient_id'] : 0;
            if ($scope['patient_id'] === null || $ownerPatientId !== $scope['patient_id']) {
                throw HttpException::forbidden('Patients can only inspect their own archived records.');
            }
        } elseif ($scope['role'] === 'DENTIST') {
            $ownerDentistId = isset($record['owner_dentist_id']) ? (int) $record['owner_dentist_id'] : 0;
            if ($scope['dentist_id'] === null || $ownerDentistId !== $scope['dentist_id']) {
                throw HttpException::forbidden('Dentists can only inspect archived records assigned to them.');
            }
        }
    }

    /**
     * Load live source entity, enforce ownership/business rules, and produce a clean point-in-time snapshot.
     *
     * @param array{role: string, user_id: int, patient_id: ?int, dentist_id: ?int, allowed_types: list<string>, creatable_types: list<string>} $scope
     * @return array{title: string, summary: string, owner_patient_id: ?int, owner_dentist_id: ?int, owner_user_id: ?int, snapshot: array<string, mixed>}
     */
    private function buildEntitySnapshot(array $scope, string $entityType, int $entityId): array
    {
        switch ($entityType) {
            case 'appointment':
                $appt = $this->appointmentRepo->findById($entityId);
                if (!$appt) {
                    throw HttpException::notFound("Appointment #{$entityId} was not found.");
                }
                if ($scope['role'] === 'DENTIST' && (int) $appt['dentist_id'] !== (int) ($scope['dentist_id'] ?? 0)) {
                    throw HttpException::forbidden('You can only archive appointments assigned to you.');
                }
                $status = strtoupper((string) ($appt['status'] ?? ''));
                if (!in_array($status, ['COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW'], true)) {
                    throw HttpException::conflict(
                        "Only resolved appointments (COMPLETED, CANCELLED, REJECTED, NO_SHOW) can be archived. Current status: {$status}.",
                        'APPOINTMENT_NOT_RESOLVED'
                    );
                }
                $patientName = trim(($appt['patient_first_name'] ?? '') . ' ' . ($appt['patient_last_name'] ?? ''));
                $dentistName = 'Dr. ' . trim(($appt['dentist_first_name'] ?? '') . ' ' . ($appt['dentist_last_name'] ?? ''));
                return [
                    'title' => sprintf('Appointment #%d — %s (%s)', $entityId, $appt['service_name'] ?? 'Dental Visit', $patientName ?: 'Patient'),
                    'summary' => sprintf('%s visit with %s on %s.', $status, $dentistName, substr((string) ($appt['start_at'] ?? ''), 0, 16)),
                    'owner_patient_id' => (int) $appt['patient_id'],
                    'owner_dentist_id' => (int) $appt['dentist_id'],
                    'owner_user_id' => isset($appt['patient_user_id']) ? (int) $appt['patient_user_id'] : null,
                    'snapshot' => [
                        'appointment_id' => $entityId,
                        'status' => $status,
                        'start_at' => $appt['start_at'],
                        'end_at' => $appt['end_at'],
                        'service_name' => $appt['service_name'] ?? null,
                        'patient_name' => $patientName,
                        'dentist_name' => $dentistName,
                        'operatory_chair' => $appt['operatory_chair'] ?? null,
                        'duration_snapshot' => (int) ($appt['duration_snapshot'] ?? 0),
                        'price_snapshot' => (float) ($appt['price_snapshot'] ?? 0),
                        'cancellation_reason' => $appt['cancellation_reason'] ?? null,
                    ],
                ];

            case 'treatment_record':
                $rec = $this->treatmentRepo->findById($entityId);
                if (!$rec) {
                    throw HttpException::notFound("Treatment record #{$entityId} was not found.");
                }
                if ($scope['role'] === 'DENTIST' && (int) $rec['dentist_id'] !== (int) ($scope['dentist_id'] ?? 0)) {
                    throw HttpException::forbidden('You can only archive treatment records you authored.');
                }
                $patientName = trim(($rec['patient_first_name'] ?? '') . ' ' . ($rec['patient_last_name'] ?? ''));
                $dentistName = 'Dr. ' . trim(($rec['dentist_first_name'] ?? '') . ' ' . ($rec['dentist_last_name'] ?? ''));
                return [
                    'title' => sprintf('Clinical Record #TR-%d — %s (%s)', $entityId, $rec['service_name'] ?? 'Procedure', $patientName ?: 'Patient'),
                    'summary' => sprintf('Immutable clinical archive authored by %s.', $dentistName),
                    'owner_patient_id' => (int) $rec['patient_id'],
                    'owner_dentist_id' => (int) $rec['dentist_id'],
                    'owner_user_id' => null,
                    'snapshot' => [
                        'treatment_record_id' => $entityId,
                        'appointment_id' => (int) $rec['appointment_id'],
                        'service_name' => $rec['service_name'] ?? null,
                        'patient_name' => $patientName,
                        'dentist_name' => $dentistName,
                        'teeth_treated' => $rec['teeth_treated'] ?? [],
                        'diagnosis' => $rec['diagnosis'] ?? null,
                        'procedure_notes' => $rec['procedure_notes'] ?? null,
                        'prescription_notes' => $rec['prescription_notes'] ?? null,
                        'home_care_advice' => $rec['home_care_advice'] ?? null,
                        'locked_at' => $rec['locked_at'] ?? null,
                    ],
                ];

            case 'patient':
                $patient = $this->patientRepo->findWithUserById($entityId);
                if (!$patient) {
                    throw HttpException::notFound("Patient #{$entityId} was not found.");
                }
                $fullName = trim(($patient['first_name'] ?? '') . ' ' . ($patient['last_name'] ?? ''));
                return [
                    'title' => sprintf('Patient Profile #%d — %s', $entityId, $fullName ?: 'Patient'),
                    'summary' => sprintf('Patient demographic snapshot archived (%s).', $patient['email'] ?? 'no email'),
                    'owner_patient_id' => $entityId,
                    'owner_dentist_id' => null,
                    'owner_user_id' => (int) ($patient['user_id'] ?? 0) ?: null,
                    'snapshot' => [
                        'patient_id' => $entityId,
                        'user_id' => (int) ($patient['user_id'] ?? 0),
                        'full_name' => $fullName,
                        'email' => $patient['email'] ?? null,
                        'phone' => $patient['phone'] ?? null,
                        'gender' => $patient['gender'] ?? null,
                        'date_of_birth' => $patient['date_of_birth'] ?? null,
                        'medical_alerts' => $patient['medical_alerts'] ?? null,
                        'is_active' => (int) ($patient['is_active'] ?? 0),
                    ],
                ];

            case 'dentist':
                $dentist = $this->dentistRepo->findById($entityId);
                if (!$dentist) {
                    throw HttpException::notFound("Dentist #{$entityId} was not found.");
                }
                $fullName = 'Dr. ' . trim(($dentist['first_name'] ?? '') . ' ' . ($dentist['last_name'] ?? ''));
                return [
                    'title' => sprintf('Practitioner #%d — %s', $entityId, $fullName),
                    'summary' => sprintf('%s · License %s', $dentist['specialization'] ?? 'Dental Specialist', $dentist['license_number'] ?? 'N/A'),
                    'owner_patient_id' => null,
                    'owner_dentist_id' => $entityId,
                    'owner_user_id' => (int) ($dentist['user_id'] ?? 0) ?: null,
                    'snapshot' => [
                        'dentist_id' => $entityId,
                        'user_id' => (int) ($dentist['user_id'] ?? 0),
                        'full_name' => $fullName,
                        'specialization' => $dentist['specialization'] ?? null,
                        'license_number' => $dentist['license_number'] ?? null,
                        'default_operatory_chair' => $dentist['default_operatory_chair'] ?? null,
                        'email' => $dentist['email'] ?? null,
                        'is_active' => (int) ($dentist['is_active'] ?? 0),
                    ],
                ];

            case 'service':
                $service = $this->serviceRepo->findById($entityId);
                if (!$service) {
                    throw HttpException::notFound("Service #{$entityId} was not found.");
                }
                return [
                    'title' => sprintf('Service #%d — %s', $entityId, $service['name'] ?? 'Dental Service'),
                    'summary' => sprintf('%s · %d mins · PHP %.2f', $service['category'] ?? 'General', (int) ($service['duration_minutes'] ?? 0), (float) ($service['price'] ?? 0)),
                    'owner_patient_id' => null,
                    'owner_dentist_id' => null,
                    'owner_user_id' => null,
                    'snapshot' => [
                        'service_id' => $entityId,
                        'name' => $service['name'] ?? null,
                        'category' => $service['category'] ?? null,
                        'description' => $service['description'] ?? null,
                        'duration_minutes' => (int) ($service['duration_minutes'] ?? 0),
                        'price' => (float) ($service['price'] ?? 0),
                        'is_active' => (int) ($service['is_active'] ?? 0),
                    ],
                ];

            case 'user':
                $targetUser = $this->userRepo->findById($entityId);
                if (!$targetUser) {
                    throw HttpException::notFound("User #{$entityId} was not found.");
                }
                if ((int) $targetUser['id'] === $scope['user_id']) {
                    throw HttpException::conflict('Administrators cannot archive their own active account.', 'SELF_ARCHIVE_BLOCKED');
                }
                if (strtoupper((string) $targetUser['role']) === 'ADMIN' && (int) $targetUser['is_active'] === 1 && $this->userRepo->countActiveAdmins() <= 1) {
                    throw HttpException::conflict('Cannot archive the last remaining active Administrator account.', 'LAST_ADMIN_PROTECTED');
                }
                return [
                    'title' => sprintf('User Account #%d — %s (%s)', $entityId, $targetUser['email'], strtoupper((string) $targetUser['role'])),
                    'summary' => sprintf('Account snapshot archived for %s role.', strtoupper((string) $targetUser['role'])),
                    'owner_patient_id' => null,
                    'owner_dentist_id' => null,
                    'owner_user_id' => $entityId,
                    'snapshot' => [
                        'user_id' => $entityId,
                        'email' => $targetUser['email'],
                        'first_name' => $targetUser['first_name'] ?? null,
                        'last_name' => $targetUser['last_name'] ?? null,
                        'role' => strtoupper((string) $targetUser['role']),
                        'is_active' => (int) ($targetUser['is_active'] ?? 0),
                        'email_verified' => (int) ($targetUser['email_verified'] ?? 0),
                    ],
                ];

            default:
                throw HttpException::unprocessableEntity('Unsupported archive entity type.');
        }
    }

    private function deactivateSourceIfApplicable(string $entityType, int $entityId): void
    {
        if ($entityType === 'service') {
            $this->serviceRepo->updateStatus($entityId, 0);
        } elseif ($entityType === 'dentist') {
            $this->dentistRepo->updateStatus($entityId, 0);
        } elseif ($entityType === 'user') {
            $this->userRepo->updateStatus($entityId, 0);
        } elseif ($entityType === 'patient') {
            $p = $this->patientRepo->findById($entityId);
            if ($p && !empty($p['user_id'])) {
                $this->userRepo->updateStatus((int) $p['user_id'], 0);
            }
        }
    }

    private function reactivateSourceIfApplicable(string $entityType, int $entityId): void
    {
        if ($entityType === 'service') {
            $this->serviceRepo->updateStatus($entityId, 1);
        } elseif ($entityType === 'dentist') {
            $this->dentistRepo->updateStatus($entityId, 1);
        } elseif ($entityType === 'user') {
            $this->userRepo->updateStatus($entityId, 1);
        } elseif ($entityType === 'patient') {
            $p = $this->patientRepo->findById($entityId);
            if ($p && !empty($p['user_id'])) {
                $this->userRepo->updateStatus((int) $p['user_id'], 1);
            }
        }
    }

    /**
     * Format row consistently and omit internal actor emails for patients.
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function presentSummaryRow(array $row, string $viewerRole, ?bool $canRestorePermission = null): array
    {
        $isPatient = strtoupper($viewerRole) === 'PATIENT';
        $allowRestore = $canRestorePermission ?? (strtoupper($viewerRole) === 'ADMIN');
        return [
            'id' => (int) $row['id'],
            'entity_type' => (string) $row['entity_type'],
            'entity_id' => (int) $row['entity_id'],
            'reference_code' => (string) $row['reference_code'],
            'title' => (string) $row['title'],
            'summary' => $row['summary'] !== null ? (string) $row['summary'] : null,
            'status' => (string) $row['status'],
            'retention_category' => (string) $row['retention_category'],
            'retention_until' => $row['retention_until'] !== null ? (string) $row['retention_until'] : null,
            'archive_reason' => (string) $row['archive_reason'],
            'archived_by_role' => (string) $row['archived_by_role'],
            'archived_by_email' => $isPatient ? null : ($row['archived_by_email'] ?: 'System'),
            'archived_at' => (string) $row['archived_at'],
            'restored_by_email' => $isPatient ? null : ($row['restored_by_email'] ?? null),
            'restored_at' => $row['restored_at'] ?? null,
            'restore_reason' => $row['restore_reason'] ?? null,
            'snapshot_sha256' => (string) ($row['snapshot_sha256'] ?? ''),
            'is_example' => (int) ($row['is_example'] ?? 0) === 1,
            'can_restore' => $allowRestore
                && strtoupper((string) $row['status']) === 'ARCHIVED'
                && (int) ($row['is_example'] ?? 0) === 0,
        ];
    }

    private function assertValidDate(string $value, string $field): void
    {
        $d = DateTimeImmutable::createFromFormat('!Y-m-d', $value, $this->tz);
        if (!$d || $d->format('Y-m-d') !== $value) {
            throw HttpException::unprocessableEntity("Invalid {$field} format. Expected YYYY-MM-DD.", [
                $field => ["{$field} must be a valid YYYY-MM-DD date."],
            ]);
        }
    }
}
