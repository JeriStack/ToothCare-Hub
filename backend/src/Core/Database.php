<?php

declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;

/**
 * Centralized Database Connection Provider (PDO)
 * Ensures secure PDO configuration, charset negotiation, and sanitized error handling.
 */
class Database
{
    private static ?self $instance = null;
    private ?PDO $pdo = null;
    private Config $config;
    private Logger $logger;

    public function __construct(?Config $config = null, ?Logger $logger = null)
    {
        $this->config = $config ?? Config::getInstance();
        $this->logger = $logger ?? Logger::getInstance($this->config);
    }

    public static function getInstance(?Config $config = null, ?Logger $logger = null): self
    {
        if (self::$instance === null) {
            self::$instance = new self($config, $logger);
        }

        return self::$instance;
    }

    public static function setInstance(?self $instance): void
    {
        self::$instance = $instance;
    }

    /**
     * Set an existing PDO connection (ideal for testing or transaction mocks)
     */
    public function setConnection(?PDO $pdo): void
    {
        $this->pdo = $pdo;
    }

    public function getConnection(): PDO
    {
        if ($this->pdo !== null) {
            return $this->pdo;
        }

        $host = $this->config->getString('db_host', 'mysql');
        $port = $this->config->getInt('db_port', 3306);
        $dbname = $this->config->getString('db_database', 'toothcare_hub');
        $username = $this->config->getString('db_username', 'toothcare_app');
        $password = $this->config->getString('db_password', '');
        $charset = $this->config->getString('db_charset', 'utf8mb4');

        $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 3,
        ];

        try {
            $this->pdo = new PDO($dsn, $username, $password, $options);
            return $this->pdo;
        } catch (PDOException $e) {
            // Log sanitized diagnostic details (never include password)
            $this->logger->error('Database connection failed', [
                'host' => $host,
                'port' => $port,
                'database' => $dbname,
                'user' => $username,
                'error_code' => $e->getCode(),
                'error_message' => $e->getMessage(),
            ]);

            throw HttpException::serviceUnavailable('Database service is currently unavailable.');
        }
    }

    /**
     * Non-throwing connection ping for health and liveness checks
     */
    public function ping(): bool
    {
        try {
            $pdo = $this->getConnection();
            $stmt = $pdo->query('SELECT 1');
            return $stmt !== false;
        } catch (\Throwable $e) {
            return false;
        }
    }

    public function beginTransaction(): bool
    {
        return $this->getConnection()->beginTransaction();
    }

    public function commit(): bool
    {
        return $this->getConnection()->commit();
    }

    public function rollBack(): bool
    {
        if ($this->getConnection()->inTransaction()) {
            return $this->getConnection()->rollBack();
        }
        return false;
    }

    public function inTransaction(): bool
    {
        return $this->getConnection()->inTransaction();
    }
}

