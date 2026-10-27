<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;

/**
 * Controller for internal-only application metrics.
 * Exposes Prometheus-compatible text format metrics on protected internal network.
 * Note: Never expose patient IDs, emails, clinical notes, or high-cardinality PII in labels.
 */
class MetricsController
{
    public function metrics(Request $request): Response
    {
        // Placeholder for prom-client / application counters and histograms
        return Response::plainText("# ToothCare Hub Metrics (Internal Scrape Target)\n");
    }
}
