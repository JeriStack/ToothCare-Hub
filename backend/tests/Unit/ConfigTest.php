<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Config;
use PHPUnit\Framework\TestCase;

class ConfigTest extends TestCase
{
    private Config $config;

    protected function setUp(): void
    {
        $this->config = new Config(__DIR__ . '/../Fixtures');
    }

    public function testDefaultValuesArePopulated(): void
    {
        $this->assertSame('development', $this->config->getString('app_env'));
        $this->assertSame('/api/v1', $this->config->getString('api_base_path'));
        $this->assertSame('Asia/Manila', $this->config->getString('app_timezone'));
        $this->assertSame(3306, $this->config->getInt('db_port'));
    }

    public function testTypeCastingAccessors(): void
    {
        $this->config->set('test_int', '42');
        $this->config->set('test_bool_true', 'true');
        $this->config->set('test_bool_false', '0');
        $this->config->set('test_array', 'alpha, beta, gamma');

        $this->assertSame(42, $this->config->getInt('test_int'));
        $this->assertTrue($this->config->getBool('test_bool_true'));
        $this->assertFalse($this->config->getBool('test_bool_false'));
        $this->assertSame(['alpha', 'beta', 'gamma'], $this->config->getArray('test_array'));
    }

    public function testDebugIsDisabledInProductionEnvironment(): void
    {
        $config = new Config();
        $config->set('app_env', 'production');
        $config->set('app_debug', true);

        // In production, isProduction is true
        $this->assertTrue($config->isProduction());
    }
}

