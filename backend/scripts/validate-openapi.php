<?php

declare(strict_types=1);

/**
 * ToothCare Hub - OpenAPI 3.x Contract Validator
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use Symfony\Component\Yaml\Exception\ParseException;
use Symfony\Component\Yaml\Yaml;

$specPath = realpath(dirname(__DIR__) . '/openapi/openapi.yaml');

echo "Validating OpenAPI specification: {$specPath}\n";

if ($specPath === false || !file_exists($specPath)) {
    echo "ERROR: Specification file not found at " . dirname(__DIR__) . "/openapi/openapi.yaml\n";
    exit(1);
}

try {
    $content = file_get_contents($specPath);
    if ($content === false) {
        throw new \RuntimeException("Unable to read file contents.");
    }
    $spec = Yaml::parse($content);
} catch (\Throwable $e) {
    echo "YAML PARSE ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

$errors = [];

// 1. Verify Root Properties
$requiredRoots = ['openapi', 'info', 'paths', 'components'];
foreach ($requiredRoots as $prop) {
    if (!isset($spec[$prop])) {
        $errors[] = "Missing required root property '{$prop}'";
    }
}

// 2. Verify OpenAPI Version
if (isset($spec['openapi']) && !str_starts_with((string) $spec['openapi'], '3.')) {
    $errors[] = "OpenAPI version must be 3.x (found: {$spec['openapi']})";
}

// 3. Verify Components
$components = $spec['components'] ?? [];
$schemas = $components['schemas'] ?? [];
$requiredSchemas = ['SuccessEnvelope', 'ErrorEnvelope', 'ResponseMeta', 'ErrorDetail'];
foreach ($requiredSchemas as $schema) {
    if (!isset($schemas[$schema])) {
        $errors[] = "Missing standard schema component '{$schema}'";
    }
}

// 4. Recursive reference check
function checkRefs(mixed $node, array $fullSpec, array &$errors, string $path = ''): void {
    if (!is_array($node)) {
        return;
    }

    foreach ($node as $key => $value) {
        $currentPath = $path ? "{$path}.{$key}" : (string) $key;
        if ($key === '$ref' && is_string($value)) {
            if (str_starts_with($value, '#/')) {
                $parts = explode('/', substr($value, 2));
                $target = $fullSpec;
                $resolved = true;
                foreach ($parts as $part) {
                    if (!isset($target[$part])) {
                        $resolved = false;
                        break;
                    }
                    $target = $target[$part];
                }
                if (!$resolved) {
                    $errors[] = "Unresolved \$ref pointer '{$value}' at {$currentPath}";
                }
            }
        } else {
            checkRefs($value, $fullSpec, $errors, $currentPath);
        }
    }
}

checkRefs($spec, $spec, $errors);

if (!empty($errors)) {
    echo "VALIDATION FAILED with " . count($errors) . " error(s):\n";
    foreach ($errors as $i => $err) {
        echo "  " . ($i + 1) . ". {$err}\n";
    }
    exit(1);
}

$pathCount = count($spec['paths'] ?? []);
$schemaCount = count($schemas);
echo "SUCCESS: OpenAPI 3 specification is valid! ({$pathCount} paths, {$schemaCount} schemas documented).\n";
exit(0);
