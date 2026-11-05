<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Patient Profile Repository
 * Manages patient demographic and medical records linked to user identity.
 */
class PatientRepository
{
    private Database $database;

    public function __construct(?Database $database = null)
    {
        $this->database = $database ?? Database::getInstance();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findByUserId(int $userId): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT * FROM patients WHERE user_id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('SELECT * FROM patients WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * @param array<string, mixed> $data
     */
    public function create(array $data): int
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO patients (
                user_id, first_name, last_name, date_of_birth, phone,
                gender, address, emergency_contact_name, emergency_contact_phone,
                medical_alerts, created_at, updated_at
            ) VALUES (
                :user_id, :first_name, :last_name, :date_of_birth, :phone,
                :gender, :address, :emergency_contact_name, :emergency_contact_phone,
                :medical_alerts, NOW(), NOW()
            )
        ');

        $stmt->execute([
            ':user_id' => $data['user_id'],
            ':first_name' => $data['first_name'],
            ':last_name' => $data['last_name'],
            ':date_of_birth' => $data['date_of_birth'],
            ':phone' => $data['phone'],
            ':gender' => $data['gender'] ?? 'PREFER_NOT_TO_SAY',
            ':address' => $data['address'] ?? null,
            ':emergency_contact_name' => $data['emergency_contact_name'] ?? null,
            ':emergency_contact_phone' => $data['emergency_contact_phone'] ?? null,
            ':medical_alerts' => $data['medical_alerts'] ?? null,
        ]);

        return (int) $pdo->lastInsertId();
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update(int $patientId, array $data): bool
    {
        $pdo = $this->database->getConnection();
        $fields = [];
        $params = [':id' => $patientId];

        $allowedColumns = [
            'first_name', 'last_name', 'date_of_birth', 'phone',
            'gender', 'address', 'emergency_contact_name', 'emergency_contact_phone',
            'medical_alerts'
        ];

        foreach ($allowedColumns as $col) {
            if (array_key_exists($col, $data)) {
                $fields[] = "{$col} = :{$col}";
                $params[":{$col}"] = $data[$col];
            }
        }

        if (empty($fields)) {
            return false;
        }

        $fields[] = 'updated_at = NOW()';
        $setClause = implode(', ', $fields);

        $stmt = $pdo->prepare("UPDATE patients SET {$setClause} WHERE id = :id");
        return $stmt->execute($params);
    }
}

