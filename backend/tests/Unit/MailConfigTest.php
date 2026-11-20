<?php
declare(strict_types=1);
namespace Tests\Unit;
use App\Services\Email\MailConfig;
use PHPUnit\Framework\TestCase;
class MailConfigTest extends TestCase
{
    private function valid(array $o = []): array
    {
        return $o + [
            'MAIL_ENABLED' => 'true', 'MAIL_HOST' => 'smtp.example.test', 'MAIL_PORT' => '587',
            'MAIL_USERNAME' => 'user', 'MAIL_PASSWORD' => 'super-secret-pass', 'MAIL_ENCRYPTION' => 'tls',
            'MAIL_FROM_ADDRESS' => 'noreply@example.test', 'MAIL_FROM_NAME' => 'ToothCare Hub',
            'MAIL_TIMEOUT' => '15', 'MAIL_VERIFY_PEER' => 'true',
        ];
    }
    public function testValidConfigIsOperational(): void
    {
        $c = MailConfig::fromArray($this->valid());
        $this->assertTrue($c->isValid());
        $this->assertTrue($c->isOperational());
        $this->assertSame('tls', $c->encryption);
        $this->assertTrue($c->verifyPeer);
    }
    public function testDisabledConfigIsNotOperationalButNotAnError(): void
    {
        $c = MailConfig::fromArray(['MAIL_ENABLED' => 'false']);
        $this->assertTrue($c->isValid());
        $this->assertFalse($c->isOperational());
    }
    public function testMissingRequiredFieldsAreReported(): void
    {
        $c = MailConfig::fromArray(['MAIL_ENABLED' => 'true']);
        $this->assertFalse($c->isValid());
        $this->assertFalse($c->isOperational());
        $this->assertNotEmpty(array_filter($c->errors, fn($e) => str_contains($e, 'MAIL_HOST')));
        $this->assertNotEmpty(array_filter($c->errors, fn($e) => str_contains($e, 'MAIL_FROM_ADDRESS')));
    }
    public function testInvalidValuesAreRejected(): void
    {
        $this->assertFalse(MailConfig::fromArray($this->valid(['MAIL_PORT' => '70000']))->isValid());
        $this->assertFalse(MailConfig::fromArray($this->valid(['MAIL_ENCRYPTION' => 'starttls-ish']))->isValid());
        $this->assertFalse(MailConfig::fromArray($this->valid(['MAIL_FROM_ADDRESS' => 'not-an-email']))->isValid());
        $this->assertFalse(MailConfig::fromArray($this->valid(['MAIL_REPLY_TO_ADDRESS' => 'bad']))->isValid());
        $this->assertFalse(MailConfig::fromArray($this->valid(['MAIL_TIMEOUT' => '0']))->isValid());
    }
    public function testEmptyEncryptionMeansNone(): void
    {
        $this->assertSame('none', MailConfig::fromArray($this->valid(['MAIL_ENCRYPTION' => '']))->encryption);
    }
    public function testDisablingPeerVerificationIsRejectedInProduction(): void
    {
        $c = MailConfig::fromArray($this->valid(['MAIL_VERIFY_PEER' => 'false', 'APP_ENV' => 'production']));
        $this->assertFalse($c->isValid());
        $this->assertTrue(MailConfig::fromArray($this->valid(['MAIL_VERIFY_PEER' => 'false', 'APP_ENV' => 'development']))->isValid());
    }
    public function testLocalTestSinkRejectedInProduction(): void
    {
        $c1 = MailConfig::fromArray($this->valid(['MAIL_HOST' => 'mailpit', 'APP_ENV' => 'production']));
        $this->assertFalse($c1->isValid());
        $this->assertNotEmpty(array_filter($c1->errors, fn($e) => str_contains($e, 'cannot be used as MAIL_HOST in production')));

        $c2 = MailConfig::fromArray($this->valid(['MAIL_HOST' => 'localhost', 'APP_ENV' => 'production']));
        $this->assertFalse($c2->isValid());

        $dev = MailConfig::fromArray($this->valid(['MAIL_HOST' => 'mailpit', 'APP_ENV' => 'development']));
        $this->assertTrue($dev->isValid());
        $this->assertTrue($dev->isLocalSink());
        $this->assertTrue($dev->describe()['is_local_sink']);
    }
    public function testDescribeAndDebugOutputNeverExposeCredentials(): void
    {
        $c = MailConfig::fromArray($this->valid());
        $this->assertStringNotContainsString('super-secret-pass', json_encode($c->describe()));
        $this->assertStringNotContainsString('super-secret-pass', print_r($c, true));
        $this->assertStringNotContainsString('super-secret-pass', var_export($c->__debugInfo(), true));
        $this->assertSame('super-secret-pass', $c->password());
    }
}