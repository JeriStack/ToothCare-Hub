<?php

declare(strict_types=1);

/**
 * ToothCare Hub — Reproducible OpenAPI 3.0.3 Generator (swagger-php)
 *
 * Scans PHP 8 OpenAPI attributes in backend/src/OpenApi and writes deterministic YAML to:
 *   - docs/openapi.yaml (canonical Phase 17 specification)
 *   - backend/openapi/openapi.yaml (mirror for backend tooling/container mounts)
 *
 * Usage:
 *   php backend/scripts/generate-openapi.php           # Generate/update specs
 *   php backend/scripts/generate-openapi.php --check   # Fail if committed specs are stale (CI drift gate)
 */

// Suppress PHP 8.5 E_DEPRECATED notices emitted by vendor/zircote/swagger-php's SplObjectStorage calls
error_reporting(E_ALL & ~E_DEPRECATED);

require_once dirname(__DIR__) . '/vendor/autoload.php';

use OpenApi\Generator;
use Psr\Log\NullLogger;

$backendDir = dirname(__DIR__);
$repoRoot = dirname($backendDir);
$scanDir = $backendDir . '/src/OpenApi';

$canonicalTarget = $repoRoot . '/docs/openapi.yaml';
$mirrorTarget = $backendDir . '/openapi/openapi.yaml';

$checkOnly = in_array('--check', $argv, true);

$openapi = (new Generator(new NullLogger()))->generate([$scanDir], null, false);
$yaml = rtrim($openapi->toYaml()) . "\n";

// Normalize CRLF -> LF for cross-platform deterministic diffs (Windows <-> Linux CI)
$yaml = str_replace("\r\n", "\n", $yaml);

if ($checkOnly) {
    $stale = [];
    foreach ([$canonicalTarget, $mirrorTarget] as $target) {
        if (!is_file($target)) {
            $stale[] = $target . ' (missing)';
            continue;
        }
        $existing = str_replace("\r\n", "\n", (string) file_get_contents($target));
        if ($existing !== $yaml) {
            $stale[] = $target . ' (out of date)';
        }
    }

    if (!empty($stale)) {
        fwrite(STDERR, "OPENAPI DRIFT DETECTED:\n");
        foreach ($stale as $item) {
            fwrite(STDERR, "  - {$item}\n");
        }
        fwrite(STDERR, "Run 'composer --working-dir=backend openapi:generate' and commit the updated YAML.\n");
        exit(1);
    }

    echo "OK: docs/openapi.yaml and backend/openapi/openapi.yaml are up to date with PHP source.\n";
    exit(0);
}

foreach ([$canonicalTarget, $mirrorTarget] as $target) {
    $dir = dirname($target);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    file_put_contents($target, $yaml);
}

echo "Generated deterministic OpenAPI 3.0.3 YAML:\n";
echo "  - {$canonicalTarget}\n";
echo "  - {$mirrorTarget}\n";
exit(0);
