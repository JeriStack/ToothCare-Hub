<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Config;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;

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
}

