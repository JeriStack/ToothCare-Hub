<?php

declare(strict_types=1);

namespace App\Services\Realtime;

use App\Core\Database;
use App\Core\HttpException;
use App\Repositories\DentistRepository;
use App\Repositories\RealtimeTicketRepository;
use App\Repositories\RoleRepository;
use App\Repositories\UserRepository;

/**
 * Manages short-lived, single-use, session-bound Socket.IO connection tickets
 * and authoritative identity/session verification for the Node.js realtime service.
 */
class RealtimeTicketService
{
    private RealtimeTicketRepository $ticketRepo;
    private UserRepository $userRepo;
    private DentistRepository $dentistRepo;
    private RoleRepository $roleRepo;
    private RealtimeConfig $config;

    public function __construct(
        ?RealtimeTicketRepository $ticketRepo = null,
        ?UserRepository $userRepo = null,
        ?DentistRepository $dentistRepo = null,
        ?RoleRepository $roleRepo = null,
        ?RealtimeConfig $config = null,
        ?Database $database = null
    ) {
        $db = $database ?? Database::getInstance();
        $this->ticketRepo = $ticketRepo ?? new RealtimeTicketRepository($db);
        $this->userRepo = $userRepo ?? new UserRepository($db);
        $this->dentistRepo = $dentistRepo ?? new DentistRepository($db);
        $this->roleRepo = $roleRepo ?? new RoleRepository($db);
        $this->config = $config ?? RealtimeConfig::fromEnvironment();
    }

    /**
     * Issue a short-lived, single-use opaque connection ticket for an authenticated user.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function issueTicket(array $user, ?string $sessionId = null, ?int $now = null): array
    {
        $userId = (int) ($user['id'] ?? 0);
        if ($userId <= 0) {
            throw HttpException::unauthorized('Authentication is required.', 'AUTHENTICATION_REQUIRED');
        }

        // Always re-verify active status from MySQL before issuing a ticket
        $freshUser = $this->userRepo->findById($userId);
        if ($freshUser === null || (int) ($freshUser['is_active'] ?? 0) !== 1) {
            throw HttpException::unauthorized('Account is inactive or disabled.', 'ACCOUNT_DISABLED');
        }

        $role = strtoupper((string) $freshUser['role']);
        $dentistId = null;
        if ($role === 'DENTIST') {
            $dentist = $this->dentistRepo->findByUserId($userId);
            if ($dentist !== null) {
                $dentistId = (int) $dentist['id'];
            }
        }

        $permissions = $this->resolveEffectivePermissions($userId, $role);
        $rawTicket = bin2hex(random_bytes(32));
        $ticketHash = hash('sha256', $rawTicket);
        $sessionIdHash = ($sessionId !== null && $sessionId !== '') ? hash('sha256', $sessionId) : null;

        $currentTs = $now ?? time();
        $ttl = $this->config->ticketTtlSeconds;
        $expiresAt = date('Y-m-d H:i:s', $currentTs + $ttl);
        $createdAt = date('Y-m-d H:i:s', $currentTs);

        $this->ticketRepo->create([
            'ticket_hash' => $ticketHash,
            'user_id' => $userId,
            'role' => $role,
            'dentist_id' => $dentistId,
            'session_id_hash' => $sessionIdHash,
            'permissions_json' => json_encode($permissions, JSON_UNESCAPED_SLASHES) ?: '[]',
            'expires_at' => $expiresAt,
            'created_at' => $createdAt,
        ]);

        return [
            'ticket' => $rawTicket,
            'expires_at' => date('c', $currentTs + $ttl),
            'expires_in' => $ttl,
            'socket_path' => $this->config->socketPath,
        ];
    }

    /**
     * Validate and atomically consume a single-use connection ticket.
     * Invoked exclusively by the Node.js Socket.IO service over the signed internal channel.
     *
     * @return array<string, mixed>
     */
    public function verifyAndConsumeTicket(string $rawTicket, ?int $now = null): array
    {
        $trimmed = trim($rawTicket);
        if ($trimmed === '' || strlen($trimmed) !== 64 || !ctype_xdigit($trimmed)) {
            throw HttpException::unauthorized('Malformed connection ticket.', 'TICKET_MALFORMED');
        }

        $ticketHash = hash('sha256', $trimmed);
        $record = $this->ticketRepo->findByHash($ticketHash);
        if ($record === null) {
            throw HttpException::unauthorized('Invalid connection ticket.', 'TICKET_INVALID');
        }

        $currentTs = $now ?? time();
        $nowStr = date('Y-m-d H:i:s', $currentTs);

        if (!empty($record['revoked_at'])) {
            throw HttpException::unauthorized('Connection ticket has been revoked.', 'TICKET_REVOKED');
        }

        if (!empty($record['used_at'])) {
            throw HttpException::unauthorized('Connection ticket has already been used.', 'TICKET_ALREADY_USED');
        }

        if (strtotime((string) $record['expires_at']) <= $currentTs) {
            throw HttpException::unauthorized('Connection ticket has expired.', 'TICKET_EXPIRED');
        }

        // Re-check live user status & current role/permissions from MySQL
        $userId = (int) $record['user_id'];
        $user = $this->userRepo->findById($userId);
        if ($user === null || (int) ($user['is_active'] ?? 0) !== 1) {
            $this->ticketRepo->revokeAllForUser($userId, $nowStr);
            throw HttpException::unauthorized('Account is inactive or disabled.', 'ACCOUNT_DISABLED');
        }

        // Atomic single-use consumption (prevents race condition between two concurrent handshakes)
        $consumed = $this->ticketRepo->markConsumedAtomically($ticketHash, $nowStr);
        if (!$consumed) {
            throw HttpException::unauthorized('Connection ticket is no longer valid.', 'TICKET_ALREADY_USED');
        }

        $role = strtoupper((string) $user['role']);
        $dentistId = null;
        if ($role === 'DENTIST') {
            $dentist = $this->dentistRepo->findByUserId($userId);
            if ($dentist !== null) {
                $dentistId = (int) $dentist['id'];
            }
        }

        $permissions = $this->resolveEffectivePermissions($userId, $role);

        return [
            'user_id' => $userId,
            'role' => $role,
            'dentist_id' => $dentistId,
            'permissions' => $permissions,
            'session_id_hash' => $record['session_id_hash'] ?? null,
        ];
    }

