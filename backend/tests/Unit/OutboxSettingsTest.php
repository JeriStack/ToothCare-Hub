<?php
declare(strict_types=1);
namespace Tests\Unit;
use App\Services\Email\OutboxSettings;
use PHPUnit\Framework\TestCase;
class OutboxSettingsTest extends TestCase
{
    public function testDefaultsAreValid(): void
    {
        $s = OutboxSettings::fromArray([]);
        $this->assertTrue($s->isValid());
        $this->assertSame(20, $s->batchSize);
        $this->assertSame(5, $s->maxAttempts);
        $this->assertSame(300, $s->lockTimeoutSeconds);
        $this->assertTrue($s->workerEnabled);
    }
    public function testOutOfRangeValuesAreReportedAndDefaultsKept(): void
    {
        $s = OutboxSettings::fromArray([
            'EMAIL_WORKER_BATCH_SIZE' => '100000', 'EMAIL_WORKER_MAX_ATTEMPTS' => '0',
            'EMAIL_WORKER_LOCK_TIMEOUT' => '5', 'EMAIL_WORKER_SLEEP_SECONDS' => 'abc',
            'EMAIL_RETRY_DELAYS' => '60,,x', 'EMAIL_RETRY_JITTER' => '0.9',
        ]);
        $this->assertFalse($s->isValid());
        $this->assertCount(6, $s->errors);
        $this->assertSame(20, $s->batchSize);
        $this->assertSame(5, $s->maxAttempts);
    }
    public function testValidOverrides(): void
    {
        $s = OutboxSettings::fromArray(['EMAIL_WORKER_BATCH_SIZE' => '50', 'EMAIL_WORKER_ENABLED' => 'false', 'EMAIL_RETRY_DELAYS' => '10,20']);
        $this->assertTrue($s->isValid());
        $this->assertSame(50, $s->batchSize);
        $this->assertFalse($s->workerEnabled);
    }
}