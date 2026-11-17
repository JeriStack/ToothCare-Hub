<?php
declare(strict_types=1);
namespace App\Services\Email;
use App\Core\Config;
/**
 * Validated SMTP configuration, sourced only from environment variables.
 * Never serialized, logged, or returned through an API: use describe() for safe output.
 */
final class MailConfig
{
    public const ENCRYPTION_NONE = 'none';
    public const ENCRYPTION_TLS = 'tls';
    public const ENCRYPTION_SSL = 'ssl';
    /**
     * @param list<string> $errors
     */
    private function __construct(
        public readonly bool $enabled,
        public readonly string $host,
        public readonly int $port,
        public readonly string $username,
        private readonly string $password,
        public readonly string $encryption,
        public readonly string $fromAddress,
        public readonly string $fromName,
        public readonly string $replyToAddress,
        public readonly int $timeout,
        public readonly bool $verifyPeer,
        public readonly array $errors
    ) {
    }
    public static function fromEnvironment(): self
    {
        Config::getInstance(); // ensures .env has been loaded
        $read = static function (string $key, string $default = ''): string {
            $v = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
            return ($v === false || $v === null || $v === '') ? $default : (string) $v;
        };
        return self::fromArray([
            'MAIL_ENABLED' => $read('MAIL_ENABLED', 'true'),
            'MAIL_HOST' => $read('MAIL_HOST'),
            'MAIL_PORT' => $read('MAIL_PORT', '587'),
            'MAIL_USERNAME' => $read('MAIL_USERNAME'),
            'MAIL_PASSWORD' => $read('MAIL_PASSWORD'),
            'MAIL_ENCRYPTION' => $read('MAIL_ENCRYPTION', 'tls'),
            'MAIL_FROM_ADDRESS' => $read('MAIL_FROM_ADDRESS'),
            'MAIL_FROM_NAME' => $read('MAIL_FROM_NAME', 'ToothCare Hub'),
            'MAIL_REPLY_TO_ADDRESS' => $read('MAIL_REPLY_TO_ADDRESS'),
            'MAIL_TIMEOUT' => $read('MAIL_TIMEOUT', '15'),
            'MAIL_VERIFY_PEER' => $read('MAIL_VERIFY_PEER', 'true'),
        ]);
    }
    /**
     * @param array<string, string> $env
     */
    public static function fromArray(array $env): self
    {
        $errors = [];
        $enabled = self::bool($env['MAIL_ENABLED'] ?? 'true');
        $host = trim($env['MAIL_HOST'] ?? '');
        $port = (int) ($env['MAIL_PORT'] ?? 587);
        $encryption = strtolower(trim($env['MAIL_ENCRYPTION'] ?? 'tls'));
        if ($encryption === '' || $encryption === 'false' || $encryption === 'off') {
            $encryption = self::ENCRYPTION_NONE;
        }
        $from = trim($env['MAIL_FROM_ADDRESS'] ?? '');
        $replyTo = trim($env['MAIL_REPLY_TO_ADDRESS'] ?? '');
        $timeout = (int) ($env['MAIL_TIMEOUT'] ?? 15);
        $verifyPeer = self::bool($env['MAIL_VERIFY_PEER'] ?? 'true');
        if ($enabled) {
            if ($host === '') {
                $errors[] = 'MAIL_HOST is required when MAIL_ENABLED=true.';
            }
            if ($port < 1 || $port > 65535) {
                $errors[] = 'MAIL_PORT must be between 1 and 65535.';
            }
            if (!in_array($encryption, [self::ENCRYPTION_NONE, self::ENCRYPTION_TLS, self::ENCRYPTION_SSL], true)) {
                $errors[] = 'MAIL_ENCRYPTION must be one of: none, tls, ssl.';
            }
            if ($from === '' || filter_var($from, FILTER_VALIDATE_EMAIL) === false) {
                $errors[] = 'MAIL_FROM_ADDRESS must be a valid email address.';
            }
            if ($replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL) === false) {
                $errors[] = 'MAIL_REPLY_TO_ADDRESS must be a valid email address when set.';
            }
            if ($timeout < 1 || $timeout > 120) {
                $errors[] = 'MAIL_TIMEOUT must be between 1 and 120 seconds.';
            }
            if (!$verifyPeer && strtolower($env['APP_ENV'] ?? (string) ($_ENV['APP_ENV'] ?? '')) === 'production') {
                $errors[] = 'MAIL_VERIFY_PEER=false is not permitted in production.';
            }
        }
        return new self(
            $enabled,
            $host,
            $port,
            trim($env['MAIL_USERNAME'] ?? ''),
            (string) ($env['MAIL_PASSWORD'] ?? ''),
            $encryption,
            $from,
            trim($env['MAIL_FROM_NAME'] ?? 'ToothCare Hub') ?: 'ToothCare Hub',
            $replyTo,
            $timeout,
            $verifyPeer,
            $errors
        );
    }
    public function isValid(): bool
    {
        return $this->errors === [];
    }
    /** Mail is operational when enabled and fully valid. */
    public function isOperational(): bool
    {
        return $this->enabled && $this->isValid();
    }
    public function password(): string
    {
        return $this->password;
    }
    public function hasCredentials(): bool
    {
        return $this->username !== '';
    }
    /**
     * Safe description for logs and diagnostics. Never includes the password or username.
     *
     * @return array<string, mixed>
     */
    public function describe(): array
    {
        return [
            'enabled' => $this->enabled,
            'host' => $this->host,
            'port' => $this->port,
            'encryption' => $this->encryption,
            'from_address' => $this->fromAddress,
            'timeout' => $this->timeout,
            'verify_peer' => $this->verifyPeer,
            'authenticated' => $this->hasCredentials(),
            'valid' => $this->isValid(),
        ];
    }
    public function __debugInfo(): array
    {
        return $this->describe();
    }
    private static function bool(string $value): bool
    {
        return in_array(strtolower(trim($value)), ['1', 'true', 'yes', 'on'], true);
    }
}