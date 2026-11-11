# ToothCare Hub - Perform MySQL Database Backup (PowerShell)
param(
    [string]$BackupDir = "backups"
)

if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "toothcare_hub_backup_${timestamp}.sql"

Write-Host "Creating backup of toothcare_hub database..." -ForegroundColor Cyan
docker exec toothcare-mysql mysqldump -u root -proot_secure_pass --single-transaction --quick toothcare_hub | Out-File -FilePath $backupFile -Encoding utf8
Write-Host "Backup created successfully at: $backupFile" -ForegroundColor Green
