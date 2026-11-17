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
    $by = (string) ($d['cancelled_by'] ?? '');
    $who = $by === 'patient' ? 'at your request' : ($by === 'clinic' ? 'by the clinic' : '');
    return [
        'subject' => 'Your appointment has been cancelled',
        'heading' => 'Appointment cancelled',
        'paragraphs' => ['Hello ' . $name . ', your appointment has been cancelled' . ($who !== '' ? ' ' . $who : '') . '.'],
        'details' => $detailsFor($d) + ['Status' => 'Cancelled'],
        'closing' => ['To book a new appointment, sign in to your patient portal or contact the clinic.'],
    ];
};