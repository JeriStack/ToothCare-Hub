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
    $paragraphs = ['Hello ' . $name . ', we are sorry, but the clinic could not accept your appointment request.'];
    $reason = trim((string) ($d['reason'] ?? ''));
    if ($reason !== '') {
        $paragraphs[] = 'Note from the clinic: ' . mb_substr($reason, 0, 300);
    }
    return [
        'subject' => 'Your appointment request could not be accepted',
        'heading' => 'Appointment request declined',
        'paragraphs' => $paragraphs,
        'details' => $detailsFor($d) + ['Status' => 'Declined'],
        'closing' => ['You are welcome to choose another date and time in your patient portal.'],
    ];
};