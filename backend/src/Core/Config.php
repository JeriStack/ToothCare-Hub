<?php

declare(strict_types=1);

namespace App\Core;

use Dotenv\Dotenv;
use RuntimeException;

/**
 * Centralized Configuration Manager
 * Loads environment variables, validates required settings, and provides typed accessors.
 */
class Config
{
    private static ?self $instance = null;

    /**
     * @var array<string, mixed>
     */
    private array $settings = [];

    public function __construct(?string $envDirectory = null)
    {
        $this->loadEnvironment($envDirectory);
        $this->populateDefaults();
    }

    public static function getInstance(?string $envDirectory = null): self
    {
        if (self::$instance === null) {
            self::$instance = new self($envDirectory);
        }

        return self::$instance;
    }

    public static function setInstance(?self $instance): void
    {
        self::$instance = $instance;
    }

    private function loadEnvironment(?string $envDirectory = null): void
    {
        $baseDir = $envDirectory ?? dirname(__DIR__, 2);
        
        if (file_exists($baseDir . '/.env')) {
            $dotenv = Dotenv::createImmutable($baseDir);
            $dotenv->safeLoad();
        }
    }

    private function populateDefaults(): void
    {
        $this->settings = [
            'app_env' => $this->env('APP_ENV', 'development'),
            'app_debug' => $this->parseBool($this->env('APP_DEBUG', 'false')),
            'app_url' => rtrim($this->env('APP_URL', 'http://localhost'), '/'),
            'app_timezone' => $this->env('APP_TIMEZONE', 'Asia/Manila'),
            'api_base_path' => '/' . trim($this->env('API_BASE_PATH', '/api/v1'), '/'),
            
            // Database Settings
            'db_host' => $this->env('DB_HOST', 'mysql'),
            'db_port' => (int) $this->env('DB_PORT', '3306'),
            'db_database' => $this->env('DB_DATABASE', $this->env('DB_NAME', 'toothcare_hub')),
            'db_username' => $this->env('DB_USERNAME', $this->env('DB_USER', 'toothcare_app')),
            'db_password' => $this->env('DB_PASSWORD', ''),
            'db_charset' => $this->env('DB_CHARSET', 'utf8mb4'),
            
            // CORS
            'cors_allowed_origins' => $this->parseList($this->env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000')),
            'cors_max_age' => (int) $this->env('CORS_MAX_AGE', '86400'),
            
            // Session and Cookie
            'session_cookie_name' => $this->env('SESSION_COOKIE_NAME', 'toothcare_session'),
            'session_cookie_secure' => $this->parseBool($this->env('SESSION_COOKIE_SECURE', 'false')),
            'session_cookie_samesite' => $this->env('SESSION_COOKIE_SAMESITE', 'Lax'),
            'session_lifetime' => (int) $this->env('SESSION_LIFETIME', '7200'), // 2 hours
            
            // Request Constraints
            'request_body_max_bytes' => (int) $this->env('REQUEST_BODY_MAX_BYTES', '1048576'), // 1MB
            
            // Logging
            'log_level' => strtolower($this->env('LOG_LEVEL', 'debug')),
            'log_path' => $this->env('LOG_PATH', dirname(__DIR__, 2) . '/storage/logs/app.log'),
        ];

        // Production security overrides
        if ($this->settings['app_env'] === 'production') {
            $this->settings['app_debug'] = false;
        }

        date_default_timezone_set($this->settings['app_timezone']);
    }

    private function env(string $key, mixed $default = null): mixed
    {
        $val = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
        if ($val === false || $val === null || $val === '') {
            return $default;
        }

        return $val;
    }

    private function parseBool(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        $normalized = strtolower(trim((string) $value));
        return in_array($normalized, ['true', '1', 'yes', 'on'], true);
    }

    /**
     * @return list<string>
     */
    private function parseList(mixed $value): array
    {
        if (is_array($value)) {
            return array_values($value);
        }

        $items = explode(',', (string) $value);
        $trimmed = array_map('trim', $items);
        return array_values(array_filter($trimmed, fn ($item) => $item !== ''));
    }

    public function get(string $key, mixed $default = null): mixed
    {
        $normalizedKey = strtolower(str_replace(['.', '-'], '_', $key));
        return $this->settings[$normalizedKey] ?? $default;
    }

    public function getString(string $key, string $default = ''): string
    {
        $val = $this->get($key, $default);
        return is_scalar($val) ? (string) $val : $default;
    }

    public function getInt(string $key, int $default = 0): int
    {
        $val = $this->get($key, $default);
        return is_numeric($val) ? (int) $val : $default;
    }

    public function getBool(string $key, bool $default = false): bool
    {
        $val = $this->get($key, $default);
        return is_bool($val) ? $val : $this->parseBool($val);
    }

    /**
     * @return list<string>
     */
    public function getArray(string $key, array $default = []): array
    {
        $val = $this->get($key, $default);
        if (is_array($val)) {
            return array_values($val);
        }

        return $this->parseList($val);
    }

    public function isProduction(): bool
    {
        return $this->getString('app_env') === 'production';
    }

    public function isDebug(): bool
    {
        return $this->getBool('app_debug');
    }

    public function set(string $key, mixed $value): void
    {
        $normalizedKey = strtolower(str_replace(['.', '-'], '_', $key));
        $this->settings[$normalizedKey] = $value;
    }
}

