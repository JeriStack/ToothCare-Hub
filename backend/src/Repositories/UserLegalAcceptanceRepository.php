<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * User Legal Acceptance Repository
 * Append-only persistence for auditable Terms of Service acceptance and Privacy Policy acknowledgment records.
 */
class UserLegalAcceptanceRepository
{
    public const ACTION_ACCEPTED = 'ACCEPTED';
    public const ACTION_ACKNOWLEDGED = 'ACKNOWLEDGED';

    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Record an immutable legal acceptance or acknowledgment with a server-generated timestamp.
     * Idempotent: if the exact (user_id, document_id, acceptance_action) already exists,
     * returns the preserved historical record without modifying its original accepted_at timestamp.
     *
     * @return array{record: array<string, mixed>, created: bool}
     */
    public function recordAcceptance(
        int $userId,
        int $documentId,
        string $documentType,
        string $documentVersion,
        string $acceptanceAction,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): array {
        $existing = $this->findOne($userId, $documentId, $acceptanceAction);
        if ($existing !== null) {
            return ['record' => $existing, 'created' => false];
        }

        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO user_legal_acceptances (
                user_id, document_id, document_type, document_version,
                acceptance_action, accepted_at, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)
        ');

        try {
            $stmt->execute([
                $userId,
                $documentId,
                $documentType,
                $documentVersion,
                $acceptanceAction,
                $ipAddress !== null ? substr(trim($ipAddress), 0, 45) : null,
                $userAgent !== null ? substr(trim($userAgent), 0, 255) : null,
            ]);

            $id = (int) $pdo->lastInsertId();
            $createdRow = $this->findById($id);
            return ['record' => $createdRow ?? [], 'created' => true];
        } catch (\PDOException $e) {
            // Handle concurrent duplicate submissions cleanly by returning the preserved record
            $retryExisting = $this->findOne($userId, $documentId, $acceptanceAction);
            if ($retryExisting !== null) {
                return ['record' => $retryExisting, 'created' => false];
            }
            throw $e;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT * FROM user_legal_acceptances WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? $this->hydrateRow($row) : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findOne(int $userId, int $documentId, string $acceptanceAction): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT *
            FROM user_legal_acceptances
            WHERE user_id = ? AND document_id = ? AND acceptance_action = ?
            LIMIT 1
        ');
        $stmt->execute([$userId, $documentId, $acceptanceAction]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? $this->hydrateRow($row) : null;
    }

    /**
     * Retrieve full immutable acceptance history for a specific user.
     *
     * @return list<array<string, mixed>>
     */
    public function findByUserId(int $userId): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT ula.*, ld.title AS document_title, ld.effective_date AS document_effective_date, ld.status AS document_status
            FROM user_legal_acceptances ula
            LEFT JOIN legal_documents ld ON ld.id = ula.document_id
            WHERE ula.user_id = ?
            ORDER BY ula.accepted_at DESC, ula.id DESC
        ');
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(fn(array $row) => $this->hydrateRow($row), $rows);
    }

    /**
     * Check whether a user has recorded the required acceptance/acknowledgment for a specific document ID.
     */
    public function hasUserAcceptedDocument(int $userId, int $documentId, string $acceptanceAction): bool
    {
        return $this->findOne($userId, $documentId, $acceptanceAction) !== null;
    }

    /**
     * Paginated administrative view of legal acceptance records.
     *
     * @param array<string, mixed> $filters
     * @return array{data: list<array<string, mixed>>, meta: array<string, mixed>}
     */
    public function listAcceptances(array $filters = [], int $page = 1, int $perPage = 25): array
    {
        $pdo = $this->database->getConnection();
        $where = [];
        $params = [];

        if (!empty($filters['user_id'])) {
            $where[] = 'ula.user_id = ?';
            $params[] = (int) $filters['user_id'];
        }
        if (!empty($filters['document_type'])) {
            $where[] = 'ula.document_type = ?';
            $params[] = trim((string) $filters['document_type']);
        }
        if (!empty($filters['document_version'])) {
            $where[] = 'ula.document_version = ?';
            $params[] = trim((string) $filters['document_version']);
        }
        if (!empty($filters['acceptance_action'])) {
            $where[] = 'ula.acceptance_action = ?';
            $params[] = trim((string) $filters['acceptance_action']);
        }

        $whereSql = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM user_legal_acceptances ula {$whereSql}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $offset = ($page - 1) * $perPage;

        $stmt = $pdo->prepare("
            SELECT ula.*, u.email AS user_email, u.role AS user_role, ld.title AS document_title
            FROM user_legal_acceptances ula
            LEFT JOIN users u ON u.id = ula.user_id
            LEFT JOIN legal_documents ld ON ld.id = ula.document_id
            {$whereSql}
            ORDER BY ula.accepted_at DESC, ula.id DESC
            LIMIT {$perPage} OFFSET {$offset}
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $data = array_map(function (array $row): array {
            $hydrated = $this->hydrateRow($row);
            $hydrated['user_email'] = $row['user_email'] ?? null;
            $hydrated['user_role'] = $row['user_role'] ?? null;
            return $hydrated;
        }, $rows);

        return [
            'data' => $data,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'last_page' => (int) ceil($total / $perPage) ?: 1,
            ],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function hydrateRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'user_id' => (int) $row['user_id'],
            'document_id' => (int) $row['document_id'],
            'document_type' => (string) $row['document_type'],
            'document_version' => (string) $row['document_version'],
            'acceptance_action' => (string) $row['acceptance_action'],
            'accepted_at' => (string) $row['accepted_at'],
            'ip_address' => $row['ip_address'] !== null ? (string) $row['ip_address'] : null,
            'user_agent' => $row['user_agent'] !== null ? (string) $row['user_agent'] : null,
            'document_title' => $row['document_title'] ?? null,
            'document_effective_date' => $row['document_effective_date'] ?? null,
            'document_status' => $row['document_status'] ?? null,
        ];
    }
}
