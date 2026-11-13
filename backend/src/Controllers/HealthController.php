<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Config;
use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthorizationMiddleware;
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

        // 2. MySQL Thread Count & Table Status
        $dbThreads = 1;
        $dbSizeMb = 0.0;
        try {
            $thStmt = $pdo->query("SHOW STATUS LIKE 'Threads_connected'");
            $thRow = $thStmt->fetch(PDO::FETCH_ASSOC);
            $dbThreads = (int) ($thRow['Value'] ?? 1);

            $sizeStmt = $pdo->query("
                SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb 
                FROM information_schema.TABLES 
                WHERE table_schema = DATABASE()
            ");
            $dbSizeMb = (float) ($sizeStmt->fetchColumn() ?: 0.0);
        } catch (\Throwable $e) {
            // Non-critical diagnostic
        }

        // 3. Memory & System Status
        $memoryUsage = round(memory_get_usage(true) / 1024 / 1024, 2);
        $memoryPeak = round(memory_get_peak_usage(true) / 1024 / 1024, 2);

        // 4. Rate Limiting Active Locks
        $activeRateLimits = 0;
        try {
            $rateStmt = $pdo->prepare('SELECT COUNT(*) FROM rate_limits WHERE reset_at > ?');
            $rateStmt->execute([date('Y-m-d H:i:s')]);
            $activeRateLimits = (int) $rateStmt->fetchColumn();
        } catch (\Throwable $e) {
            $activeRateLimits = 0;
        }

        $driver = '';
        try {
            $driver = strtolower((string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME));
        } catch (\Throwable) {
            $driver = '';
        }

        $realtimeHost = $this->config->getString('realtime_host', 'toothcare-realtime');
        $realtimePort = $this->config->getInt('realtime_port', 3001);
        $realtimeReachable = null;
        $realtimeStatus = 'unverified';
        if ($driver !== 'sqlite') {
            $errNo = 0;
            $errStr = '';
            $sock = @fsockopen($realtimeHost, $realtimePort, $errNo, $errStr, 0.2);
            if (is_resource($sock)) {
                fclose($sock);
                $realtimeReachable = true;
                $realtimeStatus = 'healthy';
            } else {
                $realtimeReachable = false;
                $realtimeStatus = 'unreachable';
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
            ],
            'php_fpm' => [
                'name' => 'PHP-FPM Runtime',
                'status' => 'healthy',
                'version' => PHP_VERSION,
                'memory_usage_mb' => $memoryUsage,
                'memory_peak_mb' => $memoryPeak,
            ],
            'realtime' => [
                'name' => 'Realtime Notification Service',
                'status' => $realtimeStatus,
                'reachable' => $realtimeReachable,
                'host' => $realtimeHost,
                'port' => $realtimePort,
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

        return Response::success([
            'system_status' => $dbConnected ? 'operational' : 'degraded',
            'timestamp' => date('c'),
            'environment' => $this->config->getString('app_env', 'development'),
            'services' => $services,
        ]);
    }
}

