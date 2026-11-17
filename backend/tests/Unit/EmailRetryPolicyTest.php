<?php
declare(strict_types=1);
namespace Tests\Unit;
use App\Services\Email\DeliveryResult;
use App\Services\Email\EmailRetryPolicy;
use App\Services\Email\MailTransportException as E;
use App\Services\Email\OutboxJobException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
class EmailRetryPolicyTest extends TestCase
{
    public function testDefaultBackoffWithoutJitterFollowsSchedule(): void
    {
        $p = new EmailRetryPolicy(EmailRetryPolicy::DEFAULT_DELAYS, 0.0);
        $this->assertSame([60, 300, 900, 3600, 21600], array_map(fn($a) => $p->delayAfterAttempt($a), [1, 2, 3, 4, 5]));
        $this->assertSame(21600, $p->delayAfterAttempt(9), 'last delay repeats');
    }
    public function testJitterStaysWithinBounds(): void
    {
        $p = new EmailRetryPolicy([1000], 0.1);
        $this->assertSame(900, $p->delayAfterAttempt(1, fn() => 0.0));
        $this->assertSame(1100, $p->delayAfterAttempt(1, fn() => 0.999999));
        $this->assertSame(1000, $p->delayAfterAttempt(1, fn() => 0.5));
        for ($i = 0; $i < 50; $i++) {
            $d = $p->delayAfterAttempt(1);
            $this->assertGreaterThanOrEqual(900, $d);
            $this->assertLessThanOrEqual(1100, $d);
        }
    }
    public function testExhaustion(): void
    {
        $p = new EmailRetryPolicy();
        $this->assertFalse($p->isExhausted(4, 5));
        $this->assertTrue($p->isExhausted(5, 5));
    }
    public function testCustomDelaysParsingAndFallback(): void
    {
        $this->assertSame(30, EmailRetryPolicy::fromString('30,60', 0.0)->delayAfterAttempt(1));
        $this->assertSame(60, EmailRetryPolicy::fromString('abc', 0.0)->delayAfterAttempt(1));
        $this->assertTrue(EmailRetryPolicy::isValidList('60, 300'));
        $this->assertFalse(EmailRetryPolicy::isValidList('60,,300'));
        $this->assertFalse(EmailRetryPolicy::isValidList('0'));
    }
    #[DataProvider('classificationCases')]
    public function testClassification(\Throwable $e, string $category, string $code): void
    {
        $r = (new EmailRetryPolicy())->classify($e);
        $this->assertSame($category, $r['category']);
        $this->assertSame($code, $r['code']);
    }
    public static function classificationCases(): array
    {
        return [
            'timeout' => [new E('x', E::REASON_TIMEOUT), DeliveryResult::CATEGORY_TEMPORARY, 'SMTP_TIMEOUT'],
            'connection refused' => [new E('x', E::REASON_CONNECTION), DeliveryResult::CATEGORY_TEMPORARY, 'SMTP_CONNECTION_FAILED'],
            'smtp 421' => [new E('x', E::REASON_PROTOCOL, 421), DeliveryResult::CATEGORY_TEMPORARY, 'SMTP_421'],
            'smtp 451' => [new E('x', E::REASON_PROTOCOL, 451), DeliveryResult::CATEGORY_TEMPORARY, 'SMTP_451'],
            'smtp 550 recipient' => [new E('x', E::REASON_RECIPIENT, 550), DeliveryResult::CATEGORY_PERMANENT, 'INVALID_RECIPIENT'],
            'smtp 554' => [new E('x', E::REASON_PROTOCOL, 554), DeliveryResult::CATEGORY_PERMANENT, 'SMTP_554'],
            'auth failure is retryable' => [new E('x', E::REASON_AUTH, 535), DeliveryResult::CATEGORY_TEMPORARY, 'SMTP_AUTH_FAILED'],
            'config' => [new E('x', E::REASON_CONFIG), DeliveryResult::CATEGORY_PERMANENT, 'MAIL_CONFIG_INVALID'],
            'unknown transport' => [new E('x', E::REASON_UNKNOWN), DeliveryResult::CATEGORY_UNKNOWN, 'SMTP_UNKNOWN'],
            'job error' => [new OutboxJobException('TEMPLATE_NOT_FOUND', 'x'), DeliveryResult::CATEGORY_PERMANENT, 'TEMPLATE_NOT_FOUND'],
            'unexpected' => [new \RuntimeException('boom'), DeliveryResult::CATEGORY_UNKNOWN, 'UNEXPECTED_ERROR'],
        ];
    }
}