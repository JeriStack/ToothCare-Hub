# ToothCare Hub - Restore MySQL Database from Backup (PowerShell)
param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

if (!(Test-Path $BackupFile)) {
    Write-Error "Backup file not found at: $BackupFile"
    exit 1
}

Write-Host "Restoring database from $BackupFile..." -ForegroundColor Cyan
Get-Content $BackupFile | docker exec -i toothcare-mysql mysql -u root -proot_secure_pass toothcare_hub
Write-Host "Database restored successfully!" -ForegroundColor Green
