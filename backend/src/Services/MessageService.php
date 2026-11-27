<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\HttpException;
use App\Repositories\DentistRepository;
use App\Repositories\MessageRepository;
use App\Repositories\PatientRepository;
use App\Services\Realtime\RealtimeOutboxService;
use DateTimeImmutable;
use DateTimeZone;
use Throwable;

/**
 * Patient-Dentist Messaging Service
 * Enforces strict participant authorization, archive/inactive blocks, cursor pagination,
 * idempotent sends, delivery/read receipts, typing indicators, and privacy-safe realtime sync.
 */
class MessageService
{
    public const MAX_MESSAGE_LENGTH = 2000;
    public const DEFAULT_PAGE_LIMIT = 30;
    public const MAX_PAGE_LIMIT = 50;

    private Database $database;
    private MessageRepository $messageRepo;
    private PatientRepository $patientRepo;
    private DentistRepository $dentistRepo;
    private ?RealtimeOutboxService $realtimeOutbox;
    private DateTimeZone $tz;

    public function __construct(
        ?Database $database = null,
        ?MessageRepository $messageRepo = null,
        ?PatientRepository $patientRepo = null,
        ?DentistRepository $dentistRepo = null,
        ?RealtimeOutboxService $realtimeOutbox = null
    ) {
        $db = $database ?? Database::getInstance();
        $this->database = $db;
        $this->messageRepo = $messageRepo ?? new MessageRepository($db);
        $this->patientRepo = $patientRepo ?? new PatientRepository($db);
        $this->dentistRepo = $dentistRepo ?? new DentistRepository($db);
        if ($realtimeOutbox !== null) {
            $this->realtimeOutbox = $realtimeOutbox;
        } else {
            try {
                $this->realtimeOutbox = new RealtimeOutboxService(null, null, null, null, $db);
            } catch (Throwable $e) {
                $this->realtimeOutbox = null;
            }
        }
        $this->tz = new DateTimeZone('Asia/Manila');
    }

    /**
     * Resolve authenticated Patient or Dentist context and reject unauthorized or archived accounts.
     *
     * @param array<string, mixed> $user
     * @return array{role: string, user_id: int, participant_id: int, display_name: string}
     */
    public function resolveActor(array $user): array
    {
        $userId = (int) ($user['id'] ?? 0);
        $role = strtoupper((string) ($user['role'] ?? ''));

        if ($userId <= 0 || (int) ($user['is_active'] ?? 0) !== 1) {
            throw HttpException::unauthorized('Active authenticated account is required.', 'ACCOUNT_INACTIVE');
        }

        if ($role === 'PATIENT') {
            $patient = $this->patientRepo->findByUserId($userId);
            if ($patient === null) {
                throw HttpException::forbidden('Patient profile is required to access messages.', 'PATIENT_PROFILE_MISSING');
            }
            $patientId = (int) $patient['id'];
            if ($this->messageRepo->isAccountArchived($userId, 'patient', $patientId)) {
                throw HttpException::forbidden('Archived accounts cannot access conversations.', 'ACCOUNT_ARCHIVED');
            }
            return [
                'role' => 'PATIENT',
                'user_id' => $userId,
                'participant_id' => $patientId,
                'display_name' => trim(((string) ($patient['first_name'] ?? '')) . ' ' . ((string) ($patient['last_name'] ?? ''))),
            ];
        }

        if ($role === 'DENTIST') {
            $dentist = $this->dentistRepo->findByUserId($userId);
            if ($dentist === null || (int) ($dentist['is_active'] ?? 0) !== 1) {
                throw HttpException::forbidden('Active dentist profile is required to access messages.', 'DENTIST_PROFILE_INACTIVE');
            }
            $dentistId = (int) $dentist['id'];
            if ($this->messageRepo->isAccountArchived($userId, 'dentist', $dentistId)) {
                throw HttpException::forbidden('Archived accounts cannot access conversations.', 'ACCOUNT_ARCHIVED');
            }
            return [
                'role' => 'DENTIST',
                'user_id' => $userId,
                'participant_id' => $dentistId,
                'display_name' => 'Dr. ' . trim(((string) ($dentist['first_name'] ?? '')) . ' ' . ((string) ($dentist['last_name'] ?? ''))),
            ];
        }

        throw HttpException::forbidden(
            'Private Patient-Dentist conversations are accessible only to authorized participants.',
            'MESSAGES_ACCESS_FORBIDDEN'
        );
    }

