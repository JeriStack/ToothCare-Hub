<?php

declare(strict_types=1);

use App\Core\Config;

$config = Config::getInstance();

return [
    'default' => 'mysql',
    'connections' => [
        'mysql' => [
            'host' => $config->getString('db_host', 'mysql'),
            'port' => $config->getInt('db_port', 3306),
            'database' => $config->getString('db_database', 'toothcare_hub'),
            'username' => $config->getString('db_username', 'toothcare_app'),
            'password' => $config->getString('db_password', ''),
            'charset' => $config->getString('db_charset', 'utf8mb4'),
            'options' => [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_TIMEOUT => 3,
            ],
        ],
    ],
];

