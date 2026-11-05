<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Structured Application Logger
 * Logs messages in JSON or standard structured format with request ID, context, and sensitive field redaction.
 */
class Logger
{
    private static ?self $instance = null;
    private string $logPath;
    private int $minLevelInt;

    private const LEVELS = [
        'debug' => 100,
        'info' => 200,
        'warning' => 300,
        'error' => 400,
        'critical' => 500,
    ];

    private const SENSITIVE_KEYS = [
        'password',
        'password_confirmation',
        'current_password',
        'new_password',
        'db_password',
        'token',
        'auth_token',
        'access_token',
        'refresh_token',
        'csrf_token',
        'secret',
        'api_key',
        'authorization',
        'cookie',
        'set-cookie',
    ];

    public function __construct(?string $logPath = null, string $logLevel = 'debug')
    {
        $this->logPath = $logPath ?? dirname(__DIR__, 2) . '/storage/logs/app.log';
        $this->minLevelInt = self::LEVELS[strtolower($logLevel)] ?? 100;
        
        $dir = dirname($this->logPath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
    }

    public static function getInstance(?Config $config = null): self
    {
        if (self::$instance === null) {
            $cfg = $config ?? Config::getInstance();
            self::$instance = new self(
                $cfg->getString('log_path'),
                $cfg->getString('log_level', 'debug')
            );
        }

        return self::$instance;
    }

    public static function setInstance(?self $instance): void
    {
        self::$instance = $instance;
    }

    /**
     * @param array<string, mixed> $context
     */
    public function log(string $level, string $message, array $context = [], ?string $requestId = null): void
    {
        $levelLower = strtolower($level);
        $levelInt = self::LEVELS[$levelLower] ?? 200;

        if ($levelInt < $this->minLevelInt) {
            return;
        }

        // CRLF protection on message
        $safeMessage = str_replace(["\r", "\n"], ' ', $message);
        
        // Redact sensitive context
        $safeContext = $this->redact($context);

        $record = [
            'timestamp' => date('Y-m-d\TH:i:s.vP'),
            'level' => strtoupper($level),
            'request_id' => $requestId ?? '',
            'message' => $safeMessage,
            'context' => $safeContext,
        ];

        $line = json_encode($record, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL;

        @file_put_contents($this->logPath, $line, FILE_APPEND | LOCK_EX);
    }

    /**
     * @param array<string, mixed> $context
     */
    public function debug(string $message, array $context = [], ?string $requestId = null): void
    {
        $this->log('debug', $message, $context, $requestId);
    }

    /**
     * @param array<string, mixed> $context
     */
    public function info(string $message, array $context = [], ?string $requestId = null): void
    {
        $this->log('info', $message, $context, $requestId);
    }

    /**
     * @param array<string, mixed> $context
     */
    public function warning(string $message, array $context = [], ?string $requestId = null): void
    {
        $this->log('warning', $message, $context, $requestId);
    }

    /**
     * @param array<string, mixed> $context
     */
    public function error(string $message, array $context = [], ?string $requestId = null): void
    {
        $this->log('error', $message, $context, $requestId);
    }

    /**
     * @param array<string, mixed> $context
     */
    public function critical(string $message, array $context = [], ?string $requestId = null): void
    {
        $this->log('critical', $message, $context, $requestId);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function redact(array $data): array
    {
        $redacted = [];
        foreach ($data as $key => $value) {
            $keyLower = strtolower((string) $key);
            if (in_array($keyLower, self::SENSITIVE_KEYS, true)) {
                $redacted[$key] = '***REDACTED***';
            } elseif (is_array($value)) {
                $redacted[$key] = $this->redact($value);
            } else {
                $redacted[$key] = $value;
            }
        }
        return $redacted;
    }
}

