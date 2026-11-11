<?php

declare(strict_types=1);

use App\Core\Config;

$config = Config::getInstance();

return [
    'mailer' => $config->getString('MAIL_MAILER', 'smtp'),
    'host' => $config->getString('MAIL_HOST', 'mailpit'),
    'port' => $config->getInt('MAIL_PORT', 1025),
    'username' => $config->getString('MAIL_USERNAME', ''),
    'password' => $config->getString('MAIL_PASSWORD', ''),
    'encryption' => $config->getString('MAIL_ENCRYPTION', ''),
    'from' => [
        'address' => $config->getString('MAIL_FROM_ADDRESS', 'noreply@toothcarehub.local'),
        'name' => $config->getString('MAIL_FROM_NAME', 'ToothCare Hub'),
    ],
];

