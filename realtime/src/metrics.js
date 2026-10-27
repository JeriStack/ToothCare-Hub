/**
 * Prometheus metrics registry for the Node.js / Socket.IO service.
 * Exposes connection counters, active socket counts, and event processing histograms.
 * Internal Docker network only; no PII or patient identifiers in metric labels.
 */
export const registerMetrics = (app) => {
  // Configured in Phase 14 / Phase 19
};
