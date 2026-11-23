<?php
declare(strict_types=1);

return static function (array $d, array $c): array {
    $name = trim((string) ($d['name'] ?? ''));
    if ($name === '') {
        $name = 'Valued Patient';
    }
    $clinicName = (string) ($c['name'] ?? 'ToothCare Hub');
    $verificationRequired = (bool) ($d['verification_required'] ?? true);
    $ttlHours = max(1, (int) ($d['ttl_hours'] ?? 24));

    $nextStepMessage = $verificationRequired
        ? 'Next step: Please look for our separate verification email and verify your email address within ' . $ttlHours . ' hours to confirm your identity. Your account is currently unverified until you complete email verification.'
        : 'Your account is active and ready to use.';

    return [
        'subject' => 'Thank You for Registering with ' . $clinicName . '!',
        'heading' => 'Hello, ' . $name . '!',
        'paragraphs' => [
            'Thank you for creating your ' . $clinicName . ' account. We\'re glad to have you with us!',
            'Your registration has been successfully received.',
            'You can use ' . $clinicName . ' to explore available dental services, view dentist information, and request dental appointments.',
            $nextStepMessage,
        ],
        'closing' => [
            'Thank you for choosing ' . $clinicName . '.',
            'The ' . $clinicName . ' Team',
        ],
    ];
};
