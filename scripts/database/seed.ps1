# ToothCare Hub - Execute Development Seeder inside Docker (PowerShell)
Write-Host "Seeding development data into toothcare-mysql container..." -ForegroundColor Cyan
Get-Content database\seeds\development_seed.sql | docker exec -i toothcare-mysql mysql -u root -proot_secure_pass toothcare_hub
Write-Host "Database seeded successfully!" -ForegroundColor Green