    /**
     * List conversations for the authenticated Patient or Dentist, enriched with online presence & contacts.
     *
     * @param array<string, mixed> $user
     * @param array<string, mixed> $query
     * @return array<string, mixed>
     */
    public function listConversations(array $user, array $query = []): array
    {
        $actor = $this->resolveActor($user);
        $search = trim((string) ($query['search'] ?? ''));
        $filter = strtolower(trim((string) ($query['filter'] ?? 'all')));
        if (!in_array($filter, ['all', 'unread'], true)) {
            $filter = 'all';
        }
        $page = max(1, (int) ($query['page'] ?? 1));
        $limit = min(self::MAX_PAGE_LIMIT, max(1, (int) ($query['limit'] ?? self::DEFAULT_PAGE_LIMIT)));

        $result = $this->messageRepo->listConversationsForParticipant(
            $actor['role'],
            $actor['participant_id'],
            $search,
            $filter,
            $page,
            $limit
        );

        $counterpartUserIds = [];
        foreach ($result['items'] as $row) {
            $counterpartUserIds[] = $actor['role'] === 'PATIENT'
                ? (int) $row['dentist_user_id']
                : (int) $row['patient_user_id'];
        }

        $contactsRaw = $actor['role'] === 'PATIENT'
            ? $this->messageRepo->listEligibleDentistsForPatient($actor['participant_id'])
            : $this->messageRepo->listEligiblePatientsForDentist($actor['participant_id']);

        foreach ($contactsRaw as $contact) {
            $counterpartUserIds[] = (int) $contact['user_id'];
        }

        $onlineSet = array_flip($this->realtimeOutbox?->queryOnlineUserIds($counterpartUserIds) ?? []);

        $conversations = array_map(
            fn (array $row): array => $this->formatConversation($row, $actor, $onlineSet),
            $result['items']
        );

        $contacts = array_map(
            fn (array $row): array => $this->formatContact($row, $actor['role'], $onlineSet),
            $contactsRaw
        );

        return [
            'conversations' => $conversations,
            'contacts' => $contacts,
            'total_unread_count' => $result['total_unread'],
            'pagination' => [
                'page' => $result['page'],
                'limit' => $result['limit'],
                'total' => $result['total'],
                'total_pages' => (int) max(1, ceil($result['total'] / $result['limit'])),
            ],
        ];
    }

    /**
     * @param array<string, mixed> $user
     */
    public function getUnreadCount(array $user): int
    {
        $actor = $this->resolveActor($user);
        return $this->messageRepo->getTotalUnreadCount($actor['role'], $actor['participant_id']);
    }

