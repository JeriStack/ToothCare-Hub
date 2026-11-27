<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;
use Throwable;

/**
 * Patient-Dentist Messaging Repository
 * Manages Messenger-style 1-to-1 conversations, cursor-paginated messages,
 * idempotent sends, delivered/read receipts, and unread counters.
 */
class MessageRepository
{
    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    public function getConnection(): PDO
    {
        return $this->database->getConnection();
    }

    /**
     * List conversations scoped strictly to a patient or dentist with search & filter support.
     *
     * @return array{items: list<array<string, mixed>>, total: int, total_unread: int, page: int, limit: int}
     */
    public function listConversationsForParticipant(
        string $role,
        int $participantId,
        string $search = '',
        string $filter = 'all',
        int $page = 1,
        int $limit = 30
    ): array {
        $pdo = $this->database->getConnection();
        $isPatient = strtoupper($role) === 'PATIENT';
        $scopeColumn = $isPatient ? 'c.patient_id' : 'c.dentist_id';
        $unreadColumn = $isPatient ? 'c.patient_unread_count' : 'c.dentist_unread_count';

        $where = ["{$scopeColumn} = :participant_id"];
        $params = [':participant_id' => $participantId];

        if (strtolower($filter) === 'unread') {
            $where[] = "{$unreadColumn} > 0";
        }

        $trimmedSearch = trim($search);
        if ($trimmedSearch !== '') {
            // Strip leading honorific ("Dr." / "Dr ") and match every whitespace token across fields (MySQL + SQLite portable)
            $cleanedSearch = preg_replace('/^\s*dr\.?\s+/i', '', $trimmedSearch) ?? $trimmedSearch;
            $tokens = preg_split('/\s+/u', trim($cleanedSearch), -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $tokens = array_slice($tokens, 0, 4);
            if (empty($tokens)) {
                $tokens = [$trimmedSearch];
            }

            foreach ($tokens as $idx => $token) {
                $like = '%' . $token . '%';
                if ($isPatient) {
                    $where[] = "(d.first_name LIKE :sf_{$idx} OR d.last_name LIKE :sl_{$idx} OR d.specialization LIKE :ss_{$idx} OR COALESCE(c.last_message_preview, '') LIKE :sp_{$idx})";
                    $params[":sf_{$idx}"] = $like;
                    $params[":sl_{$idx}"] = $like;
                    $params[":ss_{$idx}"] = $like;
                    $params[":sp_{$idx}"] = $like;
                } else {
                    $where[] = "(p.first_name LIKE :sf_{$idx} OR p.last_name LIKE :sl_{$idx} OR COALESCE(c.last_message_preview, '') LIKE :sp_{$idx})";
                    $params[":sf_{$idx}"] = $like;
                    $params[":sl_{$idx}"] = $like;
                    $params[":sp_{$idx}"] = $like;
                }
            }
        }

        $whereSql = implode(' AND ', $where);
        $offset = max(0, ($page - 1) * $limit);

        $countStmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM conversations c
            INNER JOIN patients p ON p.id = c.patient_id
            INNER JOIN dentists d ON d.id = c.dentist_id
            WHERE {$whereSql}
        ");
        foreach ($params as $key => $val) {
            $countStmt->bindValue($key, $val, is_int($val) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $countStmt->execute();
        $total = (int) $countStmt->fetchColumn();

        $sql = "
            SELECT
                c.*,
                p.user_id AS patient_user_id,
                p.first_name AS patient_first_name,
                p.last_name AS patient_last_name,
                p.avatar_path AS patient_avatar_path,
                p.avatar_updated_at AS patient_avatar_updated_at,
                pu.is_active AS patient_user_active,
                d.user_id AS dentist_user_id,
                d.first_name AS dentist_first_name,
                d.last_name AS dentist_last_name,
                d.specialization AS dentist_specialization,
                d.avatar_path AS dentist_avatar_path,
                d.avatar_updated_at AS dentist_avatar_updated_at,
                d.is_active AS dentist_profile_active,
                du.is_active AS dentist_user_active,
                a.id AS ref_appointment_id,
                a.start_at AS ref_appointment_start_at,
                a.status AS ref_appointment_status,
                s.name AS ref_service_name
            FROM conversations c
            INNER JOIN patients p ON p.id = c.patient_id
            INNER JOIN users pu ON pu.id = p.user_id
            INNER JOIN dentists d ON d.id = c.dentist_id
            INNER JOIN users du ON du.id = d.user_id
            LEFT JOIN appointments a ON a.id = c.appointment_id
            LEFT JOIN services s ON s.id = a.service_id
            WHERE {$whereSql}
            ORDER BY COALESCE(c.last_message_at, c.updated_at, c.created_at) DESC, c.id DESC
            LIMIT :limit OFFSET :offset
        ";

        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val, is_int($val) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $totalUnread = $this->getTotalUnreadCount($role, $participantId);

        return [
            'items' => $items,
            'total' => $total,
            'total_unread' => $totalUnread,
            'page' => $page,
            'limit' => $limit,
        ];
    }

    public function getTotalUnreadCount(string $role, int $participantId): int
    {
        $pdo = $this->database->getConnection();
        $isPatient = strtoupper($role) === 'PATIENT';
        $scopeColumn = $isPatient ? 'patient_id' : 'dentist_id';
        $unreadColumn = $isPatient ? 'patient_unread_count' : 'dentist_unread_count';

        $stmt = $pdo->prepare("SELECT COALESCE(SUM({$unreadColumn}), 0) FROM conversations WHERE {$scopeColumn} = ?");
        $stmt->execute([$participantId]);
        return (int) $stmt->fetchColumn();
    }

    /**
     * Find a single conversation joined with participant and optional appointment details.
     *
     * @return array<string, mixed>|null
     */
    public function findConversationById(int $conversationId): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT
                c.*,
                p.user_id AS patient_user_id,
                p.first_name AS patient_first_name,
                p.last_name AS patient_last_name,
                p.avatar_path AS patient_avatar_path,
                p.avatar_updated_at AS patient_avatar_updated_at,
                pu.is_active AS patient_user_active,
                d.user_id AS dentist_user_id,
                d.first_name AS dentist_first_name,
                d.last_name AS dentist_last_name,
                d.specialization AS dentist_specialization,
                d.avatar_path AS dentist_avatar_path,
                d.avatar_updated_at AS dentist_avatar_updated_at,
                d.is_active AS dentist_profile_active,
                du.is_active AS dentist_user_active,
                a.id AS ref_appointment_id,
                a.start_at AS ref_appointment_start_at,
                a.status AS ref_appointment_status,
                s.name AS ref_service_name
            FROM conversations c
            INNER JOIN patients p ON p.id = c.patient_id
            INNER JOIN users pu ON pu.id = p.user_id
            INNER JOIN dentists d ON d.id = c.dentist_id
            INNER JOIN users du ON du.id = d.user_id
            LEFT JOIN appointments a ON a.id = c.appointment_id
            LEFT JOIN services s ON s.id = a.service_id
            WHERE c.id = ?
            LIMIT 1
        ');
        $stmt->execute([$conversationId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Find conversation by unique (patient_id, dentist_id) pair.
     *
     * @return array<string, mixed>|null
     */
    public function findConversationByPair(int $patientId, int $dentistId): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT id FROM conversations WHERE patient_id = ? AND dentist_id = ? LIMIT 1');
        $stmt->execute([$patientId, $dentistId]);
        $id = $stmt->fetchColumn();
        return $id ? $this->findConversationById((int) $id) : null;
    }

    /**
     * Create or return existing conversation for (patient_id, dentist_id).
     */
    public function findOrCreateConversation(int $patientId, int $dentistId, ?int $appointmentId = null): array
    {
        $pdo = $this->database->getConnection();

        $existing = $this->findConversationByPair($patientId, $dentistId);
        if ($existing !== null) {
            if ($appointmentId !== null && (int) ($existing['appointment_id'] ?? 0) !== $appointmentId) {
                $upd = $pdo->prepare('UPDATE conversations SET appointment_id = ?, updated_at = NOW() WHERE id = ?');
                $upd->execute([$appointmentId, (int) $existing['id']]);
                return $this->findConversationById((int) $existing['id']) ?? $existing;
            }
            return $existing;
        }

        // Resolve most recent relevant appointment between this patient & dentist if none specified
        if ($appointmentId === null) {
            $apptStmt = $pdo->prepare('
                SELECT id
                FROM appointments
                WHERE patient_id = ? AND dentist_id = ?
                ORDER BY
                    CASE status
                        WHEN "CONFIRMED" THEN 1
                        WHEN "PENDING" THEN 2
                        WHEN "COMPLETED" THEN 3
                        WHEN "CANCELLED" THEN 4
                        ELSE 5
                    END ASC,
                    start_at DESC
                LIMIT 1
            ');
            $apptStmt->execute([$patientId, $dentistId]);
            $foundApptId = $apptStmt->fetchColumn();
            $appointmentId = $foundApptId ? (int) $foundApptId : null;
        }

        try {
            $insert = $pdo->prepare('
                INSERT INTO conversations (patient_id, dentist_id, appointment_id, status, created_at, updated_at)
                VALUES (?, ?, ?, "ACTIVE", NOW(), NOW())
            ');
            $insert->execute([$patientId, $dentistId, $appointmentId]);
            $newId = (int) $pdo->lastInsertId();
            return $this->findConversationById($newId) ?? ['id' => $newId];
        } catch (Throwable $e) {
            // Concurrent create race: return winner
            $race = $this->findConversationByPair($patientId, $dentistId);
            if ($race !== null) {
                return $race;
            }
            throw $e;
        }
    }

    /**
     * Cursor-paginated messages ordered oldest-to-newest within the fetched window.
     * Fetches limit + 1 rows strictly with id < beforeId (when provided) to determine has_more cleanly.
     *
     * @return array{items: list<array<string, mixed>>, has_more: bool, next_before_id: ?int}
     */
    public function getMessagesCursorPage(int $conversationId, ?int $beforeId = null, int $limit = 30): array
    {
        $pdo = $this->database->getConnection();
        $fetchLimit = $limit + 1;

        if ($beforeId !== null && $beforeId > 0) {
            $stmt = $pdo->prepare('
                SELECT
                    m.id,
                    m.conversation_id,
                    m.sender_user_id,
                    m.sender_role,
                    m.client_message_id,
                    m.body,
                    m.appointment_id,
                    m.delivered_at,
                    m.read_at,
                    m.created_at
                FROM conversation_messages m
                WHERE m.conversation_id = :conversation_id
                  AND m.id < :before_id
                ORDER BY m.id DESC
                LIMIT :fetch_limit
            ');
            $stmt->bindValue(':before_id', $beforeId, PDO::PARAM_INT);
        } else {
            $stmt = $pdo->prepare('
                SELECT
                    m.id,
                    m.conversation_id,
                    m.sender_user_id,
                    m.sender_role,
                    m.client_message_id,
                    m.body,
                    m.appointment_id,
                    m.delivered_at,
                    m.read_at,
                    m.created_at
                FROM conversation_messages m
                WHERE m.conversation_id = :conversation_id
                ORDER BY m.id DESC
                LIMIT :fetch_limit
            ');
        }

        $stmt->bindValue(':conversation_id', $conversationId, PDO::PARAM_INT);
        $stmt->bindValue(':fetch_limit', $fetchLimit, PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $hasMore = count($rows) > $limit;
        if ($hasMore) {
            array_pop($rows);
        }

        // Reverse so client receives ascending chronological order
        $items = array_reverse($rows);
        $nextBeforeId = $hasMore && !empty($items) ? (int) $items[0]['id'] : null;

        return [
            'items' => $items,
            'has_more' => $hasMore,
            'next_before_id' => $nextBeforeId,
        ];
    }

    /**
     * Find an already-persisted message by idempotency client_message_id.
     *
     * @return array<string, mixed>|null
     */
    public function findMessageByClientId(int $conversationId, int $senderUserId, string $clientMessageId): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT id, conversation_id, sender_user_id, sender_role, client_message_id, body, appointment_id, delivered_at, read_at, created_at
            FROM conversation_messages
            WHERE conversation_id = ? AND sender_user_id = ? AND client_message_id = ?
            LIMIT 1
        ');
        $stmt->execute([$conversationId, $senderUserId, $clientMessageId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findMessageById(int $messageId): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT id, conversation_id, sender_user_id, sender_role, client_message_id, body, appointment_id, delivered_at, read_at, created_at
            FROM conversation_messages
            WHERE id = ?
            LIMIT 1
        ');
        $stmt->execute([$messageId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Insert a message inside an active transaction and update conversation summary & recipient unread count.
     */
    public function insertMessageAndTouchConversation(
        PDO $pdo,
        int $conversationId,
        int $senderUserId,
        string $senderRole,
        string $body,
        ?string $clientMessageId,
        ?int $appointmentId,
        string $preview
    ): int {
        $stmt = $pdo->prepare('
            INSERT INTO conversation_messages
                (conversation_id, sender_user_id, sender_role, client_message_id, body, appointment_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ');
        $stmt->execute([
            $conversationId,
            $senderUserId,
            $senderRole,
            $clientMessageId,
            $body,
            $appointmentId,
        ]);

        $messageId = (int) $pdo->lastInsertId();
        $incrementColumn = strtoupper($senderRole) === 'PATIENT' ? 'dentist_unread_count' : 'patient_unread_count';

        $touchSql = "
            UPDATE conversations
            SET last_message_id = ?,
                last_message_at = NOW(),
                last_message_preview = ?,
                last_message_sender_user_id = ?,
                appointment_id = COALESCE(?, appointment_id),
                {$incrementColumn} = {$incrementColumn} + 1,
                updated_at = NOW()
            WHERE id = ?
        ";
        $touch = $pdo->prepare($touchSql);
        $touch->execute([
            $messageId,
            $preview,
            $senderUserId,
            $appointmentId,
            $conversationId,
        ]);

        return $messageId;
    }

    /**
     * Mark incoming messages in a conversation as delivered.
     *
     * @return int Number of newly delivered messages
     */
    public function markIncomingDelivered(int $conversationId, int $recipientUserId): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            UPDATE conversation_messages
            SET delivered_at = NOW()
            WHERE conversation_id = ?
              AND sender_user_id <> ?
              AND delivered_at IS NULL
        ');
        $stmt->execute([$conversationId, $recipientUserId]);
        return $stmt->rowCount();
    }

    /**
     * Mark all incoming messages in a conversation as read and reset the reader's unread counter.
     *
     * @return int Number of messages marked read
     */
    public function markIncomingRead(PDO $pdo, int $conversationId, int $readerUserId, string $readerRole): int
    {
        $stmt = $pdo->prepare('
            UPDATE conversation_messages
            SET delivered_at = COALESCE(delivered_at, NOW()),
                read_at = NOW()
            WHERE conversation_id = ?
              AND sender_user_id <> ?
              AND read_at IS NULL
        ');
        $stmt->execute([$conversationId, $readerUserId]);
        $updated = $stmt->rowCount();

        $unreadCol = strtoupper($readerRole) === 'PATIENT' ? 'patient_unread_count' : 'dentist_unread_count';
        $reset = $pdo->prepare("UPDATE conversations SET {$unreadCol} = 0, updated_at = updated_at WHERE id = ?");
        $reset->execute([$conversationId]);

        return $updated;
    }

    /**
     * Check whether a user/patient/dentist entity currently has an active ARCHIVED record.
     */
    public function isAccountArchived(int $userId, string $entityType, int $entityId): bool
    {
        $pdo = $this->database->getConnection();
        try {
            $stmt = $pdo->prepare('
                SELECT 1
                FROM archive_records
                WHERE status = "ARCHIVED"
                  AND is_example = 0
                  AND ((entity_type = ? AND entity_id = ?) OR (entity_type = "user" AND entity_id = ?))
                LIMIT 1
            ');
            $stmt->execute([$entityType, $entityId, $userId]);
            return (bool) $stmt->fetchColumn();
        } catch (Throwable $e) {
            return false;
        }
    }

    /**
     * List eligible active dentists a Patient can start a conversation with.
     *
     * @return list<array<string, mixed>>
     */
    public function listEligibleDentistsForPatient(int $patientId): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT
                d.id AS dentist_id,
                d.user_id,
                d.first_name,
                d.last_name,
                d.specialization,
                d.avatar_path,
                d.avatar_updated_at,
                c.id AS existing_conversation_id,
                (
                    SELECT COUNT(*)
                    FROM appointments a
                    WHERE a.patient_id = :patient_id AND a.dentist_id = d.id
                ) AS shared_appointments
            FROM dentists d
            INNER JOIN users u ON u.id = d.user_id
            LEFT JOIN conversations c ON c.patient_id = :patient_id_join AND c.dentist_id = d.id
            WHERE d.is_active = 1 AND u.is_active = 1
              AND NOT EXISTS (
                  SELECT 1 FROM archive_records ar
                  WHERE ar.status = "ARCHIVED" AND ar.is_example = 0
                    AND ((ar.entity_type = "dentist" AND ar.entity_id = d.id) OR (ar.entity_type = "user" AND ar.entity_id = d.user_id))
              )
            ORDER BY shared_appointments DESC, d.last_name ASC, d.first_name ASC
            LIMIT 50
        ');
        $stmt->execute([
            ':patient_id' => $patientId,
            ':patient_id_join' => $patientId,
        ]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * List eligible active patients a Dentist has appointments or an existing conversation with.
     *
     * @return list<array<string, mixed>>
     */
    public function listEligiblePatientsForDentist(int $dentistId): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT DISTINCT
                p.id AS patient_id,
                p.user_id,
                p.first_name,
                p.last_name,
                p.avatar_path,
                p.avatar_updated_at,
                c.id AS existing_conversation_id
            FROM patients p
            INNER JOIN users u ON u.id = p.user_id
            LEFT JOIN conversations c ON c.patient_id = p.id AND c.dentist_id = :dentist_id_join
            WHERE u.is_active = 1
              AND NOT EXISTS (
                  SELECT 1 FROM archive_records ar
                  WHERE ar.status = "ARCHIVED" AND ar.is_example = 0
                    AND ((ar.entity_type = "patient" AND ar.entity_id = p.id) OR (ar.entity_type = "user" AND ar.entity_id = p.user_id))
              )
              AND (
                  c.id IS NOT NULL
                  OR EXISTS (
                      SELECT 1
                      FROM appointments a
                      WHERE a.patient_id = p.id AND a.dentist_id = :dentist_id_appt
                  )
              )
            ORDER BY p.last_name ASC, p.first_name ASC
            LIMIT 50
        ');
        $stmt->execute([
            ':dentist_id_join' => $dentistId,
            ':dentist_id_appt' => $dentistId,
        ]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Verify that an appointment belongs to the (patient_id, dentist_id) pair.
     */
    public function appointmentBelongsToPair(int $appointmentId, int $patientId, int $dentistId): bool
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            SELECT 1 FROM appointments
            WHERE id = ? AND patient_id = ? AND dentist_id = ?
            LIMIT 1
        ');
        $stmt->execute([$appointmentId, $patientId, $dentistId]);
        return (bool) $stmt->fetchColumn();
    }
}
