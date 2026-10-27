<?php
declare(strict_types=1);

/**
 * ToothCare Hub - Native PHP REST API Front Controller
 * Phase 2 Infrastructure & Health Verification
 */

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// 1. API Health Check Endpoint
if ($method === 'GET' && in_array($uri, ['/api/v1/health', '/api/health', '/health'], true)) {
    $dbHost = getenv('DB_HOST') ?: 'mysql';
    $dbPort = getenv('DB_PORT') ?: '3306';
    $dbName = getenv('DB_NAME') ?: 'toothcare_hub';
    $dbUser = getenv('DB_USER') ?: 'toothcare_user';
    $dbPass = getenv('DB_PASSWORD') ?: 'toothcare_secure_pass';

    $dbStatus = 'pending';
    $dbCode = 200;

    try {
        $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
        $pdo = new PDO($dsn, $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 2,
        ]);
        $pdo->query('SELECT 1');
        $dbStatus = 'connected';
    } catch (\Throwable $e) {
        $dbStatus = 'disconnected: ' . $e->getMessage();
        // Return 503 if the database is required and not reachable
        $dbCode = 503;
    }

    http_response_code($dbCode);
    echo json_encode([
        'status' => $dbCode === 200 ? 'healthy' : 'degraded',
        'service' => 'toothcare-backend',
        'php_version' => PHP_VERSION,
        'environment' => getenv('APP_ENV') ?: 'development',
        'database' => $dbStatus,
        'timestamp' => gmdate('c'),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// 2. Metrics Endpoint for Prometheus Scraper
if ($method === 'GET' && in_array($uri, ['/api/v1/metrics', '/metrics'], true)) {
    header('Content-Type: text/plain; version=0.0.4; charset=UTF-8');
    
    $dbConnected = 0;
    try {
        $dbHost = getenv('DB_HOST') ?: 'mysql';
        $dbPort = getenv('DB_PORT') ?: '3306';
        $dbName = getenv('DB_NAME') ?: 'toothcare_hub';
        $dbUser = getenv('DB_USER') ?: 'toothcare_user';
        $dbPass = getenv('DB_PASSWORD') ?: 'toothcare_secure_pass';
        $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
        $pdo = new PDO($dsn, $dbUser, $dbPass, [PDO::ATTR_TIMEOUT => 1]);
        if ($pdo) {
            $dbConnected = 1;
        }
    } catch (\Throwable $e) {
        $dbConnected = 0;
    }

    echo "# HELP toothcare_backend_up Backend service availability indicator\n";
    echo "# TYPE toothcare_backend_up gauge\n";
    echo "toothcare_backend_up 1\n";
    echo "# HELP toothcare_backend_db_connected Database connection status\n";
    echo "# TYPE toothcare_backend_db_connected gauge\n";
    echo "toothcare_backend_db_connected {$dbConnected}\n";
    exit;
}

// 3. Fallback Route for Phase 2
http_response_code(404);
echo json_encode([
    'error' => 'Not Found',
    'message' => 'ToothCare Hub API route not implemented in Phase 2.',
    'available_endpoints' => [
        '/api/v1/health',
        '/api/v1/metrics',
    ],
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
