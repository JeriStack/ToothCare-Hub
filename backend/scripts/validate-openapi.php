<?php

declare(strict_types=1);

/**
 * ToothCare Hub - OpenAPI 3.x Contract & Route Coverage Validator
 *
 * Validates:
 *  1. YAML syntax and OpenAPI 3.x root structure (docs/openapi.yaml + backend/openapi/openapi.yaml mirror)
 *  2. Required standard schemas and security schemes (CookieAuth, CsrfToken)
 *  3. Recursive $ref pointer resolution
 *  4. Unique operationId across all operations
 *  5. Path template parameters ({id}, {roleId}, etc.) declared in operation parameters
 *  6. 100% route coverage against backend/src/Routes/api.php (excluding /internal/*, /docs*, and $notImplemented placeholders)
 *  7. Security hygiene: no /internal/ route leaks and no secret/credential patterns
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

use Symfony\Component\Yaml\Yaml;

$repoRoot = dirname(__DIR__, 2);
$docsSpecPath = $repoRoot . '/docs/openapi.yaml';
$mirrorSpecPath = dirname(__DIR__) . '/openapi/openapi.yaml';
$routesPath = dirname(__DIR__) . '/src/Routes/api.php';

echo "Validating OpenAPI specification: {$docsSpecPath}\n";

if (!is_file($docsSpecPath)) {
    echo "ERROR: Specification file not found at {$docsSpecPath}. Run `composer openapi:generate`.\n";
    exit(1);
}

$raw = file_get_contents($docsSpecPath);
if ($raw === false) {
    echo "ERROR: Unable to read {$docsSpecPath}\n";
    exit(1);
}

try {
    $spec = Yaml::parse($raw);
} catch (\Throwable $e) {
    echo "YAML PARSE ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

$errors = [];

// 1. Verify mirror sync
if (!is_file($mirrorSpecPath)) {
    $errors[] = "Missing mirrored OpenAPI file at {$mirrorSpecPath}";
} else {
    $mirrorRaw = file_get_contents($mirrorSpecPath);
    if ($mirrorRaw === false || str_replace("\r\n", "\n", $mirrorRaw) !== str_replace("\r\n", "\n", $raw)) {
        $errors[] = "docs/openapi.yaml and backend/openapi/openapi.yaml are out of sync. Run `composer openapi:generate`.";
    }
}

// 2. Verify Root Properties & OpenAPI Version
foreach (['openapi', 'info', 'paths', 'components'] as $prop) {
    if (!isset($spec[$prop])) {
        $errors[] = "Missing required root property '{$prop}'";
    }
}

if (isset($spec['openapi']) && !str_starts_with((string) $spec['openapi'], '3.')) {
    $errors[] = "OpenAPI version must be 3.x (found: {$spec['openapi']})";
}

// 3. Verify Components & Security Schemes
$components = $spec['components'] ?? [];
$schemas = $components['schemas'] ?? [];
foreach (['SuccessEnvelope', 'ErrorEnvelope', 'ResponseMeta', 'ErrorDetail', 'PaginationMeta', 'Appointment', 'User', 'Notification'] as $schema) {
    if (!isset($schemas[$schema])) {
        $errors[] = "Missing standard schema component '{$schema}'";
    }
}

$securitySchemes = $components['securitySchemes'] ?? [];
foreach (['CookieAuth', 'CsrfToken'] as $scheme) {
    if (!isset($securitySchemes[$scheme])) {
        $errors[] = "Missing required securityScheme '{$scheme}'";
    }
}

// 4. Recursive $ref pointer resolution
function checkRefs(mixed $node, array $fullSpec, array &$errors, string $path = ''): void
{
    if (!is_array($node)) {
        return;
    }

    foreach ($node as $key => $value) {
        $currentPath = $path !== '' ? "{$path}.{$key}" : (string) $key;
        if ($key === '$ref' && is_string($value)) {
            if (str_starts_with($value, '#/')) {
                $parts = explode('/', substr($value, 2));
                $target = $fullSpec;
                $resolved = true;
                foreach ($parts as $part) {
                    $unescaped = str_replace(['~1', '~0'], ['/', '~'], $part);
                    if (!is_array($target) || !array_key_exists($unescaped, $target)) {
                        $resolved = false;
                        break;
                    }
                    $target = $target[$unescaped];
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

// 5. Operation checks: unique operationId, responses present, path parameters declared, no /internal/ leaks
$httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
$operationIds = [];
$documentedOps = [];
$paths = $spec['paths'] ?? [];

foreach ($paths as $pathKey => $pathItem) {
    if (!is_string($pathKey) || !is_array($pathItem)) {
        continue;
    }

    if (str_contains($pathKey, '/internal/')) {
        $errors[] = "Internal route must not be documented in public OpenAPI spec: {$pathKey}";
    }

    preg_match_all('/\{([^}]+)\}/', $pathKey, $paramMatches);
    $requiredPathParams = $paramMatches[1] ?? [];

    $pathLevelParams = [];
    foreach (($pathItem['parameters'] ?? []) as $p) {
        if (is_array($p) && ($p['in'] ?? '') === 'path' && isset($p['name'])) {
            $pathLevelParams[] = $p['name'];
        }
    }

    foreach ($pathItem as $method => $operation) {
        $methodLower = strtolower((string) $method);
        if (!in_array($methodLower, $httpMethods, true) || !is_array($operation)) {
            continue;
        }

        $opKey = strtoupper($methodLower) . ' ' . $pathKey;
        $documentedOps[$opKey] = true;

        $opId = $operation['operationId'] ?? null;
        if (is_string($opId) && $opId !== '') {
            if (isset($operationIds[$opId])) {
                $errors[] = "Duplicate operationId '{$opId}' on {$opKey} (already used by {$operationIds[$opId]})";
            } else {
                $operationIds[$opId] = $opKey;
            }
        }

        if (empty($operation['responses']) || !is_array($operation['responses'])) {
            $errors[] = "Operation {$opKey} is missing responses";
        }

        $declaredPathParams = $pathLevelParams;
        foreach (($operation['parameters'] ?? []) as $p) {
            if (is_array($p) && ($p['in'] ?? '') === 'path' && isset($p['name'])) {
                $declaredPathParams[] = $p['name'];
            }
        }
        foreach ($requiredPathParams as $reqParam) {
            if (!in_array($reqParam, $declaredPathParams, true)) {
                $errors[] = "Operation {$opKey} is missing path parameter declaration for '{\{$reqParam\}}'";
            }
        }
    }
}

// 6. Verify 100% released public route coverage against backend/src/Routes/api.php
if (!is_file($routesPath)) {
    $errors[] = "Routes file not found at {$routesPath}";
} else {
    $routesSrc = file_get_contents($routesPath) ?: '';
    $lines = preg_split('/\R/', $routesSrc) ?: [];
    $registeredPublicOps = [];

    foreach ($lines as $line) {
        if (!preg_match('/\$r->(get|post|put|patch|delete)\(\s*\'([^\']+)\'/', $line, $m)) {
            continue;
        }
        $method = strtoupper($m[1]);
        $routePath = $m[2];

        // Intentionally excluded from public OpenAPI contract:
        // - Internal service-to-service routes (/internal/*)
        // - Local/dev Swagger UI self-hosting endpoints (/docs, /docs/openapi.yaml)
        // - Planned 501 placeholders ($notImplemented)
        if (str_starts_with($routePath, '/internal/') || $routePath === '/docs' || str_starts_with($routePath, '/docs/')) {
            continue;
        }
        if (str_contains($line, '$notImplemented')) {
            continue;
        }

        $registeredPublicOps["{$method} {$routePath}"] = true;
    }

    foreach (array_keys($registeredPublicOps) as $opKey) {
        if (!isset($documentedOps[$opKey])) {
            $errors[] = "Undocumented released backend route: {$opKey}";
        }
    }

    foreach (array_keys($documentedOps) as $opKey) {
        if (!isset($registeredPublicOps[$opKey])) {
            $errors[] = "Documented OpenAPI operation does not exist in backend/src/Routes/api.php: {$opKey}";
        }
    }
}

// 7. Secret hygiene scan
$secretPatterns = [
    '/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/' => 'Private key material detected',
    '/sk_live_[0-9a-zA-Z]{16,}/' => 'Live secret key pattern detected',
    '/AKIA[0-9A-Z]{16}/' => 'AWS access key pattern detected',
];
foreach ($secretPatterns as $regex => $msg) {
    if (preg_match($regex, $raw) === 1) {
        $errors[] = "Security hygiene violation: {$msg}";
    }
}

if (!empty($errors)) {
    echo "VALIDATION FAILED with " . count($errors) . " error(s):\n";
    foreach ($errors as $i => $err) {
        echo "  " . ($i + 1) . ". {$err}\n";
    }
    exit(1);
}

$pathCount = count($paths);
$opCount = count($documentedOps);
$schemaCount = count($schemas);
echo "SUCCESS: OpenAPI 3 specification is valid and matches 100% of released backend routes! ({$pathCount} paths, {$opCount} operations, {$schemaCount} schemas).\n";
exit(0);
