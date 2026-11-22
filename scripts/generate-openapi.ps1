<#
.SYNOPSIS
    Regenerates and validates the ToothCare Hub OpenAPI 3.0.3 specification.
.PARAMETER Check
    Verify that committed docs/openapi.yaml and backend/openapi/openapi.yaml have zero drift without overwriting them.
#>
param(
    [switch]$Check
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    if ($Check) {
        composer --working-dir=backend openapi:check
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } else {
        composer --working-dir=backend openapi:generate
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    composer --working-dir=backend openapi:validate
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}
