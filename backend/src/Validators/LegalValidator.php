<?php

declare(strict_types=1);

namespace App\Validators;

use App\Core\HttpException;
use App\Repositories\LegalDocumentRepository;
use App\Repositories\UserLegalAcceptanceRepository;

/**
 * Legal Documents and User Consent / Acceptance Validator
 * Enforces strict input validation for registration acceptance, re-acceptance, and admin draft workflows.
 */
class LegalValidator
{
    public const ALLOWED_TYPES = [
        LegalDocumentRepository::TYPE_TERMS,
        LegalDocumentRepository::TYPE_PRIVACY,
    ];

    /**
     * Resolve canonical acceptance action for a document type.
     * Terms of Service is ACCEPTED; Privacy Policy is ACKNOWLEDGED.
     */
    public static function requiredActionForType(string $documentType): string
    {
        return $documentType === LegalDocumentRepository::TYPE_PRIVACY
            ? UserLegalAcceptanceRepository::ACTION_ACKNOWLEDGED
            : UserLegalAcceptanceRepository::ACTION_ACCEPTED;
    }

    /**
     * Normalize boolean flag strictly (accepts true, 1, "1", "true"; rejects missing, false, 0, "false", "").
     */
    public static function isExplicitTrue(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value === true;
        }
        if (is_int($value)) {
            return $value === 1;
        }
        if (is_string($value)) {
            $normalized = strtolower(trim($value));
            return $normalized === 'true' || $normalized === '1';
        }
        return false;
    }

    /**
     * Validate registration legal acceptance input fields.
     * Never trusts client-supplied timestamps (e.g., accepted_at is intentionally stripped).
     *
     * @param array<string, mixed> $data
     * @return array{accepted: bool, terms_version: string, privacy_version: string}
     * @throws HttpException
     */
    public static function validateRegistrationLegalInput(array $data): array
    {
        $errors = [];

        $combinedAccepted = array_key_exists('accept_legal', $data)
            ? self::isExplicitTrue($data['accept_legal'])
            : (array_key_exists('legal_accepted', $data)
                ? self::isExplicitTrue($data['legal_accepted'])
                : (self::isExplicitTrue($data['accepted_terms'] ?? false) && self::isExplicitTrue($data['acknowledged_privacy'] ?? false)));

        if (!$combinedAccepted) {
            $errors['accept_legal'] = 'Please agree to the Terms of Service and acknowledge the Privacy Policy before creating your account.';
        }

        $termsVersion = isset($data['terms_version']) ? trim((string) $data['terms_version']) : '';
        if ($termsVersion === '') {
            $errors['terms_version'] = 'Current Terms of Service version is required.';
        } elseif (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/', $termsVersion)) {
            $errors['terms_version'] = 'Terms of Service version format is invalid.';
        }

        $privacyVersion = isset($data['privacy_version']) ? trim((string) $data['privacy_version']) : '';
        if ($privacyVersion === '') {
            $errors['privacy_version'] = 'Current Privacy Policy version is required.';
        } elseif (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/', $privacyVersion)) {
            $errors['privacy_version'] = 'Privacy Policy version format is invalid.';
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for legal agreement acceptance.', $errors);
        }

        return [
            'accepted' => true,
            'terms_version' => $termsVersion,
            'privacy_version' => $privacyVersion,
        ];
    }

    /**
     * Validate authenticated acceptance / re-acceptance payload.
     * Accepts either a single document object or an `acceptances` array of document items.
     *
     * @param array<string, mixed> $data
     * @return list<array{document_type: string, document_version: string, acceptance_action: string}>
     * @throws HttpException
     */
    public static function validateAuthenticatedAcceptances(array $data): array
    {
        $items = [];

        if (isset($data['acceptances']) && is_array($data['acceptances'])) {
            $items = $data['acceptances'];
        } elseif (isset($data['document_type']) || isset($data['document_version'])) {
            $items = [$data];
        }

        if (count($items) === 0) {
            throw HttpException::unprocessableEntity('At least one legal document acceptance is required.', [
                'acceptances' => 'At least one legal document acceptance item must be provided.',
            ]);
        }

        $errors = [];
        $validated = [];

        foreach ($items as $index => $item) {
            if (!is_array($item)) {
                $errors["acceptances.{$index}"] = 'Invalid legal acceptance entry.';
                continue;
            }

            $acceptedFlag = array_key_exists('accepted', $item) ? self::isExplicitTrue($item['accepted']) : true;
            if (!$acceptedFlag) {
                $errors["acceptances.{$index}.accepted"] = 'Explicit user confirmation is required.';
            }

            $docType = strtoupper(trim((string) ($item['document_type'] ?? '')));
            if (!in_array($docType, self::ALLOWED_TYPES, true)) {
                $errors["acceptances.{$index}.document_type"] = 'Document type must be TERMS_OF_SERVICE or PRIVACY_POLICY.';
                continue;
            }

            $docVersion = trim((string) ($item['document_version'] ?? ''));
            if ($docVersion === '' || !preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/', $docVersion)) {
                $errors["acceptances.{$index}.document_version"] = 'A valid document version identifier is required.';
                continue;
            }

            $expectedAction = self::requiredActionForType($docType);
            $submittedAction = isset($item['acceptance_action']) && trim((string) $item['acceptance_action']) !== ''
                ? strtoupper(trim((string) $item['acceptance_action']))
                : $expectedAction;

            if ($submittedAction !== $expectedAction) {
                $errors["acceptances.{$index}.acceptance_action"] = "Document type {$docType} requires acceptance action {$expectedAction}.";
                continue;
            }

            $validated[] = [
                'document_type' => $docType,
                'document_version' => $docVersion,
                'acceptance_action' => $expectedAction,
            ];
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for legal acceptance submission.', $errors);
        }

        return $validated;
    }

    /**
     * Validate admin draft creation payload.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     * @throws HttpException
     */
    public static function validateCreateDraft(array $data): array
    {
        $errors = [];

        $documentType = strtoupper(trim((string) ($data['document_type'] ?? '')));
        if (!in_array($documentType, self::ALLOWED_TYPES, true)) {
            $errors['document_type'] = 'Document type must be TERMS_OF_SERVICE or PRIVACY_POLICY.';
        }

        $version = trim((string) ($data['version'] ?? ''));
        if ($version === '' || !preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/', $version)) {
            $errors['version'] = 'A valid version identifier (e.g. 1.1 or 2.0) is required.';
        }

        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '' || mb_strlen($title) > 180) {
            $errors['title'] = 'Title is required and cannot exceed 180 characters.';
        }

        $effectiveDate = trim((string) ($data['effective_date'] ?? ''));
        if (!self::isValidIsoDate($effectiveDate)) {
            $errors['effective_date'] = 'Effective date must be a valid YYYY-MM-DD date.';
        }

        $content = $data['content'] ?? null;
        if (!is_array($content) || empty($content['sections']) || !is_array($content['sections'])) {
            $errors['content'] = 'Document content must include a non-empty sections array.';
        }

        $changeSummary = isset($data['change_summary']) ? trim((string) $data['change_summary']) : null;
        if ($changeSummary === '') {
            $changeSummary = null;
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for legal document draft.', $errors);
        }

        return [
            'document_type' => $documentType,
            'version' => $version,
            'title' => $title,
            'effective_date' => $effectiveDate,
            'content' => $content,
            'change_summary' => $changeSummary,
            'requires_reacceptance' => self::isExplicitTrue($data['requires_reacceptance'] ?? false),
            'is_approved' => self::isExplicitTrue($data['is_approved'] ?? false),
        ];
    }

    /**
     * Validate admin draft update payload.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     * @throws HttpException
     */
    public static function validateUpdateDraft(array $data): array
    {
        $errors = [];
        $fields = [];

        if (array_key_exists('title', $data)) {
            $title = trim((string) $data['title']);
            if ($title === '' || mb_strlen($title) > 180) {
                $errors['title'] = 'Title cannot be empty or exceed 180 characters.';
            } else {
                $fields['title'] = $title;
            }
        }

        if (array_key_exists('effective_date', $data)) {
            $effectiveDate = trim((string) $data['effective_date']);
            if (!self::isValidIsoDate($effectiveDate)) {
                $errors['effective_date'] = 'Effective date must be a valid YYYY-MM-DD date.';
            } else {
                $fields['effective_date'] = $effectiveDate;
            }
        }

        if (array_key_exists('change_summary', $data)) {
            $summary = trim((string) $data['change_summary']);
            $fields['change_summary'] = $summary !== '' ? $summary : null;
        }

        if (array_key_exists('requires_reacceptance', $data)) {
            $fields['requires_reacceptance'] = self::isExplicitTrue($data['requires_reacceptance']);
        }

        if (array_key_exists('is_approved', $data)) {
            $fields['is_approved'] = self::isExplicitTrue($data['is_approved']);
        }

        if (array_key_exists('content', $data)) {
            if (!is_array($data['content']) || empty($data['content']['sections']) || !is_array($data['content']['sections'])) {
                $errors['content'] = 'Document content must include a non-empty sections array.';
            } else {
                $fields['content'] = $data['content'];
            }
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for legal document update.', $errors);
        }

        return $fields;
    }

    /**
     * Validate publish payload.
     *
     * @param array<string, mixed> $data
     * @return array{effective_date: ?string, requires_reacceptance: ?bool, is_approved: ?bool}
     * @throws HttpException
     */
    public static function validatePublish(array $data): array
    {
        $errors = [];
        $effectiveDate = null;

        if (array_key_exists('effective_date', $data) && trim((string) $data['effective_date']) !== '') {
            $effectiveDate = trim((string) $data['effective_date']);
            if (!self::isValidIsoDate($effectiveDate)) {
                $errors['effective_date'] = 'Effective date must be a valid YYYY-MM-DD date.';
            }
        }

        if (!empty($errors)) {
            throw HttpException::unprocessableEntity('Validation failed for legal document publication.', $errors);
        }

        return [
            'effective_date' => $effectiveDate,
            'requires_reacceptance' => array_key_exists('requires_reacceptance', $data)
                ? self::isExplicitTrue($data['requires_reacceptance'])
                : null,
            'is_approved' => array_key_exists('is_approved', $data)
                ? self::isExplicitTrue($data['is_approved'])
                : null,
        ];
    }

    private static function isValidIsoDate(string $value): bool
    {
        if ($value === '') {
            return false;
        }
        $date = \DateTimeImmutable::createFromFormat('Y-m-d', $value);
        return $date !== false && $date->format('Y-m-d') === $value;
    }
}
