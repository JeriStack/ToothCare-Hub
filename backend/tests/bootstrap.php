<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

$cacheDir = __DIR__ . '/../.phpunit.cache/sessions';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0777, true);
}
if (is_dir($cacheDir)) {
    ini_set('session.save_path', $cacheDir);
}
ob_start();