    /**
     * Find or create a conversation between the authenticated participant and an active counterpart.
     *
     * @param array<string, mixed> $user
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function startOrFindConversation(array $user, array $payload): array
    {
        $actor = $this->resolveActor($user);
        $appointmentId = isset($payload['appointment_id']) && (int) $payload['appointment_id'] > 0
            ? (int) $payload['appointment_id']
            : null;

        if ($actor['role'] === 'PATIENT') {
            $dentistId = (int) ($payload['dentist_id'] ?? 0);
            if ($dentistId <= 0) {
                throw HttpException::unprocessableEntity('A valid dentist_id is required to start a conversation.');
            }
            $dentist = $this->dentistRepo->findById($dentistId);
            if (
                $dentist === null ||
                (int) ($dentist['is_active'] ?? 0) !== 1 ||
                (int) ($dentist['user_active'] ?? 0) !== 1 ||
                $this->messageRepo->isAccountArchived((int) $dentist['user_id'], 'dentist', $dentistId)
            ) {
                throw HttpException::conflict('This dentist is currently unavailable for messaging.', 'CONVERSATION_UNAVAILABLE');
            }
            $patientId = $actor['participant_id'];
        } else {
            $patientId = (int) ($payload['patient_id'] ?? 0);
            if ($patientId <= 0) {
                throw HttpException::unprocessableEntity('A valid patient_id is required to start a conversation.');
            }
            $patient = $this->patientRepo->findWithUserById($patientId);
            if (
                $patient === null ||
                (int) ($patient['is_active'] ?? 0) !== 1 ||
                $this->messageRepo->isAccountArchived((int) $patient['user_id'], 'patient', $patientId)
            ) {
                throw HttpException::conflict('This patient account is currently unavailable for messaging.', 'CONVERSATION_UNAVAILABLE');
            }
            $dentistId = $actor['participant_id'];
        }

        if ($appointmentId !== null && !$this->messageRepo->appointmentBelongsToPair($appointmentId, $patientId, $dentistId)) {
            throw HttpException::forbidden('Appointment reference does not match conversation participants.');
        }

        $row = $this->messageRepo->findOrCreateConversation($patientId, $dentistId, $appointmentId);
        $counterpartUserId = $actor['role'] === 'PATIENT'
            ? (int) $row['dentist_user_id']
            : (int) $row['patient_user_id'];
        $onlineSet = array_flip($this->realtimeOutbox?->queryOnlineUserIds([$counterpartUserId]) ?? []);

        return $this->formatConversation($row, $actor, $onlineSet);
    }

    /**
     * Cursor-paginated messages for an authorized conversation participant.
     *
     * @param array<string, mixed> $user
     * @param array<string, mixed> $query
     * @return array<string, mixed>
     */
    public function getConversationMessages(array $user, int $conversationId, array $query = []): array
    {
        $actor = $this->resolveActor($user);
        $conv = $this->requireAuthorizedConversation($conversationId, $actor);

        $beforeId = isset($query['before_id']) && (int) $query['before_id'] > 0 ? (int) $query['before_id'] : null;
        $limit = min(self::MAX_PAGE_LIMIT, max(1, (int) ($query['limit'] ?? self::DEFAULT_PAGE_LIMIT)));

        // Mark incoming undelivered messages as delivered upon fetch
        $newlyDelivered = $this->messageRepo->markIncomingDelivered($conversationId, $actor['user_id']);
        if ($newlyDelivered > 0) {
            $counterpartUserId = $this->counterpartUserId($conv, $actor['role']);
            $this->realtimeOutbox?->publishEphemeralBestEffort(
                RealtimeOutboxService::EVENT_MESSAGE_DELIVERED,
                $counterpartUserId,
                ['conversationId' => $conversationId, 'status' => 'delivered']
            );
        }

        $page = $this->messageRepo->getMessagesCursorPage($conversationId, $beforeId, $limit);
        $counterpartUserId = $this->counterpartUserId($conv, $actor['role']);
        $onlineSet = array_flip($this->realtimeOutbox?->queryOnlineUserIds([$counterpartUserId]) ?? []);

        return [
            'conversation' => $this->formatConversation($conv, $actor, $onlineSet),
            'messages' => array_map(
                fn (array $row): array => $this->formatMessage($row, $actor['user_id']),
                $page['items']
            ),
            'pagination' => [
                'limit' => $limit,
                'has_more' => $page['has_more'],
                'next_before_id' => $page['next_before_id'],
            ],
        ];
    }

