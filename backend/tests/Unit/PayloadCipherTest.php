<?php
declare(strict_types=1);
namespace Tests\Unit;
use App\Services\Email\OutboxJobException;
use App\Services\Email\PayloadCipher;
use PHPUnit\Framework\TestCase;
class PayloadCipherTest extends TestCase
{
    public function testRoundTripAndNoPlaintextInSealedValue(): void
    {
        $c = new PayloadCipher('unit-test-key');
        $sealed = $c->seal('{"token":"abc123secret"}');
        $this->assertStringNotContainsString('abc123secret', $sealed);
        $this->assertSame('{"token":"abc123secret"}', $c->open($sealed));
        $this->assertNotSame($sealed, $c->seal('{"token":"abc123secret"}'), 'random IV per seal');
    }
    public function testTamperedOrWrongKeyIsRejected(): void
    {
        $sealed = (new PayloadCipher('key-a'))->seal('secret');
        $this->expectException(OutboxJobException::class);
        (new PayloadCipher('key-b'))->open($sealed);
    }
    public function testMalformedValueIsRejected(): void
    {
        $this->expectException(OutboxJobException::class);
        (new PayloadCipher('k'))->open('v1:' . base64_encode('short'));
    }
    public function testProductionRequiresExplicitKey(): void
    {
        $this->expectException(\RuntimeException::class);
        new PayloadCipher('', true);
    }
}