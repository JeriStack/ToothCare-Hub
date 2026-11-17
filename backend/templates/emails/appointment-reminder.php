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
        'subject' => 'Reminder: your upcoming dental appointment',
        'heading' => 'Upcoming appointment reminder',
        'paragraphs' => ['Hello ' . $name . ', this is a reminder about your upcoming appointment.'],
        'details' => $detailsFor($d),
        'closing' => ['Please arrive about 10 minutes early. If you cannot attend, please cancel or contact the clinic as soon as possible.'],
    ];
};