<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\EmailOutboxRepository;
use App\Repositories\RealtimeOutboxRepository;
/**
 * Controller for internal-only application metrics.
 * Exposes Prometheus-compatible text format metrics on protected internal network.
 * Note: Never expose patient IDs, emails, clinical notes, or high-cardinality PII in labels.
 * Email metrics are derived from the outbox table at scrape time; labels are limited to the
 * bounded sets event_type, status and failure category.
 */
class MetricsController
{
    public function metrics(Request $request): Response
    {
        $lines = ["# ToothCare Hub Metrics (Internal Scrape Target)"];
        try {
            $repo = new EmailOutboxRepository();
            $stats = $repo->stats();
            $byType = $repo->countsByTypeAndStatus();
            $lines[] = '# HELP toothcare_email_jobs_total Email outbox jobs ever created, by event type.';
            $lines[] = '# TYPE toothcare_email_jobs_total counter';
            $totals = [];
            $sent = [];
            foreach ($byType as $r) {
                $totals[$r['event_type']] = ($totals[$r['event_type']] ?? 0) + $r['c'];
                if ($r['status'] === 'SENT') {
                    $sent[$r['event_type']] = $r['c'];
                }
            }
            foreach ($totals as $type => $c) {
                $lines[] = 'toothcare_email_jobs_total{event_type="' . $this->label($type) . '"} ' . $c;
            }
            $lines[] = '# HELP toothcare_email_delivery_success_total Emails delivered to the SMTP server, by event type.';
            $lines[] = '# TYPE toothcare_email_delivery_success_total counter';
            foreach ($sent as $type => $c) {
                $lines[] = 'toothcare_email_delivery_success_total{event_type="' . $this->label($type) . '"} ' . $c;
            }
            $lines[] = '# HELP toothcare_email_delivery_failure_total Failed email jobs, by event type and failure category.';
            $lines[] = '# TYPE toothcare_email_delivery_failure_total counter';
            foreach ($repo->failureBreakdown() as $r) {
                $lines[] = 'toothcare_email_delivery_failure_total{event_type="' . $this->label($r['event_type']) . '",category="' . $this->label($r['category']) . '"} ' . $r['c'];
            }
            $lines[] = '# HELP toothcare_email_retry_total Delivery retries performed (attempts beyond the first), by event type.';
            $lines[] = '# TYPE toothcare_email_retry_total counter';
            foreach ($repo->retryTotals() as $type => $c) {
                $lines[] = 'toothcare_email_retry_total{event_type="' . $this->label($type) . '"} ' . $c;
            }
            $lines[] = '# HELP toothcare_email_jobs_pending Jobs waiting for delivery (pending or awaiting retry).';
            $lines[] = '# TYPE toothcare_email_jobs_pending gauge';
            $lines[] = 'toothcare_email_jobs_pending ' . ($stats['counts']['PENDING'] + $stats['counts']['FAILED_RETRYABLE']);
            $lines[] = '# HELP toothcare_email_jobs_exhausted Jobs that used all attempts and failed permanently.';
            $lines[] = '# TYPE toothcare_email_jobs_exhausted gauge';
            $lines[] = 'toothcare_email_jobs_exhausted ' . $stats['exhausted'];
            $lines[] = '# HELP toothcare_email_worker_processing Jobs currently claimed by a worker.';
            $lines[] = '# TYPE toothcare_email_worker_processing gauge';
            $lines[] = 'toothcare_email_worker_processing ' . $stats['counts']['PROCESSING'];
            if ($stats['last_sent_at'] !== null) {
                $lines[] = '# HELP toothcare_email_last_success_timestamp_seconds Unix time of the last successful delivery.';
                $lines[] = '# TYPE toothcare_email_last_success_timestamp_seconds gauge';
                $lines[] = 'toothcare_email_last_success_timestamp_seconds ' . (strtotime($stats['last_sent_at']) ?: 0);
            }
        } catch (\Throwable) {
            $lines[] = '# email metrics unavailable';
        }

        try {
            $rtRepo = new RealtimeOutboxRepository();
            $rtStats = $rtRepo->stats();
            $lines[] = '# HELP toothcare_realtime_outbox_pending Realtime outbox events waiting for delivery (pending or retryable).';
            $lines[] = '# TYPE toothcare_realtime_outbox_pending gauge';
            $lines[] = 'toothcare_realtime_outbox_pending ' . ($rtStats['pending'] + $rtStats['failed_retryable']);
            $lines[] = '# HELP toothcare_realtime_outbox_processing Realtime outbox events currently claimed by a worker.';
            $lines[] = '# TYPE toothcare_realtime_outbox_processing gauge';
            $lines[] = 'toothcare_realtime_outbox_processing ' . $rtStats['processing'];
            $lines[] = '# HELP toothcare_realtime_outbox_published_total Realtime outbox events successfully published to Socket.IO.';
            $lines[] = '# TYPE toothcare_realtime_outbox_published_total counter';
            $lines[] = 'toothcare_realtime_outbox_published_total ' . $rtStats['published'];
            $lines[] = '# HELP toothcare_realtime_outbox_failed_total Realtime outbox events that exhausted all retry attempts.';
            $lines[] = '# TYPE toothcare_realtime_outbox_failed_total counter';
            $lines[] = 'toothcare_realtime_outbox_failed_total ' . $rtStats['failed_permanent'];
            $lines[] = '# HELP toothcare_realtime_outbox_retries_total Realtime outbox delivery retries performed.';
            $lines[] = '# TYPE toothcare_realtime_outbox_retries_total counter';
            $lines[] = 'toothcare_realtime_outbox_retries_total ' . $rtStats['retries'];
        } catch (\Throwable) {
            $lines[] = '# realtime outbox metrics unavailable';
        }

        return Response::plainText(implode("\n", $lines) . "\n");
    }
    private function label(string $v): string
    {
        return preg_replace('/[^A-Za-z0-9_]/', '_', $v) ?? 'unknown';
    }
}