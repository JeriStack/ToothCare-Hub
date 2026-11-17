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
        'subject' => 'Thank you for visiting ToothCare Hub',
        'heading' => 'Visit completed',
        'paragraphs' => ['Hello ' . $name . ', your visit has been marked as completed. Thank you for choosing ' . $c['name'] . '.'],
        'details' => $detailsFor($d),
        'closing' => ['You can review your visit history in your patient portal.'],
    ];
};