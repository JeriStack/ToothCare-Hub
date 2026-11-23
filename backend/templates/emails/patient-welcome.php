<?php
declare(strict_types=1);

return static function (array $d, array $c): array {
    $name = trim((string) ($d['name'] ?? ''));
    if ($name === '') {
        $name = 'Valued Patient';
    }
    $clinicName = (string) ($c['name'] ?? 'ToothCare Hub');
    $baseUrl = rtrim((string) ($d['app_url'] ?? 'http://localhost'), '/');

    return [
        'subject' => 'Welcome to ' . $clinicName . ' — We\'re Glad You\'re Here!',
        'heading' => 'Hello, ' . $name . '!',
        'paragraphs' => [
            'Welcome to ' . $clinicName . '!',
            'Your account has been successfully verified and is ready for use.',
            'With your account, you can:',
        ],
        'bullets' => [
            'Explore available dental services.',
            'View dentist information and availability.',
            'Request dental appointments.',
            'Monitor your appointment status.',
            'Receive important appointment notifications.',
        ],
        'cta' => [
            'label' => 'Sign In to Your Account',
            'url' => $baseUrl . '/login',
        ],
        'closing' => [
            'Thank you for choosing ' . $clinicName . '. We look forward to helping you manage your dental appointments.',
            'The ' . $clinicName . ' Team',
        ],
    ];
};
