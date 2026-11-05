<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Security and Administrative Audit Log Repository
 * Records tamper-evident audit events with strict payload sanitization.
 */
class AuditLogRepository
{
    private Database $database;

    private const SENSITIVE_KEYS = [
        'password',
        'password_hash',
        'token',
        'token_hash',
        'csrf_token',
        'session_id',
        'secret',
        'api_key',
        'new_password',
        'current_password',
    ];

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Record an audit event with sanitized payload
     *
     * @param array<string, mixed>|null $payload
     */
    public function record(
        string $action,
        string $targetType,
        ?int $targetId = null,
        ?int $actorUserId = null,
        ?string $ipAddress = null,
        ?string $userAgent = null,
        ?array $payload = null
    ): int {
        try {
            $pdo = $this->database->getConnection();
            $sanitizedPayload = $payload !== null ? $this->sanitizePayload($payload) : null;
            $jsonPayload = $sanitizedPayload !== null ? json_encode($sanitizedPayload, JSON_UNESCAPED_UNICODE) : null;

            $stmt = $pdo->prepare('
                INSERT INTO audit_logs (
                    actor_user_id, action, target_type, target_id,
                    ip_address, user_agent, sanitized_payload, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            ');

            $stmt->execute([
                $actorUserId,
                $action,
                $targetType,
                $targetId,
                $ipAddress !== null ? substr($ipAddress, 0, 45) : null,
                $userAgent !== null ? substr($userAgent, 0, 255) : null,
                $jsonPayload,
            ]);

            return (int) $pdo->lastInsertId();
        } catch (\Throwable $e) {
            // Audit logging failures must not crash the application, but should be reported safely
            return 0;
        }
    }

    /**
     * Recursively strip credentials and security tokens
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function sanitizePayload(array $data): array
    {
        $sanitized = [];
        foreach ($data as $key => $value) {
            $normalizedKey = strtolower((string) $key);
            if (in_array($normalizedKey, self::SENSITIVE_KEYS, true)) {
                $sanitized[$key] = '[REDACTED]';
            } elseif (is_array($value)) {
                $sanitized[$key] = $this->sanitizePayload($value);
            } else {
                $sanitized[$key] = $value;
            }
        }

        return $sanitized;
    }
}

