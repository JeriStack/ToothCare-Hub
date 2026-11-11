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
    'auth' => [
        'password_min_length' => $config->getInt('auth_password_min_length', 8),
        'email_verification_token_ttl' => $config->getInt('email_verification_token_ttl', 86400),
        'password_reset_token_ttl' => $config->getInt('password_reset_token_ttl', 1800),
        'rate_limits' => [
            'login' => [
                'limit' => $config->getInt('auth_login_rate_limit', 5),
                'window' => $config->getInt('auth_login_rate_window', 900),
            ],
            'register' => [
                'limit' => $config->getInt('auth_register_rate_limit', 5),
                'window' => $config->getInt('auth_register_rate_window', 3600),
            ],
            'password_reset' => [
                'limit' => $config->getInt('auth_password_reset_rate_limit', 3),
                'window' => $config->getInt('auth_password_reset_rate_window', 3600),
            ],
        ],
    ],
    'scheduling' => [
        'timezone' => $config->getString('scheduling_timezone', 'Asia/Manila'),
        'min_advance_notice_minutes' => $config->getInt('scheduling_min_advance_notice_minutes', 120),
        'max_booking_horizon_days' => $config->getInt('scheduling_max_booking_horizon_days', 90),
        'default_buffer_minutes' => $config->getInt('scheduling_default_buffer_minutes', 10),
        'slot_interval_minutes' => $config->getInt('scheduling_slot_interval_minutes', 15),
    ],
];

