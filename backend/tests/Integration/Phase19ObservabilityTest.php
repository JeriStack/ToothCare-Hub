<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Core\Application;
use App\Core\Request;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Yaml\Yaml;
use Tests\Support\TestDb;

/**
 * Phase 19 — Observability, Metrics Contract, Privacy Hygiene & Monitoring Config Validation Suite.
 */
class Phase19ObservabilityTest extends TestCase
{
    private Application $app;

    protected function setUp(): void
    {
        $_SESSION = [];
        TestDb::create();
        $this->app = new Application(null, false);
    }

    public function testMetricsEndpointExposesRequiredEmailAndRealtimeMetricsWithoutPii(): void
    {
        $res = $this->app->handle(Request::create('GET', '/api/v1/metrics'));
        $this->assertSame(200, $res->getStatusCode());

        $body = $res->getBody();
        foreach ([
            'toothcare_email_jobs_pending',
            'toothcare_email_jobs_exhausted',
            'toothcare_email_worker_processing',
            'toothcare_email_oldest_pending_age_seconds',
            'toothcare_realtime_outbox_pending',
            'toothcare_realtime_outbox_published_total',
            'toothcare_realtime_outbox_failed_total',
        ] as $metric) {
            $this->assertStringContainsString($metric, $body, "Missing expected Prometheus metric: {$metric}");
        }

        // Strict privacy hygiene: metrics must never contain email addresses, patient IDs, or password markers
        $this->assertStringNotContainsString('@', $body);
        $this->assertStringNotContainsString('patient_id', $body);
        $this->assertStringNotContainsString('password', strtolower($body));
    }

    public function testPrometheusConfigAlertRulesAndGrafanaDashboardsAreValid(): void
    {
        $repoRoot = dirname(__DIR__, 3);

        // 1. Validate Prometheus scrape config
        $promRaw = file_get_contents($repoRoot . DIRECTORY_SEPARATOR . 'monitoring' . DIRECTORY_SEPARATOR . 'prometheus' . DIRECTORY_SEPARATOR . 'prometheus.yml');
        $this->assertNotFalse($promRaw);
        $promYaml = Yaml::parse($promRaw);
        $this->assertIsArray($promYaml);
        $this->assertContains('rules/toothcare-alerts.yml', $promYaml['rule_files'] ?? []);
        $jobs = array_column($promYaml['scrape_configs'] ?? [], 'job_name');
        foreach (['prometheus', 'toothcare-api', 'toothcare-realtime', 'nginx-exporter', 'mysqld-exporter', 'cadvisor'] as $job) {
            $this->assertContains($job, $jobs, "Missing Prometheus scrape job: {$job}");
        }

        // 2. Validate Prometheus alert rules
        $rulesRaw = file_get_contents($repoRoot . DIRECTORY_SEPARATOR . 'monitoring' . DIRECTORY_SEPARATOR . 'prometheus' . DIRECTORY_SEPARATOR . 'rules' . DIRECTORY_SEPARATOR . 'toothcare-alerts.yml');
        $this->assertNotFalse($rulesRaw);
        $rulesYaml = Yaml::parse($rulesRaw);
        $this->assertIsArray($rulesYaml['groups'] ?? null);
        $alertNames = [];
        foreach ($rulesYaml['groups'] as $group) {
            foreach ($group['rules'] ?? [] as $rule) {
                $this->assertNotEmpty($rule['alert'] ?? '');
                $this->assertNotEmpty($rule['expr'] ?? '');
                $this->assertNotEmpty($rule['for'] ?? '');
                $alertNames[] = $rule['alert'];
            }
        }
        foreach (['TargetDown', 'MysqlDown', 'NginxDown', 'EmailOldestPendingTooOld', 'EmailJobsExhausted', 'RealtimeServiceUnavailable'] as $expectedAlert) {
            $this->assertContains($expectedAlert, $alertNames, "Missing expected alert rule: {$expectedAlert}");
        }

        // 3. Validate Grafana datasource provisioning uid matches dashboards
        $dsRaw = file_get_contents($repoRoot . DIRECTORY_SEPARATOR . 'monitoring' . DIRECTORY_SEPARATOR . 'grafana' . DIRECTORY_SEPARATOR . 'provisioning' . DIRECTORY_SEPARATOR . 'datasources' . DIRECTORY_SEPARATOR . 'prometheus.yml');
        $this->assertNotFalse($dsRaw);
        $dsYaml = Yaml::parse($dsRaw);
        $this->assertSame('prometheus', $dsYaml['datasources'][0]['uid'] ?? null);

        // 4. Validate Grafana dashboards JSON & datasource bindings
        foreach ([
            '/monitoring/grafana/dashboards/toothcare-overview.json',
            '/monitoring/grafana/dashboards/infrastructure.json',
        ] as $relPath) {
            $raw = file_get_contents($repoRoot . $relPath);
            $this->assertNotFalse($raw);
            $dash = json_decode($raw, true);
            $this->assertIsArray($dash, "Invalid JSON in {$relPath}");
            $this->assertNotEmpty($dash['uid'] ?? '');
            $this->assertGreaterThanOrEqual(6, count($dash['panels'] ?? []));
            foreach ($dash['panels'] as $panel) {
                $this->assertSame('prometheus', $panel['datasource']['uid'] ?? null);
            }
        }
    }
}
