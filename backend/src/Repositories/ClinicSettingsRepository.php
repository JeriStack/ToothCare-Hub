<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Clinic Settings Repository
 */
class ClinicSettingsRepository
{
    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * Retrieve all clinic configuration keys
     *
     * @return array<string, mixed>
     */
    public function getAll(): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->query('
            SELECT setting_key, setting_value, description, value_type, is_public
            FROM clinic_settings
        ');
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $settings = [];
        foreach ($rows as $row) {
            $key = (string) $row['setting_key'];
            $val = (string) $row['setting_value'];
            $type = (string) $row['value_type'];

            $typedValue = match ($type) {
                'integer' => (int) $val,
                'boolean' => (bool) $val,
                'json' => json_decode($val, true) ?? [],
                default => $val,
            };

            $settings[$key] = [
                'value' => $typedValue,
                'description' => $row['description'],
                'type' => $type,
                'is_public' => (int) $row['is_public'] === 1,
            ];
        }

        return $settings;
    }

    /**
     * Update clinic configuration keys
     *
     * @param array<string, mixed> $settings
     */
    public function updateMultiple(array $settings): void
    {
        $pdo = $this->database->getConnection();
        $checkStmt = $pdo->prepare('SELECT id FROM clinic_settings WHERE setting_key = ? LIMIT 1');
        $updStmt = $pdo->prepare('UPDATE clinic_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?');
        $insStmt = $pdo->prepare('INSERT INTO clinic_settings (setting_key, setting_value, created_at, updated_at) VALUES (?, ?, NOW(), NOW())');

        foreach ($settings as $key => $val) {
            $cleanKey = trim((string) $key);
            $strVal = is_array($val) ? json_encode($val) : (string) $val;

            $checkStmt->execute([$cleanKey]);
            if ($checkStmt->fetchColumn()) {
                $updStmt->execute([$strVal, $cleanKey]);
            } else {
                $insStmt->execute([$cleanKey, $strVal]);
            }
        }
    }
}
