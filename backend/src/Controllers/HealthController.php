<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Config;
use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthorizationMiddleware;
use App\Services\Realtime\RealtimeConfig;
use PDO;

/**
 * API Health and Liveness Controller
 */
class HealthController
{
    private Config $config;
    private Database $database;

    public function __construct(?Config $config = null, ?Database $database = null)
    {
        $this->config = $config ?? Config::getInstance();
        $this->database = $database ?? Database::getInstance($this->config);
    }

    /**
     * Standard Liveness / Health Check
     * GET /api/v1/health
     */
    public function check(Request $request): Response
    {
        $checkDependency = $request->getQuery('check') === 'ready';
        $dbStatus = 'unverified';
        $isDegraded = false;

        if ($checkDependency) {
            $dbConnected = $this->database->ping();
            $dbStatus = $dbConnected ? 'connected' : 'unavailable';
            if (!$dbConnected) {
                $isDegraded = true;
            }
        }

        $payload = [
            'status' => $isDegraded ? 'degraded' : 'ok',
            'service' => 'toothcare-backend',
            'environment' => $this->config->getString('app_env', 'development'),
            'timestamp' => date('Y-m-d\TH:i:sP'),
        ];

        if ($checkDependency) {
            $payload['database'] = $dbStatus;
        }

        $statusCode = $isDegraded ? 503 : 200;

        return Response::success($payload, $statusCode);
    }

    /**
     * Comprehensive System Health & Infrastructure Diagnostics
     * GET /api/v1/admin/system/health
     */
    public function systemHealth(Request $request): Response
    {
        AuthorizationMiddleware::requireUserPermission($request, 'system.health', ['ADMIN']);

        $pdo = $this->database->getConnection();

        // 1. Database check & latency
        $dbStart = microtime(true);
        $dbConnected = $this->database->ping();
        $dbLatencyMs = round((microtime(true) - $dbStart) * 1000, 2);

        // 2. MySQL Thread Count, Uptime & Table Status
        $dbThreads = 1;
        $dbSizeMb = 0.0;
        $dbUptimeSeconds = null;
        try {
            $thStmt = $pdo->query("SHOW STATUS LIKE 'Threads_connected'");
            $thRow = $thStmt->fetch(PDO::FETCH_ASSOC);
            $dbThreads = (int) ($thRow['Value'] ?? 1);

            $upStmt = $pdo->query("SHOW GLOBAL STATUS LIKE 'Uptime'");
            $upRow = $upStmt->fetch(PDO::FETCH_ASSOC);
            if ($upRow && isset($upRow['Value']) && is_numeric($upRow['Value'])) {
                $dbUptimeSeconds = (int) $upRow['Value'];
            }

            $sizeStmt = $pdo->query("
                SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb 
                FROM information_schema.TABLES 
                WHERE table_schema = DATABASE()
            ");
            $dbSizeMb = (float) ($sizeStmt->fetchColumn() ?: 0.0);
        } catch (\Throwable $e) {
            // Non-critical diagnostic
        }

        // 3. Memory, OPcache & System Status
        $memoryUsage = round(memory_get_usage(true) / 1024 / 1024, 2);
        $memoryPeak = round(memory_get_peak_usage(true) / 1024 / 1024, 2);
        $memoryLimit = (string) (ini_get('memory_limit') ?: '128M');
        $opcacheEnabled = false;
        if (function_exists('opcache_get_status')) {
            $opStatus = @opcache_get_status(false);
            $opcacheEnabled = is_array($opStatus) && !empty($opStatus['opcache_enabled']);
        }

        // 4. Rate Limiting Active Locks & Realtime Outbox Backlog
        $activeRateLimits = 0;
        $realtimePending = 0;
        $realtimeFailed = 0;
        try {
            $rateStmt = $pdo->prepare('SELECT COUNT(*) FROM rate_limits WHERE reset_at > ?');
            $rateStmt->execute([date('Y-m-d H:i:s')]);
            $activeRateLimits = (int) $rateStmt->fetchColumn();
        } catch (\Throwable $e) {
            $activeRateLimits = 0;
        }
        try {
            $rtOutboxStmt = $pdo->query("
                SELECT
                    COALESCE(SUM(CASE WHEN status IN ('PENDING', 'PROCESSING', 'FAILED_RETRYABLE') THEN 1 ELSE 0 END), 0) AS pending_count,
                    COALESCE(SUM(CASE WHEN status IN ('FAILED_PERMANENT', 'FAILED') THEN 1 ELSE 0 END), 0) AS failed_count
                FROM realtime_outbox
            ");
            $rtOutboxRow = $rtOutboxStmt->fetch(PDO::FETCH_ASSOC);
            if ($rtOutboxRow) {
                $realtimePending = (int) ($rtOutboxRow['pending_count'] ?? 0);
                $realtimeFailed = (int) ($rtOutboxRow['failed_count'] ?? 0);
            }
        } catch (\Throwable) {
            // Optional table in minimal test setups
        }

        $driver = '';
        try {
            $driver = strtolower((string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME));
        } catch (\Throwable) {
            $driver = '';
        }

        $realtimeConfig = RealtimeConfig::fromEnvironment();
        $parsedRealtime = parse_url($realtimeConfig->internalUrl) ?: [];
        $realtimeScheme = strtolower((string) ($parsedRealtime['scheme'] ?? 'http'));
        $defaultRealtimeHost = (string) ($parsedRealtime['host'] ?? 'realtime');
        $defaultRealtimePort = isset($parsedRealtime['port'])
            ? (int) $parsedRealtime['port']
            : ($realtimeScheme === 'https' ? 443 : 4000);

        $realtimeHost = $this->config->getString('realtime_host', $defaultRealtimeHost);
        $realtimePort = $this->config->getInt('realtime_port', $defaultRealtimePort);
        $realtimeReachable = null;
        $realtimeStatus = 'unverified';
        $realtimeLatencyMs = null;
        $realtimeActiveConnections = null;

        if (!$realtimeConfig->enabled) {
            $realtimeReachable = false;
            $realtimeStatus = 'disabled';
        } elseif ($driver !== 'sqlite') {
            $rtStart = microtime(true);
            $healthUrl = sprintf('%s://%s:%d/health', $realtimeScheme, $realtimeHost, $realtimePort);
            $context = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'timeout' => 0.8,
                    'ignore_errors' => true,
                    'header' => "Accept: application/json\r\n",
                ],
            ]);

            $rawHealth = @file_get_contents($healthUrl, false, $context);
            $realtimeLatencyMs = round((microtime(true) - $rtStart) * 1000, 2);

            if ($rawHealth !== false) {
                $decodedHealth = json_decode($rawHealth, true);
                if (is_array($decodedHealth) && ($decodedHealth['status'] ?? null) === 'healthy') {
                    $realtimeReachable = true;
                    $realtimeStatus = 'healthy';
                    if (isset($decodedHealth['active_connections']) && is_numeric($decodedHealth['active_connections'])) {
                        $realtimeActiveConnections = (int) $decodedHealth['active_connections'];
                    }
                } else {
                    $realtimeReachable = false;
                    $realtimeStatus = 'degraded';
                }
            } else {
                // Fallback to TCP reachability probe if HTTP stream wrapper is unavailable
                $errNo = 0;
                $errStr = '';
                $sock = @fsockopen($realtimeHost, $realtimePort, $errNo, $errStr, 0.5);
                if (is_resource($sock)) {
                    fclose($sock);
                    $realtimeReachable = true;
                    $realtimeStatus = 'healthy';
                } else {
                    $realtimeReachable = false;
                    $realtimeStatus = 'unreachable';
                    $realtimeLatencyMs = null;
                }
            }
        }

