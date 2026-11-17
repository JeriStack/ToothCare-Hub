<?php
declare(strict_types=1);
namespace App\Services\Email;
use RuntimeException;
/**
 * AES-256-GCM sealing for the few outbox values that must survive until send time
 * (verification and reset tokens). The key comes from EMAIL_PAYLOAD_KEY and is never stored.
 * Sealed values are removed from the row after successful delivery.
 */
final class PayloadCipher
{
    private const PREFIX = 'v1:';
    private const DEV_KEY = 'toothcare-hub-development-only-payload-key';
    private string $key;
    public function __construct(?string $secret, bool $production = false)
    {
        $secret = $secret === null ? '' : trim($secret);
        if ($secret === '') {
            if ($production) {
                throw new RuntimeException('EMAIL_PAYLOAD_KEY must be set in production.');
            }
            $secret = self::DEV_KEY;
        }
        $this->key = hash('sha256', $secret, true);
    }
    public static function fromEnvironment(): self
    {
        $v = $_ENV['EMAIL_PAYLOAD_KEY'] ?? $_SERVER['EMAIL_PAYLOAD_KEY'] ?? getenv('EMAIL_PAYLOAD_KEY');
        $env = (string) ($_ENV['APP_ENV'] ?? $_SERVER['APP_ENV'] ?? getenv('APP_ENV') ?: 'development');
        return new self($v === false ? null : (string) $v, strtolower($env) === 'production');
    }
    public function seal(string $plaintext): string
    {
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plaintext, 'aes-256-gcm', $this->key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($cipher === false) {
            throw new RuntimeException('Unable to seal email payload.');
        }
        return self::PREFIX . base64_encode($iv . $tag . $cipher);
    }
    public function open(string $sealed): string
    {
        if (!str_starts_with($sealed, self::PREFIX)) {
            throw new OutboxJobException('PAYLOAD_INVALID', 'Sealed payload has an unknown format.');
        }
        $raw = base64_decode(substr($sealed, strlen(self::PREFIX)), true);
        if ($raw === false || strlen($raw) < 29) {
            throw new OutboxJobException('PAYLOAD_INVALID', 'Sealed payload is malformed.');
        }
        $iv = substr($raw, 0, 12);
        $tag = substr($raw, 12, 16);
        $cipher = substr($raw, 28);
        $plain = openssl_decrypt($cipher, 'aes-256-gcm', $this->key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($plain === false) {
            throw new OutboxJobException('PAYLOAD_UNREADABLE', 'Sealed payload could not be decrypted with the current key.');
        }
        return $plain;
    }
}