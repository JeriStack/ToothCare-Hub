<?php

declare(strict_types=1);

use App\Core\Config;

$config = Config::getInstance();

return [
    'name' => 'ToothCare Hub',
    'env' => $config->getString('app_env', 'development'),
    'debug' => $config->getBool('app_debug', false),
    'url' => $config->getString('app_url', 'http://localhost'),
    'timezone' => $config->getString('app_timezone', 'Asia/Manila'),
    'api_base_path' => $config->getString('api_base_path', '/api/v1'),
    'cors' => [
        'allowed_origins' => $config->getArray('cors_allowed_origins', ['http://localhost:5173']),
        'max_age' => $config->getInt('cors_max_age', 86400),
    ],
    'session' => [
        'cookie_name' => $config->getString('session_cookie_name', 'toothcare_session'),
        'secure' => $config->getBool('session_cookie_secure', false),
        'samesite' => $config->getString('session_cookie_samesite', 'Lax'),
        'lifetime' => $config->getInt('session_lifetime', 7200),
    ],
];