        $backupDir = dirname(__DIR__, 3) . '/backups';
        $backupDirAccessible = is_dir($backupDir);
        $backupCount = null;
        $lastBackup = null;
        if ($backupDirAccessible) {
            $backupCount = 0;
            $latestMtime = 0;
            try {
                $iterator = new \RecursiveIteratorIterator(
                    new \RecursiveDirectoryIterator($backupDir, \FilesystemIterator::SKIP_DOTS)
                );
                foreach ($iterator as $file) {
                    if ($file->isFile() && preg_match('/\.(sql|gz|zip)$/i', $file->getFilename())) {
                        $backupCount++;
                        $mtime = $file->getMTime();
                        if ($mtime > $latestMtime) {
                            $latestMtime = $mtime;
                        }
                    }
                }
                if ($latestMtime > 0) {
                    $lastBackup = date('c', $latestMtime);
                }
            } catch (\Throwable) {
                $backupCount = null;
            }
        }

        $backupStatus = $backupDirAccessible
            ? (($backupCount !== null && $backupCount > 0) ? 'available' : 'no_snapshots')
            : 'host_managed';

        $services = [
            'database' => [
                'name' => 'MySQL 8.0 Primary',
                'status' => $dbConnected ? 'healthy' : 'down',
                'latency_ms' => $dbLatencyMs,
                'threads_connected' => $dbThreads,
                'size_mb' => $dbSizeMb,
                'uptime_seconds' => $dbUptimeSeconds,
            ],
            'php_fpm' => [
                'name' => 'PHP-FPM Runtime',
                'status' => 'healthy',
                'version' => PHP_VERSION,
                'sapi' => PHP_SAPI,
                'memory_usage_mb' => $memoryUsage,
                'memory_peak_mb' => $memoryPeak,
                'memory_limit' => $memoryLimit,
                'opcache_enabled' => $opcacheEnabled,
            ],
            'realtime' => [
                'name' => 'Realtime Notification Service',
                'status' => $realtimeStatus,
                'reachable' => $realtimeReachable,
                'host' => $realtimeHost,
                'port' => $realtimePort,
                'latency_ms' => $realtimeLatencyMs,
                'active_connections' => $realtimeActiveConnections,
                'outbox_pending' => $realtimePending,
                'outbox_failed' => $realtimeFailed,
            ],
            'rate_limiter' => [
                'name' => 'Rate Limit Protection Engine',
                'status' => 'active',
                'throttled_targets' => $activeRateLimits,
            ],
            'backups' => [
                'status' => $backupStatus,
                'storage_type' => 'persistent_volume',
                'volume_name' => 'mysql-data',
                'directory_accessible' => $backupDirAccessible,
                'backup_files_count' => $backupCount,
                'last_backup' => $lastBackup,
            ],
        ];

        $isDegraded = !$dbConnected || ($realtimeConfig->enabled && $realtimeStatus === 'unreachable');

        return Response::success([
            'system_status' => $isDegraded ? 'degraded' : 'operational',
            'timestamp' => date('c'),
            'environment' => $this->config->getString('app_env', 'development'),
            'services' => $services,
        ]);
    }
}