    /**
     * Send a message transactionally with idempotency (client_message_id) and privacy-safe realtime delivery.
     *
     * @param array<string, mixed> $user
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function sendMessage(array $user, int $conversationId, array $payload): array
    {
        $actor = $this->resolveActor($user);
        $conv = $this->requireAuthorizedConversation($conversationId, $actor);

        if (!$this->isConversationAvailable($conv)) {
            throw HttpException::conflict(
                'This conversation is unavailable because the other participant account is inactive or archived.',
                'CONVERSATION_UNAVAILABLE'
            );
        }

        $rawBody = isset($payload['body']) ? (string) $payload['body'] : '';
        // Normalize line endings and trim outer whitespace while preserving internal paragraph breaks
        $normalizedBody = trim(str_replace(["\r\n", "\r"], "\n", $rawBody));
        if ($normalizedBody === '') {
            throw HttpException::unprocessableEntity('Message cannot be empty.', [
                'body' => 'Please enter a message before sending.',
            ]);
        }

        if (mb_strlen($normalizedBody, 'UTF-8') > self::MAX_MESSAGE_LENGTH) {
            throw HttpException::unprocessableEntity(
                'Message exceeds maximum length of ' . self::MAX_MESSAGE_LENGTH . ' characters.',
                ['body' => 'Message must be ' . self::MAX_MESSAGE_LENGTH . ' characters or fewer.']
            );
        }

        $clientMessageId = isset($payload['client_message_id']) && is_string($payload['client_message_id'])
            ? trim($payload['client_message_id'])
            : null;
        if ($clientMessageId === '') {
            $clientMessageId = null;
        }
        if ($clientMessageId !== null && strlen($clientMessageId) > 64) {
            $clientMessageId = substr($clientMessageId, 0, 64);
        }

        // Idempotent duplicate check (reliable optimistic retries)
        if ($clientMessageId !== null) {
            $existingMsg = $this->messageRepo->findMessageByClientId($conversationId, $actor['user_id'], $clientMessageId);
            if ($existingMsg !== null) {
                $freshConv = $this->messageRepo->findConversationById($conversationId) ?? $conv;
                $onlineSet = array_flip($this->realtimeOutbox?->queryOnlineUserIds([$this->counterpartUserId($freshConv, $actor['role'])]) ?? []);
                return [
                    'message' => $this->formatMessage($existingMsg, $actor['user_id']),
                    'conversation' => $this->formatConversation($freshConv, $actor, $onlineSet),
                    'duplicate' => true,
                ];
            }
        }

        $appointmentId = isset($payload['appointment_id']) && (int) $payload['appointment_id'] > 0
            ? (int) $payload['appointment_id']
            : null;
        if (
            $appointmentId !== null &&
            !$this->messageRepo->appointmentBelongsToPair($appointmentId, (int) $conv['patient_id'], (int) $conv['dentist_id'])
        ) {
            throw HttpException::forbidden('Appointment reference does not belong to this conversation.');
        }

        $preview = $this->buildPreview($normalizedBody);
        $recipientUserId = $this->counterpartUserId($conv, $actor['role']);
        $pdo = $this->database->getConnection();

        $pdo->beginTransaction();
        try {
            $messageId = $this->messageRepo->insertMessageAndTouchConversation(
                $pdo,
                $conversationId,
                $actor['user_id'],
                $actor['role'],
                $normalizedBody,
                $clientMessageId,
                $appointmentId,
                $preview
            );

            // Enqueue strictly non-PII, content-free real-time sync signal inside the transaction
            $this->realtimeOutbox?->enqueue(
                RealtimeOutboxService::EVENT_MESSAGE_CREATED,
                $recipientUserId,
                null,
                [
                    'conversationId' => $conversationId,
                    'entityType' => 'messages',
                    'entityId' => $messageId,
                    'status' => 'sent',
                ],
                $pdo
            );

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            // Handle concurrent duplicate client_message_id gracefully
            if ($clientMessageId !== null) {
                $existingMsg = $this->messageRepo->findMessageByClientId($conversationId, $actor['user_id'], $clientMessageId);
                if ($existingMsg !== null) {
                    $freshConv = $this->messageRepo->findConversationById($conversationId) ?? $conv;
                    return [
                        'message' => $this->formatMessage($existingMsg, $actor['user_id']),
                        'conversation' => $this->formatConversation($freshConv, $actor, []),
                        'duplicate' => true,
                    ];
                }
            }
            throw $e;
        }

        // Immediate best-effort push post-commit
        $this->realtimeOutbox?->dispatchPendingBestEffort(5);

        $savedMsg = $this->messageRepo->findMessageById($messageId);
        $freshConv = $this->messageRepo->findConversationById($conversationId) ?? $conv;
        $onlineSet = array_flip($this->realtimeOutbox?->queryOnlineUserIds([$recipientUserId]) ?? []);

        return [
            'message' => $savedMsg ? $this->formatMessage($savedMsg, $actor['user_id']) : null,
            'conversation' => $this->formatConversation($freshConv, $actor, $onlineSet),
            'duplicate' => false,
        ];
    }

    /**
     * Mark incoming messages in a conversation as delivered.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function markDelivered(array $user, int $conversationId): array
    {
        $actor = $this->resolveActor($user);
        $conv = $this->requireAuthorizedConversation($conversationId, $actor);

        $count = $this->messageRepo->markIncomingDelivered($conversationId, $actor['user_id']);
        if ($count > 0) {
            $this->realtimeOutbox?->publishEphemeralBestEffort(
                RealtimeOutboxService::EVENT_MESSAGE_DELIVERED,
                $this->counterpartUserId($conv, $actor['role']),
                ['conversationId' => $conversationId, 'status' => 'delivered']
            );
        }

        return [
            'conversation_id' => $conversationId,
            'delivered_count' => $count,
        ];
    }

    /**
     * Mark all incoming messages in a conversation as read and notify the sender for live read receipts.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function markRead(array $user, int $conversationId): array
    {
        $actor = $this->resolveActor($user);
        $conv = $this->requireAuthorizedConversation($conversationId, $actor);

        $pdo = $this->database->getConnection();
        $pdo->beginTransaction();
        try {
            $updated = $this->messageRepo->markIncomingRead($pdo, $conversationId, $actor['user_id'], $actor['role']);
            if ($updated > 0) {
                $this->realtimeOutbox?->enqueue(
                    RealtimeOutboxService::EVENT_MESSAGE_READ,
                    $this->counterpartUserId($conv, $actor['role']),
                    null,
                    [
                        'conversationId' => $conversationId,
                        'entityType' => 'messages',
                        'entityId' => $conversationId,
                        'status' => 'read',
                    ],
                    $pdo
                );
            }
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        if ($updated > 0) {
            $this->realtimeOutbox?->dispatchPendingBestEffort(5);
        }

        $totalUnread = $this->messageRepo->getTotalUnreadCount($actor['role'], $actor['participant_id']);

        return [
            'conversation_id' => $conversationId,
            'read_count' => $updated,
            'total_unread_count' => $totalUnread,
        ];
    }

    /**
     * Publish an ephemeral typing signal to the other authorized participant.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function sendTypingSignal(array $user, int $conversationId, bool $isTyping): array
    {
        $actor = $this->resolveActor($user);
        $conv = $this->requireAuthorizedConversation($conversationId, $actor);

        if (!$this->isConversationAvailable($conv)) {
            return ['conversation_id' => $conversationId, 'sent' => false];
        }

        $this->realtimeOutbox?->publishEphemeralBestEffort(
            RealtimeOutboxService::EVENT_MESSAGE_TYPING,
            $this->counterpartUserId($conv, $actor['role']),
            [
                'conversationId' => $conversationId,
                'status' => $isTyping ? 'typing' : 'stopped',
            ]
        );

        return [
            'conversation_id' => $conversationId,
            'sent' => true,
            'is_typing' => $isTyping,
        ];
    }

    /**
     * Query online status strictly for the authenticated user's authorized conversation counterparts.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function getPresence(array $user): array
    {
        $actor = $this->resolveActor($user);
        $list = $this->messageRepo->listConversationsForParticipant($actor['role'], $actor['participant_id'], '', 'all', 1, 50);

        $counterpartIds = [];
        foreach ($list['items'] as $row) {
            $counterpartIds[] = $actor['role'] === 'PATIENT'
                ? (int) $row['dentist_user_id']
                : (int) $row['patient_user_id'];
        }

        $onlineIds = $this->realtimeOutbox?->queryOnlineUserIds($counterpartIds) ?? [];

        return [
            'online_user_ids' => $onlineIds,
        ];
    }

    /**
     * @param array{role: string, user_id: int, participant_id: int, display_name: string} $actor
     * @return array<string, mixed>
     */
    private function requireAuthorizedConversation(int $conversationId, array $actor): array
    {
        if ($conversationId <= 0) {
            throw HttpException::badRequest('Invalid conversation ID.');
        }

        $conv = $this->messageRepo->findConversationById($conversationId);
        if ($conv === null) {
            throw HttpException::notFound('Conversation not found.');
        }

        $isOwner = $actor['role'] === 'PATIENT'
            ? (int) $conv['patient_id'] === $actor['participant_id']
            : (int) $conv['dentist_id'] === $actor['participant_id'];

        if (!$isOwner) {
            throw HttpException::forbidden('You are not authorized to access this conversation.', 'CONVERSATION_FORBIDDEN');
        }

        return $conv;
    }

