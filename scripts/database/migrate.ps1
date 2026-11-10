# ToothCare Hub - Execute Migrations inside Docker (PowerShell)
param(
    [switch]$Status,
    [switch]$NoBackup
)

$argsList = @()
if ($Status) { $argsList += "--status" }
if ($NoBackup) { $argsList += "--no-backup" }

Write-Host "Executing ToothCare Hub database migrations in Docker container..." -ForegroundColor Cyan
docker exec toothcare-php-fpm php /var/www/backend/database/migrate.php @argsList
