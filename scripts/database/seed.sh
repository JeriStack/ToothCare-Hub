#!/usr/bin/env bash
# ToothCare Hub - Execute Development Seeder inside Docker
set -euo pipefail

echo "Executing ToothCare Hub development seeder in Docker container..."
docker exec -i toothcare-mysql mysql -u root -proot_secure_pass toothcare_hub < database/seeds/development_seed.sql
echo "Database seeded successfully!"
