<?php

declare(strict_types=1);

use App\Core\Config;

$config = Config::getInstance();

return [
    'host' => $config->getString('REALTIME_HOST', 'realtime'),
    'port' => $config->getInt('REALTIME_PORT', 3001),
    'secret' => $config->getString('REALTIME_SECRET', ''),
];

