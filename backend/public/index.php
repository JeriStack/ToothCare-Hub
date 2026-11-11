<?php

declare(strict_types=1);

/**
 * ToothCare Hub - Native PHP REST API Front Controller
 * Phase 5 Application Foundation & API Contract
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use App\Core\Application;

$app = Application::boot();
$app->run();
