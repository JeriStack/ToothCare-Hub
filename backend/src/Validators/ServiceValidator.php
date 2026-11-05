<?php

declare(strict_types=1);

namespace App\Validators;

use App\Core\HttpException;

/**
 * Dental Service Validator
 * Validates procedure names, prices, categories, and standard durations.
 */
class ServiceValidator
{
    private const ALLOWED_DURATIONS = [15, 30, 45, 60, 90, 120];

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed> Validated and normalized data
     * @throws HttpException
     */
    public static function validate(array $data, bool $isUpdate = false): array
    {
        $errors = [];

        // 1. Name
        if (!$isUpdate || array_key_exists('name', $data)) {
            $name = isset($data['name']) ? trim((string) $data['name']) : '';
            if ($name === '') {
                $errors['name'] = 'Service name is required.';
            } elseif (mb_strlen($name) < 2 || mb_strlen($name) > 150) {
                $errors['name'] = 'Service name must be between 2 and 150 characters.';
            }
        }

        // 2. Price
        if (!$isUpdate || array_key_exists('price', $data)) {
            if (!isset($data['price']) || !is_numeric($data['price'])) {
                $errors['price'] = 'A valid numeric price is required.';
            } else {
                $price = (float) $data['price'];
                if ($price < 0.00) {
                    $errors['price'] = 'Price cannot be negative.';
                }
            }
        }

        // 3. Duration Minutes
        if (!$isUpdate || array_key_exists('duration_minutes', $data)) {
            if (!isset($data['duration_minutes']) || !is_numeric($data['duration_minutes'])) {
                $errors['duration_minutes'] = 'Duration minutes is required.';
            } else {
                $duration = (int) $data['duration_minutes'];
                if (!in_array($duration, self::ALLOWED_DURATIONS, true)) {
                    $errors['duration_minutes'] = 'Duration minutes must be one of: 15, 30, 45, 60, 90, 120.';
                }
            }
        }

        // 4. Category
        $category = isset($data['category']) ? trim((string) $data['category']) : 'General';
        if ($category !== '' && mb_strlen($category) > 100) {
            $errors['category'] = 'Category cannot exceed 100 characters.';
        }

        // 5. Description
        $description = isset($data['description']) ? trim((string) $data['description']) : null;

        // 6. Active Status
        $isActive = isset($data['is_active']) ? ((int) $data['is_active'] ? 1 : 0) : 1;

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for dental service.', $errors);
        }

        $result = [];
        if (isset($data['name'])) {
            $result['name'] = trim((string) $data['name']);
        }
        if (isset($data['price'])) {
            $result['price'] = number_format((float) $data['price'], 2, '.', '');
        }
        if (isset($data['duration_minutes'])) {
            $result['duration_minutes'] = (int) $data['duration_minutes'];
        }
        if (array_key_exists('category', $data)) {
            $result['category'] = $category !== '' ? $category : 'General';
        }
        if (array_key_exists('description', $data)) {
            $result['description'] = $description;
        }
        if (array_key_exists('is_active', $data)) {
            $result['is_active'] = $isActive;
        }

        return $result;
    }

    /**
     * @param array<string, mixed> $data
     * @return int 0 or 1
     */
    public static function validateStatus(array $data): int
    {
        if (!isset($data['is_active'])) {
            throw HttpException::unprocessableEntity('Validation failed.', [
                'is_active' => 'Active status boolean or integer (0 or 1) is required.',
            ]);
        }

        $val = $data['is_active'];
        if ($val === true || $val === 1 || $val === '1' || $val === 'true') {
            return 1;
        }
        if ($val === false || $val === 0 || $val === '0' || $val === 'false') {
            return 0;
        }

        throw HttpException::unprocessableEntity('Validation failed.', [
            'is_active' => 'Invalid active status. Must be 0 or 1.',
        ]);
    }
}
