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
        'subject' => 'Your appointment is confirmed',
        'heading' => 'Appointment confirmed',
        'paragraphs' => ['Hello ' . $name . ', the clinic has confirmed your appointment.'],
        'details' => $detailsFor($d) + ['Status' => 'Confirmed'],
        'closing' => ['Please arrive about 10 minutes early. If you need to cancel or change the time, use your patient portal or contact the clinic.'],
    ];
};