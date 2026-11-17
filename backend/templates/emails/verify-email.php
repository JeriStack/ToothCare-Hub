<?php
declare(strict_types=1);

return static function (array $d, array $c): array {
    $name = (string) ($d['name'] ?? 'there');
    $token = (string) ($d['secure']['token'] ?? '');
    if ($token === '') {
        throw new InvalidArgumentException('token missing');
    }
    $ttlHours = (int) ($d['ttl_hours'] ?? 24);
    return [
        'subject' => 'Verify your ToothCare Hub email address',
        'heading' => 'Welcome to ' . $c['name'] . ', ' . $name,
        'paragraphs' => [
            'Thank you for creating an account. Please verify your email address to finish setting up your account.',
        ],
        'cta' => ['label' => 'Verify email address', 'url' => rtrim((string) $d['app_url'], '/') . '/verify-email?token=' . rawurlencode($token)],
        'closing' => [
            'This link can be used once and expires in ' . $ttlHours . ' hours. If you did not create this account, you can ignore this email.',
        ],
    ];
};