<?php

declare(strict_types=1);

namespace App\Services\Realtime;

use App\Core\Request;

/**
 * HMAC-SHA256 request signer and verifier for internal PHP <-> Node.js service calls.
 * Protects against unauthenticated publishing, tampering, and replay attacks.
 *
 * Canonical string: "{timestamp}.{nonce}.{METHOD}.{path}.{rawBody}"
 */
class InternalRequestSigner
{
    public const HEADER_TIMESTAMP = 'x-realtime-timestamp';
    public const HEADER_NONCE = 'x-realtime-nonce';
    public const HEADER_SIGNATURE = 'x-realtime-signature';

    private string $secret;
    private int $replayWindowSeconds;

    /** @var array<string, int> Process-local seen nonces keyed by nonce => expiresAt */
    private static array $seenNonces = [];

    public function __construct(?string $secret = null, int $replayWindowSeconds = 300)
    {
        $cfg = RealtimeConfig::fromEnvironment();
        $this->secret = $secret ?? $cfg->internalSecret;
        $this->replayWindowSeconds = max(30, $replayWindowSeconds);
    }

    /**
     * Produce signed HTTP headers for an outbound internal request.
     *
     * @return array<string, string>
     */
    public function signHeaders(string $method, string $path, string $rawBody, ?int $timestamp = null, ?string $nonce = null): array
    {
        $ts = (string) ($timestamp ?? time());
        $n = $nonce ?? bin2hex(random_bytes(16));
        $sig = $this->computeSignature($ts, $n, $method, $path, $rawBody);

        return [
            'X-Realtime-Timestamp' => $ts,
            'X-Realtime-Nonce' => $n,
            'X-Realtime-Signature' => $sig,
        ];
    }

    /**
     * Compute HMAC-SHA256 hex signature over canonical request components.
     */
    public function computeSignature(string $timestamp, string $nonce, string $method, string $path, string $rawBody): string
    {
        $canonical = implode('.', [
            $timestamp,
            $nonce,
            strtoupper($method),
            $path,
            $rawBody,
        ]);

        return hash_hmac('sha256', $canonical, $this->secret);
    }

    /**
     * Verify an inbound internal HTTP request.
     *
     * @return array{valid: bool, reason: string}
     */
    public function verifyRequest(Request $request, ?int $now = null): array
    {
        if ($this->secret === '') {
            return ['valid' => false, 'reason' => 'INTERNAL_SECRET_NOT_CONFIGURED'];
        }

        $timestamp = trim((string) ($request->getHeader(self::HEADER_TIMESTAMP) ?? ''));
        $nonce = trim((string) ($request->getHeader(self::HEADER_NONCE) ?? ''));
        $signature = trim((string) ($request->getHeader(self::HEADER_SIGNATURE) ?? ''));

        if ($timestamp === '' || $nonce === '' || $signature === '') {
            return ['valid' => false, 'reason' => 'MISSING_AUTH_HEADERS'];
        }

        if (!ctype_digit($timestamp)) {
            return ['valid' => false, 'reason' => 'INVALID_TIMESTAMP'];
        }

        $current = $now ?? time();
        $tsInt = (int) $timestamp;
        if (abs($current - $tsInt) > $this->replayWindowSeconds) {
            return ['valid' => false, 'reason' => 'TIMESTAMP_OUT_OF_WINDOW'];
        }

        if (strlen($nonce) < 16 || strlen($nonce) > 128) {
            return ['valid' => false, 'reason' => 'INVALID_NONCE'];
        }

        $this->pruneNonces($current);
        if (isset(self::$seenNonces[$nonce])) {
            return ['valid' => false, 'reason' => 'REPLAYED_NONCE'];
        }

        $rawBody = $request->getRawBody();
        $expected = $this->computeSignature($timestamp, $nonce, $request->getMethod(), $request->getPath(), $rawBody);

        if (!hash_equals($expected, strtolower($signature))) {
            return ['valid' => false, 'reason' => 'INVALID_SIGNATURE'];
        }

        self::$seenNonces[$nonce] = $current + $this->replayWindowSeconds;

        return ['valid' => true, 'reason' => 'OK'];
    }

    public static function clearNonceCache(): void
    {
        self::$seenNonces = [];
    }

    private function pruneNonces(int $now): void
    {
        foreach (self::$seenNonces as $k => $exp) {
            if ($exp <= $now) {
                unset(self::$seenNonces[$k]);
            }
        }
    }
}
