import { loadEnvironment } from './config/environment';
import { createRealtimeService } from './services/socket.service';
import { StructuredLogger } from './utils/logger';

async function main(): Promise<void> {
  const env = loadEnvironment(process.env);
  const logger = new StructuredLogger(env.logLevel);
  const service = createRealtimeService(env);

  await service.start();

  let shuttingDown = false;
  const handleShutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info('Received termination signal; shutting down gracefully', { signal });

    const forceTimer = setTimeout(() => {
      logger.error('Forced realtime service shutdown after timeout');
      process.exit(1);
    }, 5000);
    forceTimer.unref();

    await service.close();
    clearTimeout(forceTimer);
    logger.info('Realtime service closed cleanly');
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void handleShutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void handleShutdown('SIGINT');
  });
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'Startup failure';
  process.stderr.write(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'toothcare-realtime',
      level: 'error',
      message: 'Failed to start realtime service',
      error: message,
    }) + '\n'
  );
  process.exit(1);
});