    /**
     * @param array<string, mixed> $conv
     */
    private function counterpartUserId(array $conv, string $actorRole): int
    {
        return $actorRole === 'PATIENT'
            ? (int) $conv['dentist_user_id']
            : (int) $conv['patient_user_id'];
    }

    /**
     * @param array<string, mixed> $conv
     */
    private function isConversationAvailable(array $conv): bool
    {
        if (strtoupper((string) ($conv['status'] ?? 'ACTIVE')) !== 'ACTIVE') {
            return false;
        }
        if ((int) ($conv['patient_user_active'] ?? 0) !== 1) {
            return false;
        }
        if ((int) ($conv['dentist_user_active'] ?? 0) !== 1 || (int) ($conv['dentist_profile_active'] ?? 0) !== 1) {
            return false;
        }
        if ($this->messageRepo->isAccountArchived((int) $conv['patient_user_id'], 'patient', (int) $conv['patient_id'])) {
            return false;
        }
        if ($this->messageRepo->isAccountArchived((int) $conv['dentist_user_id'], 'dentist', (int) $conv['dentist_id'])) {
            return false;
        }
        return true;
    }

    /**
     * @param array<string, mixed> $row
     * @param array{role: string, user_id: int, participant_id: int, display_name: string} $actor
     * @param array<int, int> $onlineSet
     * @return array<string, mixed>
     */
    private function formatConversation(array $row, array $actor, array $onlineSet): array
    {
        $isPatient = $actor['role'] === 'PATIENT';
        $available = $this->isConversationAvailable($row);

        if ($isPatient) {
            $firstName = trim((string) ($row['dentist_first_name'] ?? ''));
            $lastName = trim((string) ($row['dentist_last_name'] ?? ''));
            $counterpartUserId = (int) $row['dentist_user_id'];
            $counterpartId = (int) $row['dentist_id'];
            $avatarUrl = !empty($row['dentist_avatar_path'])
                ? '/api/v1/dentists/' . $counterpartId . '/avatar' . (!empty($row['dentist_avatar_updated_at']) ? '?v=' . urlencode((string) $row['dentist_avatar_updated_at']) : '')
                : null;
            $participant = [
                'user_id' => $counterpartUserId,
                'role' => 'DENTIST',
                'dentist_id' => $counterpartId,
                'name' => 'Dr. ' . trim("{$firstName} {$lastName}"),
                'subtitle' => trim((string) ($row['dentist_specialization'] ?? 'Dental Practitioner')) ?: 'Dental Practitioner',
                'initials' => $this->initials($firstName, $lastName),
                'avatar_url' => $avatarUrl,
                'is_online' => $available && isset($onlineSet[$counterpartUserId]),
                'is_active' => $available,
            ];
            $unreadCount = (int) ($row['patient_unread_count'] ?? 0);
        } else {
            $firstName = trim((string) ($row['patient_first_name'] ?? ''));
            $lastName = trim((string) ($row['patient_last_name'] ?? ''));
            $counterpartUserId = (int) $row['patient_user_id'];
            $counterpartId = (int) $row['patient_id'];
            $avatarUrl = !empty($row['patient_avatar_path'])
                ? '/api/v1/patients/' . $counterpartId . '/avatar' . (!empty($row['patient_avatar_updated_at']) ? '?v=' . urlencode((string) $row['patient_avatar_updated_at']) : '')
                : null;
            $participant = [
                'user_id' => $counterpartUserId,
                'role' => 'PATIENT',
                'patient_id' => $counterpartId,
                'name' => trim("{$firstName} {$lastName}") ?: 'Patient',
                'subtitle' => 'Patient',
                'initials' => $this->initials($firstName, $lastName),
                'avatar_url' => $avatarUrl,
                'is_online' => $available && isset($onlineSet[$counterpartUserId]),
                'is_active' => $available,
            ];
            $unreadCount = (int) ($row['dentist_unread_count'] ?? 0);
        }

        $appointmentRef = null;
        if (!empty($row['ref_appointment_id'])) {
            $appointmentRef = [
                'id' => (int) $row['ref_appointment_id'],
                'service_name' => (string) ($row['ref_service_name'] ?? 'Dental Visit'),
                'start_at' => $this->formatIso($row['ref_appointment_start_at'] ?? null),
                'status' => strtoupper((string) ($row['ref_appointment_status'] ?? '')),
            ];
        }

        return [
            'id' => (int) $row['id'],
            'patient_id' => (int) $row['patient_id'],
            'dentist_id' => (int) $row['dentist_id'],
            'status' => $available ? 'ACTIVE' : 'UNAVAILABLE',
            'is_available' => $available,
            'unavailable_reason' => $available
                ? null
                : 'This conversation is read-only because the participant account is currently inactive or archived.',
            'participant' => $participant,
            'appointment' => $appointmentRef,
            'last_message_id' => isset($row['last_message_id']) ? (int) $row['last_message_id'] : null,
            'last_message_preview' => $row['last_message_preview'] ?? null,
            'last_message_at' => $this->formatIso($row['last_message_at'] ?? null),
            'last_message_from_me' => isset($row['last_message_sender_user_id']) && (int) $row['last_message_sender_user_id'] === $actor['user_id'],
            'unread_count' => $unreadCount,
            'updated_at' => $this->formatIso($row['updated_at'] ?? $row['created_at'] ?? null),
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @param array<int, int> $onlineSet
     * @return array<string, mixed>
     */
    private function formatContact(array $row, string $actorRole, array $onlineSet): array
    {
        $firstName = trim((string) ($row['first_name'] ?? ''));
        $lastName = trim((string) ($row['last_name'] ?? ''));
        $userId = (int) $row['user_id'];

        if ($actorRole === 'PATIENT') {
            $dentistId = (int) $row['dentist_id'];
            $avatarUrl = !empty($row['avatar_path'])
                ? '/api/v1/dentists/' . $dentistId . '/avatar' . (!empty($row['avatar_updated_at']) ? '?v=' . urlencode((string) $row['avatar_updated_at']) : '')
                : null;
            return [
                'id' => $dentistId,
                'dentist_id' => $dentistId,
                'user_id' => $userId,
                'role' => 'DENTIST',
                'name' => 'Dr. ' . trim("{$firstName} {$lastName}"),
                'subtitle' => trim((string) ($row['specialization'] ?? 'Dental Practitioner')) ?: 'Dental Practitioner',
                'initials' => $this->initials($firstName, $lastName),
                'avatar_url' => $avatarUrl,
                'is_online' => isset($onlineSet[$userId]),
                'existing_conversation_id' => !empty($row['existing_conversation_id']) ? (int) $row['existing_conversation_id'] : null,
            ];
        }

        $patientId = (int) $row['patient_id'];
        $avatarUrl = !empty($row['avatar_path'])
            ? '/api/v1/patients/' . $patientId . '/avatar' . (!empty($row['avatar_updated_at']) ? '?v=' . urlencode((string) $row['avatar_updated_at']) : '')
            : null;
        return [
            'id' => $patientId,
            'patient_id' => $patientId,
            'user_id' => $userId,
            'role' => 'PATIENT',
            'name' => trim("{$firstName} {$lastName}") ?: 'Patient',
            'subtitle' => 'Patient',
            'initials' => $this->initials($firstName, $lastName),
            'avatar_url' => $avatarUrl,
            'is_online' => isset($onlineSet[$userId]),
            'existing_conversation_id' => !empty($row['existing_conversation_id']) ? (int) $row['existing_conversation_id'] : null,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatMessage(array $row, int $viewerUserId): array
    {
        $senderUserId = (int) $row['sender_user_id'];
        $readAt = $this->formatIso($row['read_at'] ?? null);
        $deliveredAt = $this->formatIso($row['delivered_at'] ?? null);

        $deliveryStatus = 'sent';
        if ($readAt !== null) {
            $deliveryStatus = 'read';
        } elseif ($deliveredAt !== null) {
            $deliveryStatus = 'delivered';
        }

        return [
            'id' => (int) $row['id'],
            'conversation_id' => (int) $row['conversation_id'],
            'sender_user_id' => $senderUserId,
            'sender_role' => strtoupper((string) $row['sender_role']),
            'is_mine' => $senderUserId === $viewerUserId,
            'client_message_id' => $row['client_message_id'] ?? null,
            'body' => (string) $row['body'],
            'appointment_id' => isset($row['appointment_id']) ? (int) $row['appointment_id'] : null,
            'delivery_status' => $deliveryStatus,
            'delivered_at' => $deliveredAt,
            'read_at' => $readAt,
            'created_at' => $this->formatIso($row['created_at'] ?? null),
        ];
    }

    private function buildPreview(string $body): string
    {
        $singleLine = preg_replace('/\s+/u', ' ', trim($body)) ?? trim($body);
        if (mb_strlen($singleLine, 'UTF-8') <= 140) {
            return $singleLine;
        }
        return rtrim(mb_substr($singleLine, 0, 137, 'UTF-8')) . '...';
    }

    private function initials(string $first, string $last): string
    {
        $f = mb_substr(trim($first), 0, 1, 'UTF-8');
        $l = mb_substr(trim($last), 0, 1, 'UTF-8');
        $combined = mb_strtoupper($f . $l, 'UTF-8');
        return $combined !== '' ? $combined : 'U';
    }

    private function formatIso(?string $mysqlDateTime): ?string
    {
        if ($mysqlDateTime === null || trim($mysqlDateTime) === '') {
            return null;
        }
        try {
            $dt = new DateTimeImmutable($mysqlDateTime, $this->tz);
            return $dt->format(DateTimeImmutable::ATOM);
        } catch (Throwable $e) {
            return $mysqlDateTime;
        }
    }
}
