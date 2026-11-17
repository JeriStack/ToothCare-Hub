<?php
declare(strict_types=1);

$detailsFor = static function (array $d): array {
    $out = [];
    if (!empty($d['reference'])) { $out['Reference'] = (string) $d['reference']; }
    if (!empty($d['service'])) { $out['Service'] = (string) $d['service']; }
    if (!empty($d['dentist'])) { $out['Dentist'] = (string) $d['dentist']; }
    if (!empty($d['start_display'])) { $out['Date and time'] = (string) $d['start_display']; }
    return $out;
};
return static function (array $d, array $c) use ($detailsFor): array {
    $name = (string) ($d['name'] ?? 'there');
    return [
        'subject' => 'We received your appointment request',
        'heading' => 'Appointment request received',
        'paragraphs' => [
            'Hello ' . $name . ', your appointment request has been received and is waiting for review by the clinic.',
        ],
        'details' => $detailsFor($d) + ['Status' => 'Pending review'],
        'closing' => ['We will email you once the clinic confirms your appointment.'],
    ];
};