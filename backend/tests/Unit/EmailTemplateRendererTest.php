<?php
declare(strict_types=1);
namespace Tests\Unit;
use App\Services\Email\EmailTemplateRenderer;
use App\Services\Email\OutboxJobException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
class EmailTemplateRendererTest extends TestCase
{
    private EmailTemplateRenderer $r;
    private array $clinic = ['name' => 'ToothCare Hub', 'phone' => '+63 900 000 0000', 'email' => 'clinic@example.test', 'address' => '1 Test St'];
    protected function setUp(): void
    {
        $this->r = new EmailTemplateRenderer(EmailTemplateRenderer::defaultTemplateDir(), 'https://app.example.test');
    }
    private function appt(array $o = []): array
    {
        return $o + ['name' => 'Ana Cruz', 'reference' => 'TC-000042', 'service' => 'Cleaning', 'dentist' => 'Dr. Reyes', 'start_display' => 'Friday, November 20, 2026 at 10:00 AM'];
    }
    #[DataProvider('appointmentTemplates')]
    public function testAppointmentTemplatesRenderHtmlAndText(string $key): void
    {
        $out = $this->r->render($key, $this->appt(), $this->clinic);
        $this->assertNotSame('', $out['subject']);
        $this->assertStringContainsString('TC-000042', $out['html']);
        $this->assertStringContainsString('TC-000042', $out['text']);
        $this->assertStringContainsString('ToothCare Hub', $out['html']);
        $this->assertStringContainsString('clinic@example.test', $out['text']);
        $this->assertStringNotContainsString('<', $out['text']);
        $this->assertStringStartsWith('<!DOCTYPE html>', $out['html']);
    }
    public static function appointmentTemplates(): array
    {
        return [['appointment-requested'], ['appointment-confirmed'], ['appointment-rejected'], ['appointment-cancelled'], ['appointment-reminder'], ['appointment-completed']];
    }
    public function testDynamicValuesAreEscaped(): void
    {
        $out = $this->r->render('appointment-confirmed', $this->appt(['name' => '<script>alert(1)</script>', 'service' => 'A & B "x"']), $this->clinic);
        $this->assertStringNotContainsString('<script>', $out['html']);
        $this->assertStringContainsString('&lt;script&gt;', $out['html']);
        $this->assertStringContainsString('A &amp; B &quot;x&quot;', $out['html']);
    }
    public function testRejectionReasonIsEscapedAndTruncated(): void
    {
        $out = $this->r->render('appointment-rejected', $this->appt(['reason' => '<b>' . str_repeat('Q', 500) . '</b>']), $this->clinic);
        $this->assertStringNotContainsString('<b>', $out['html']);
        $this->assertSame(297, substr_count($out['text'], 'Q'), 'reason is cut at 300 characters including the 3-character <b> prefix');
    }
    public function testVerificationTemplateBuildsLinkFromSealedToken(): void
    {
        $out = $this->r->render('verify-email', ['name' => 'Ana', 'ttl_hours' => 24, 'secure' => ['token' => 'tok_abc123']], $this->clinic);
        $this->assertSame('Verify Your ToothCare Hub Email Address', $out['subject']);
        $this->assertStringContainsString('https://app.example.test/verify-email?token=tok_abc123', $out['html']);
        $this->assertStringContainsString('https://app.example.test/verify-email?token=tok_abc123', $out['text']);
        $this->assertStringContainsString('24 hours', $out['text']);
        $this->assertStringContainsString('Resend Verification Email', $out['text']);
        $this->assertStringNotContainsString('tok_abc123', $out['subject']);
    }

    public function testRegistrationReceivedTemplateRendersHtmlAndTextWithEscapingAndNextStep(): void
    {
        $out = $this->r->render('patient-registration-received', [
            'name' => 'Maria <script>alert(1)</script> Santos',
            'verification_required' => true,
            'ttl_hours' => 12,
        ], $this->clinic);

        $this->assertSame('Thank You for Registering with ToothCare Hub!', $out['subject']);
        $this->assertStringStartsWith('<!DOCTYPE html>', $out['html']);
        $this->assertStringNotContainsString('<script>', $out['html']);
        $this->assertStringContainsString('&lt;script&gt;', $out['html']);
        $this->assertStringContainsString('Your registration has been successfully received.', $out['html']);
        $this->assertStringContainsString('12 hours', $out['text']);
        $this->assertStringContainsString('unverified until you complete email verification', $out['text']);
        $this->assertStringNotContainsString('<p>', $out['text']);
    }

    public function testPatientWelcomeTemplateRendersBulletedCapabilitiesAndSignInLink(): void
    {
        $out = $this->r->render('patient-welcome', [
            'name' => 'Juan Dela Cruz',
            'diagnosis' => 'never show clinical info',
            'password' => 'never show password',
        ], $this->clinic);

        $this->assertSame("Welcome to ToothCare Hub — We're Glad You're Here!", $out['subject']);
        $this->assertStringContainsString('Hello, Juan Dela Cruz!', $out['html']);
        $this->assertStringContainsString('Your account has been successfully verified and is ready for use.', $out['text']);
        $this->assertStringContainsString('<ul ', $out['html']);
        $this->assertStringContainsString('- Explore available dental services.', $out['text']);
        $this->assertStringContainsString('https://app.example.test/login', $out['html']);
        $this->assertStringContainsString('https://app.example.test/login', $out['text']);
        $this->assertStringNotContainsString('never show clinical info', $out['html'] . $out['text']);
        $this->assertStringNotContainsString('never show password', $out['html'] . $out['text']);
    }
    public function testPasswordResetTemplate(): void
    {
        $out = $this->r->render('password-reset', ['name' => 'Ana', 'ttl_minutes' => 30, 'secure' => ['token' => 'rst_1']], $this->clinic);
        $this->assertStringContainsString('/reset-password?token=rst_1', $out['html']);
        $this->assertStringContainsString('30 minutes', $out['text']);
    }
    public function testMissingTokenIsAPermanentTemplateDataError(): void
    {
        try {
            $this->r->render('verify-email', ['name' => 'Ana'], $this->clinic);
            $this->fail('expected exception');
        } catch (OutboxJobException $e) {
            $this->assertSame('TEMPLATE_DATA_INVALID', $e->errorCode);
        }
    }
    public function testUnknownTemplateIsRejected(): void
    {
        $this->expectException(OutboxJobException::class);
        $this->r->render('does-not-exist', [], $this->clinic);
    }
    public function testPathTraversalTemplateKeyIsRejected(): void
    {
        $this->assertFalse($this->r->has('../../config/app'));
    }
    public function testSubjectIsSingleLine(): void
    {
        $out = $this->r->render('appointment-confirmed', $this->appt(), $this->clinic);
        $this->assertStringNotContainsString("\n", $out['subject']);
    }
    public function testClinicalFieldsAreNeverRendered(): void
    {
        $out = $this->r->render('appointment-confirmed', $this->appt(['diagnosis' => 'caries on 14', 'chief_complaint' => 'tooth pain', 'notes' => 'secret note']), $this->clinic);
        foreach (['caries', 'tooth pain', 'secret note'] as $needle) {
            $this->assertStringNotContainsString($needle, $out['html'] . $out['text']);
        }
    }
}