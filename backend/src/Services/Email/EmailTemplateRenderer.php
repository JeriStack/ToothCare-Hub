<?php
declare(strict_types=1);
namespace App\Services\Email;
/**
 * Renders approved templates into subject, HTML and plain-text bodies.
 *
 * Each template file in templates/emails/<key>.php returns a callable receiving
 * (array $data, array $clinic) and returning a spec:
 *   subject, heading, paragraphs[], details[label => value], cta{label,url}|null, closing[]
 * All dynamic values are HTML-escaped here; templates never emit raw HTML.
 */
final class EmailTemplateRenderer
{
    public const TEMPLATES = [
        'patient-registration-received', 'verify-email', 'patient-welcome', 'password-reset',
        'appointment-requested', 'appointment-confirmed', 'appointment-rejected',
        'appointment-cancelled', 'appointment-reminder', 'appointment-completed',
    ];
    public function __construct(
        private readonly string $templateDir,
        private readonly string $appUrl = 'http://localhost'
    ) {
    }
    public static function defaultTemplateDir(): string
    {
        return dirname(__DIR__, 3) . '/templates/emails';
    }
    public function has(string $key): bool
    {
        return in_array($key, self::TEMPLATES, true) && is_file($this->path($key));
    }
    /**
     * @param array<string, mixed> $data
     * @param array<string, string> $clinic name, phone, email, address
     * @return array{subject: string, html: string, text: string}
     */
    public function render(string $key, array $data, array $clinic = []): array
    {
        if (!$this->has($key)) {
            throw new OutboxJobException('TEMPLATE_NOT_FOUND', 'Email template is not available.');
        }
        $factory = require $this->path($key);
        if (!is_callable($factory)) {
            throw new OutboxJobException('TEMPLATE_INVALID', 'Email template is not callable.');
        }
        $clinic = $clinic + ['name' => 'ToothCare Hub', 'phone' => '', 'email' => '', 'address' => ''];
        $data['app_url'] = $this->appUrl;
        try {
            $spec = $factory($data, $clinic);
        } catch (\Throwable $e) {
            throw new OutboxJobException('TEMPLATE_DATA_INVALID', 'Template data is missing or invalid.');
        }
        $subject = $this->singleLine((string) ($spec['subject'] ?? ''));
        if ($subject === '') {
            throw new OutboxJobException('TEMPLATE_INVALID', 'Template produced no subject.');
        }
        return [
            'subject' => $subject,
            'html' => $this->html($spec, $clinic),
            'text' => $this->text($spec, $clinic),
        ];
    }
    /** @param array<string, mixed> $spec @param array<string, string> $clinic */
    private function html(array $spec, array $clinic): string
    {
        $h = static fn(string $v): string => htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $out = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>' . $h((string) $spec['subject']) . '</title></head>'
            . '<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;"><tr><td align="center">'
            . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">'
            . '<tr><td style="background:#0d9488;color:#ffffff;padding:20px 28px;font-size:20px;font-weight:bold;">' . $h($clinic['name']) . '</td></tr>'
            . '<tr><td style="padding:28px;">'
            . '<h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">' . $h((string) ($spec['heading'] ?? $spec['subject'])) . '</h1>';
        foreach ((array) ($spec['paragraphs'] ?? []) as $p) {
            $out .= '<p style="margin:0 0 14px;line-height:1.5;font-size:15px;">' . $h((string) $p) . '</p>';
        }
        $bullets = (array) ($spec['bullets'] ?? []);
        if ($bullets !== []) {
            $out .= '<ul style="margin:0 0 16px;padding-left:20px;line-height:1.6;font-size:15px;color:#0f172a;">';
            foreach ($bullets as $item) {
                $out .= '<li style="margin:0 0 6px;">' . $h((string) $item) . '</li>';
            }
            $out .= '</ul>';
        }
        $details = (array) ($spec['details'] ?? []);
        if ($details !== []) {
            $out .= '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;width:100%;border:1px solid #e2e8f0;border-radius:6px;">';
            foreach ($details as $label => $value) {
                $out .= '<tr><td style="padding:8px 12px;font-size:14px;color:#475569;width:38%;">' . $h((string) $label)
                    . '</td><td style="padding:8px 12px;font-size:14px;font-weight:bold;">' . $h((string) $value) . '</td></tr>';
            }
            $out .= '</table>';
        }
        $cta = $spec['cta'] ?? null;
        if (is_array($cta) && !empty($cta['url']) && !empty($cta['label'])) {
            $url = (string) $cta['url'];
            $out .= '<p style="margin:0 0 18px;"><a href="' . $h($url) . '" style="background:#0d9488;color:#ffffff;padding:11px 22px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">'
                . $h((string) $cta['label']) . '</a></p>'
                . '<p style="margin:0 0 14px;font-size:13px;color:#475569;">If the button does not work, copy this address into your browser:<br>' . $h($url) . '</p>';
        }
        foreach ((array) ($spec['closing'] ?? []) as $p) {
            $out .= '<p style="margin:0 0 14px;line-height:1.5;font-size:15px;">' . $h((string) $p) . '</p>';
        }
        $out .= '</td></tr><tr><td style="background:#f8fafc;padding:18px 28px;font-size:12px;color:#64748b;line-height:1.5;border-top:1px solid #e2e8f0;">'
            . '<strong>' . $h($clinic['name']) . '</strong>';
        foreach (['address', 'phone', 'email'] as $field) {
            if (($clinic[$field] ?? '') !== '') {
                $out .= '<br>' . $h($clinic[$field]);
            }
        }
        $out .= '<br><br>This is an automated message. Please do not include medical details in replies.'
            . '</td></tr></table></td></tr></table></body></html>';
        return $out;
    }
    /** @param array<string, mixed> $spec @param array<string, string> $clinic */
    private function text(array $spec, array $clinic): string
    {
        $lines = [(string) ($spec['heading'] ?? $spec['subject']), ''];
        foreach ((array) ($spec['paragraphs'] ?? []) as $p) {
            $lines[] = (string) $p;
            $lines[] = '';
        }
        $bullets = (array) ($spec['bullets'] ?? []);
        if ($bullets !== []) {
            foreach ($bullets as $item) {
                $lines[] = '- ' . (string) $item;
            }
            $lines[] = '';
        }
        foreach ((array) ($spec['details'] ?? []) as $label => $value) {
            $lines[] = $label . ': ' . $value;
        }
        if (!empty($spec['details'])) {
            $lines[] = '';
        }
        $cta = $spec['cta'] ?? null;
        if (is_array($cta) && !empty($cta['url'])) {
            $lines[] = ($cta['label'] ?? 'Open link') . ': ' . $cta['url'];
            $lines[] = '';
        }
        foreach ((array) ($spec['closing'] ?? []) as $p) {
            $lines[] = (string) $p;
            $lines[] = '';
        }
        $lines[] = '--';
        $lines[] = $clinic['name'];
        foreach (['address', 'phone', 'email'] as $field) {
            if (($clinic[$field] ?? '') !== '') {
                $lines[] = $clinic[$field];
            }
        }
        return implode("\n", $lines) . "\n";
    }
    private function singleLine(string $v): string
    {
        return trim(preg_replace('/[\r\n\0]+/', ' ', $v) ?? '');
    }
    private function path(string $key): string
    {
        return rtrim($this->templateDir, '/\\') . DIRECTORY_SEPARATOR . $key . '.php';
    }
}