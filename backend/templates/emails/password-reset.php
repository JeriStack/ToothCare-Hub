<?php
declare(strict_types=1);

return static function (array $d, array $c): array {
    $name = (string) ($d['name'] ?? 'there');
    $token = (string) ($d['secure']['token'] ?? '');
    if ($token === '') {
        throw new InvalidArgumentException('token missing');
    }
    $ttlMinutes = (int) ($d['ttl_minutes'] ?? 30);
    return [
        'subject' => 'Reset your ToothCare Hub password',
        'heading' => 'Password reset request',
        'paragraphs' => [
            'Hello ' . $name . ', we received a request to reset the password for your account.',
        ],
        'cta' => ['label' => 'Choose a new password', 'url' => rtrim((string) $d['app_url'], '/') . '/reset-password?token=' . rawurlencode($token)],
        'closing' => [
            'This link can be used once and expires in ' . $ttlMinutes . ' minutes. If you did not request a reset, ignore this email or contact the clinic.',
        ],
    ];
};