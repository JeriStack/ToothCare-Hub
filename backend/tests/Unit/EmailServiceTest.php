<?php
declare(strict_types=1);
namespace Tests\Unit;
use App\Services\Email\DeliveryResult;
use App\Services\Email\EmailMessage;
use App\Services\Email\EmailRetryPolicy;
use App\Services\Email\EmailService;
use App\Services\Email\MailConfig;
use PHPUnit\Framework\TestCase;
use Tests\Support\FakeMailTransport;
class EmailServiceTest extends TestCase
{
    private function service(FakeMailTransport $t, bool $enabled = true): EmailService
    {
        $c = MailConfig::fromArray(['MAIL_ENABLED' => $enabled ? 'true' : 'false', 'MAIL_HOST' => 'smtp.test', 'MAIL_FROM_ADDRESS' => 'a@b.test', 'MAIL_PORT' => '25']);
        return new EmailService($t, $c, new EmailRetryPolicy());
    }
    private function msg(string $to = 'patient@example.com', string $subject = 'Hello'): EmailMessage
    {
        return new EmailMessage($to, 'Patient', $subject, '<p>x</p>', 'x');
    }
    public function testSuccessfulSend(): void
    {
        $t = new FakeMailTransport();
        $r = $this->service($t)->send($this->msg());
        $this->assertTrue($r->success);
        $this->assertCount(1, $t->sent);
    }
    public function testInvalidRecipientIsPermanentAndNeverReachesTransport(): void
    {
        $t = new FakeMailTransport();
        $r = $this->service($t)->send($this->msg('not-an-email'));
        $this->assertFalse($r->success);
        $this->assertSame(DeliveryResult::CATEGORY_PERMANENT, $r->category);
        $this->assertSame('INVALID_RECIPIENT', $r->errorCode);
        $this->assertSame(0, $t->calls);
    }
    public function testHeaderInjectionIsRejected(): void
    {
        $t = new FakeMailTransport();
        $r = $this->service($t)->send($this->msg('a@b.test', "Hi\r\nBcc: evil@example.com"));
        $this->assertSame('INVALID_HEADER', $r->errorCode);
        $this->assertSame(0, $t->calls);
        $r2 = $this->service($t)->send($this->msg("a@b.test\r\nBcc: x@y.test"));
        $this->assertSame('INVALID_RECIPIENT', $r2->errorCode);
    }
    public function testTransportFailuresAreClassifiedAndSanitized(): void
    {
        $t = new FakeMailTransport();
        $t->failNext(FakeMailTransport::timeout(), FakeMailTransport::badRecipient(), new \RuntimeException('secret-host.internal password=hunter2'));
        $s = $this->service($t);
        $a = $s->send($this->msg());
        $this->assertSame([DeliveryResult::CATEGORY_TEMPORARY, 'SMTP_TIMEOUT'], [$a->category, $a->errorCode]);
        $b = $s->send($this->msg());
        $this->assertSame([DeliveryResult::CATEGORY_PERMANENT, 'INVALID_RECIPIENT'], [$b->category, $b->errorCode]);
        $c = $s->send($this->msg());
        $this->assertSame(DeliveryResult::CATEGORY_UNKNOWN, $c->category);
        $this->assertStringNotContainsString('hunter2', $c->message);
        $this->assertStringNotContainsString('secret-host', $c->message);
    }
    public function testDisabledMailIsReportedNotThrown(): void
    {
        $t = new FakeMailTransport();
        $r = $this->service($t, false)->send($this->msg());
        $this->assertFalse($r->success);
        $this->assertSame('MAIL_NOT_OPERATIONAL', $r->errorCode);
        $this->assertSame(0, $t->calls);
    }
}