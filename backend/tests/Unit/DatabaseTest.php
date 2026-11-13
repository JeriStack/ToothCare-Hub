<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Config;
use App\Core\Database;
use App\Core\HttpException;
use PHPUnit\Framework\TestCase;

class DatabaseTest extends TestCase
{
    public function testConnectionFailureThrowsSafe503Exception(): void
    {
        $config = new Config();
        // Point to an unreachable port to simulate connection failure
        $config->set('db_host', '127.0.0.1');
        $config->set('db_port', 59999);
        $config->set('db_database', 'unreachable_db');
        $config->set('db_username', 'test_user');
        $config->set('db_password', 'SUPER_SECRET_PASSWORD_123');

        $db = new Database($config);

        $this->expectException(HttpException::class);
        $this->expectExceptionCode(503);

        try {
            $db->getConnection();
        } catch (HttpException $e) {
            // Verify no secret leak in exception message
            $this->assertStringNotContainsString('SUPER_SECRET_PASSWORD_123', $e->getMessage());
            $this->assertStringNotContainsString('unreachable_db', $e->getMessage());
            $this->assertSame('SERVICE_UNAVAILABLE', $e->getErrorCode());
            throw $e;
        }
    }

    public function testPingReturnsFalseWhenDatabaseIsDown(): void
    {
        $config = new Config();
        $config->set('db_host', '127.0.0.1');
        $config->set('db_port', 59999);

        $db = new Database($config);
        $this->assertFalse($db->ping());
    }
}

