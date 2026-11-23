<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Legal Document Repository
 * Manages versioned Terms of Service and Privacy Policy records with immutable published history.
 */
class LegalDocumentRepository
{
    public const TYPE_TERMS = 'TERMS_OF_SERVICE';
    public const TYPE_PRIVACY = 'PRIVACY_POLICY';

    public const STATUS_DRAFT = 'DRAFT';
    public const STATUS_PUBLISHED = 'PUBLISHED';
    public const STATUS_SUPERSEDED = 'SUPERSEDED';
    public const STATUS_WITHDRAWN = 'WITHDRAWN';

    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Find the currently active PUBLISHED document for a given type.
     *
     * @return array<string, mixed>|null
     */
    public function findPublishedActiveByType(string $documentType): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT *
            FROM legal_documents
            WHERE document_type = ? AND status = ?
            ORDER BY published_at DESC, id DESC
            LIMIT 1
        ');
        $stmt->execute([$documentType, self::STATUS_PUBLISHED]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? $this->hydrateRow($row) : null;
    }

    /**
     * Retrieve all currently PUBLISHED active documents indexed by document_type.
     *
     * @return array<string, array<string, mixed>>
     */
    public function findAllPublishedActive(): array
    {
        $result = [];
        foreach ([self::TYPE_TERMS, self::TYPE_PRIVACY] as $type) {
            $doc = $this->findPublishedActiveByType($type);
            if ($doc !== null) {
                $result[$type] = $doc;
            }
        }

        return $result;
    }

    /**
     * Find a specific document by ID.
     *
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT * FROM legal_documents WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? $this->hydrateRow($row) : null;
    }

    /**
     * Find a document by type and version identifier.
     *
     * @return array<string, mixed>|null
     */
    public function findByTypeAndVersion(string $documentType, string $version): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT *
            FROM legal_documents
            WHERE document_type = ? AND version = ?
            LIMIT 1
        ');
        $stmt->execute([$documentType, $version]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? $this->hydrateRow($row) : null;
    }

