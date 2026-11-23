<?php
declare(strict_types=1);

return static function (array $d, array $c): array {
    $name = trim((string) ($d['name'] ?? ''));
    if ($name === '') {
        $name = 'there';
    }
    $token = (string) ($d['secure']['token'] ?? '');
    if ($token === '') {
        throw new InvalidArgumentException('token missing');
    }
    $clinicName = (string) ($c['name'] ?? 'ToothCare Hub');
    $ttlHours = max(1, (int) ($d['ttl_hours'] ?? 24));
    $baseUrl = rtrim((string) ($d['app_url'] ?? 'http://localhost'), '/');

    return [
        'subject' => 'Verify Your ' . $clinicName . ' Email Address',
        'heading' => 'Verify your email address, ' . $name,
        'paragraphs' => [
            'Thank you for registering with ' . $clinicName . '. Please verify your email address to confirm your account ownership and complete your registration.',
        ],
        'cta' => [
            'label' => 'Verify Email Address',
            'url' => $baseUrl . '/verify-email?token=' . rawurlencode($token),
        ],
        'closing' => [
            'This single-use verification link expires in ' . $ttlHours . ' hours.',
            'If this link has expired, open the verification page and use the "Resend Verification Email" option to request a new link.',
            'Security reminder: Never share this link with anyone. If you did not create a ' . $clinicName . ' account, you can safely ignore this email.',
        ],
    ];
};