    /**
     * Revalidate an active socket's user status, role, and DRBAC permissions.
     *
     * @return array<string, mixed>
     */
    public function verifyActiveIdentity(int $userId): array
    {
        $user = $this->userRepo->findById($userId);
        if ($user === null || (int) ($user['is_active'] ?? 0) !== 1) {
            return [
                'active' => false,
                'reason' => 'ACCOUNT_DISABLED',
            ];
        }

        $role = strtoupper((string) $user['role']);
        $dentistId = null;
        if ($role === 'DENTIST') {
            $dentist = $this->dentistRepo->findByUserId($userId);
            if ($dentist !== null) {
                $dentistId = (int) $dentist['id'];
            }
        }

        return [
            'active' => true,
            'user_id' => $userId,
            'role' => $role,
            'dentist_id' => $dentistId,
            'permissions' => $this->resolveEffectivePermissions($userId, $role),
        ];
    }

    /**
     * Revoke active connection tickets for a specific session (called on logout).
     */
    public function revokeSessionTickets(int $userId, ?string $sessionId = null): int
    {
        if ($sessionId !== null && $sessionId !== '') {
            return $this->ticketRepo->revokeBySession($userId, hash('sha256', $sessionId));
        }
        return $this->ticketRepo->revokeAllForUser($userId);
    }

    /**
     * Revoke all active connection tickets for a user (called on deactivation or role change).
     */
    public function revokeAllUserTickets(int $userId): int
    {
        return $this->ticketRepo->revokeAllForUser($userId);
    }

    /**
     * @return list<string>
     */
    private function resolveEffectivePermissions(int $userId, string $role): array
    {
        try {
            $perms = $this->roleRepo->getUserPermissions($userId);
            if ($perms !== []) {
                return array_values(array_unique(array_map('strval', $perms)));
            }
        } catch (\Throwable) {
            // Fall through to role-slug lookup
        }

        try {
            $roleRow = $this->roleRepo->findBySlug(strtolower($role));
            if ($roleRow !== null) {
                $perms = $this->roleRepo->getRolePermissions((int) $roleRow['id']);
                return array_values(array_unique(array_map('strval', $perms)));
            }
        } catch (\Throwable) {
            // Safe empty fallback
        }

        return [];
    }
}