    /**
     * List all documents (drafts, published, superseded, withdrawn) with optional filters.
     *
     * @return list<array<string, mixed>>
     */
    public function listDocuments(?string $documentType = null, ?string $status = null): array
    {
        $pdo = $this->database->getConnection();
        $where = [];
        $params = [];

        if ($documentType !== null && $documentType !== '') {
            $where[] = 'document_type = ?';
            $params[] = $documentType;
        }
        if ($status !== null && $status !== '') {
            $where[] = 'status = ?';
            $params[] = $status;
        }

        $whereSql = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';
        $stmt = $pdo->prepare("
            SELECT *
            FROM legal_documents
            {$whereSql}
            ORDER BY document_type ASC, created_at DESC, id DESC
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(fn(array $row) => $this->hydrateRow($row), $rows);
    }

    /**
     * Create a new DRAFT document version. Never starts as PUBLISHED.
     *
     * @param array<string, mixed> $content
     * @return array<string, mixed>
     */
    public function createDraft(
        string $documentType,
        string $version,
        string $title,
        string $effectiveDate,
        array $content,
        ?string $changeSummary,
        bool $requiresReacceptance,
        int $createdByUserId,
        bool $isApproved = false
    ): array {
        $pdo = $this->database->getConnection();
        $contentJson = (string) json_encode($content, JSON_UNESCAPED_UNICODE);
        $contentSha256 = hash('sha256', $contentJson);

        $stmt = $pdo->prepare('
            INSERT INTO legal_documents (
                document_type, version, title, status, is_approved, requires_reacceptance,
                effective_date, published_at, change_summary, content_json, content_sha256,
                created_by_user_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NOW(), NOW())
        ');
        $stmt->execute([
            $documentType,
            $version,
            $title,
            self::STATUS_DRAFT,
            $isApproved ? 1 : 0,
            $requiresReacceptance ? 1 : 0,
            $effectiveDate,
            $changeSummary,
            $contentJson,
            $contentSha256,
            $createdByUserId,
        ]);

        $id = (int) $pdo->lastInsertId();
        return $this->findById($id) ?? [];
    }

    /**
     * Update an unpublished DRAFT document. Published/historical rows are strictly immutable.
     *
     * @param array<string, mixed> $fields
     * @return array<string, mixed>|null
     */
    public function updateDraft(int $id, array $fields): ?array
    {
        $existing = $this->findById($id);
        if ($existing === null || $existing['status'] !== self::STATUS_DRAFT) {
            return null;
        }

        $sets = [];
        $params = [];

        if (array_key_exists('title', $fields)) {
            $sets[] = 'title = ?';
            $params[] = (string) $fields['title'];
        }
        if (array_key_exists('effective_date', $fields)) {
            $sets[] = 'effective_date = ?';
            $params[] = (string) $fields['effective_date'];
        }
        if (array_key_exists('change_summary', $fields)) {
            $sets[] = 'change_summary = ?';
            $params[] = $fields['change_summary'] !== null ? (string) $fields['change_summary'] : null;
        }
        if (array_key_exists('requires_reacceptance', $fields)) {
            $sets[] = 'requires_reacceptance = ?';
            $params[] = $fields['requires_reacceptance'] ? 1 : 0;
        }
        if (array_key_exists('is_approved', $fields)) {
            $sets[] = 'is_approved = ?';
            $params[] = $fields['is_approved'] ? 1 : 0;
        }
        if (array_key_exists('content', $fields) && is_array($fields['content'])) {
            $contentJson = (string) json_encode($fields['content'], JSON_UNESCAPED_UNICODE);
            $sets[] = 'content_json = ?';
            $params[] = $contentJson;
            $sets[] = 'content_sha256 = ?';
            $params[] = hash('sha256', $contentJson);
        }

        if (empty($sets)) {
            return $existing;
        }

        $sets[] = 'updated_at = NOW()';
        $params[] = $id;
        $params[] = self::STATUS_DRAFT;

        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE legal_documents
            SET ' . implode(', ', $sets) . '
            WHERE id = ? AND status = ?
        ');
        $stmt->execute($params);

        return $this->findById($id);
    }

    /**
     * Supersede any currently PUBLISHED document of the same type and publish the target DRAFT.
     * Caller should wrap this in a database transaction.
     *
     * @return array<string, mixed>|null
     */
    public function publishDraft(
        int $id,
        int $publisherUserId,
        ?string $effectiveDate = null,
        ?bool $requiresReacceptance = null,
        ?bool $isApproved = null
    ): ?array {
        $existing = $this->findById($id);
        if ($existing === null || $existing['status'] !== self::STATUS_DRAFT) {
            return null;
        }

        $pdo = $this->database->getConnection();

        // Mark prior active PUBLISHED version(s) of the same type as SUPERSEDED without altering their content
        $supersedeStmt = $pdo->prepare('
            UPDATE legal_documents
            SET status = ?, updated_at = NOW()
            WHERE document_type = ? AND status = ? AND id <> ?
        ');
        $supersedeStmt->execute([
            self::STATUS_SUPERSEDED,
            $existing['document_type'],
            self::STATUS_PUBLISHED,
            $id,
        ]);

        $finalEffectiveDate = $effectiveDate ?? (string) $existing['effective_date'];
        $finalRequiresReacceptance = $requiresReacceptance !== null
            ? ($requiresReacceptance ? 1 : 0)
            : ($existing['requires_reacceptance'] ? 1 : 0);
        $finalIsApproved = $isApproved !== null
            ? ($isApproved ? 1 : 0)
            : ($existing['is_approved'] ? 1 : 0);

        $publishStmt = $pdo->prepare('
            UPDATE legal_documents
            SET status = ?,
                effective_date = ?,
                requires_reacceptance = ?,
                is_approved = ?,
                published_at = NOW(),
                published_by_user_id = ?,
                updated_at = NOW()
            WHERE id = ? AND status = ?
        ');
        $publishStmt->execute([
            self::STATUS_PUBLISHED,
            $finalEffectiveDate,
            $finalRequiresReacceptance,
            $finalIsApproved,
            $publisherUserId,
            $id,
            self::STATUS_DRAFT,
        ]);

        return $this->findById($id);
    }

    /**
     * Mark a non-active or active document as WITHDRAWN (preserving historical record).
     *
     * @return array<string, mixed>|null
     */
    public function withdrawDocument(int $id): ?array
    {
        $existing = $this->findById($id);
        if ($existing === null) {
            return null;
        }

        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE legal_documents
            SET status = ?, updated_at = NOW()
            WHERE id = ?
        ');
        $stmt->execute([self::STATUS_WITHDRAWN, $id]);

        return $this->findById($id);
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function hydrateRow(array $row): array
    {
        $decodedContent = json_decode((string) ($row['content_json'] ?? '{}'), true);
        if (!is_array($decodedContent)) {
            $decodedContent = [];
        }

        return [
            'id' => (int) $row['id'],
            'document_type' => (string) $row['document_type'],
            'version' => (string) $row['version'],
            'title' => (string) $row['title'],
            'status' => (string) $row['status'],
            'is_approved' => (bool) ($row['is_approved'] ?? false),
            'requires_reacceptance' => (bool) ($row['requires_reacceptance'] ?? false),
            'effective_date' => (string) $row['effective_date'],
            'published_at' => $row['published_at'] !== null ? (string) $row['published_at'] : null,
            'change_summary' => $row['change_summary'] !== null ? (string) $row['change_summary'] : null,
            'content' => $decodedContent,
            'content_sha256' => (string) ($row['content_sha256'] ?? ''),
            'created_by_user_id' => $row['created_by_user_id'] !== null ? (int) $row['created_by_user_id'] : null,
            'published_by_user_id' => $row['published_by_user_id'] !== null ? (int) $row['published_by_user_id'] : null,
            'created_at' => (string) ($row['created_at'] ?? ''),
            'updated_at' => (string) ($row['updated_at'] ?? ''),
        ];
    }
}
