import http, { IncomingMessage, ServerResponse } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { RealtimeEnvironment } from '../config/environment';
import { buildSocketServerOptions } from '../config/socket.config';
import { PublisherAuth } from '../publisher/publisher-auth';
import { PhpTicketValidator, TicketValidator } from '../auth/ticket-validator';
import { PhpSessionValidator, SessionValidator } from '../auth/session-validator';
import { ConnectionAuthenticator } from '../auth/connection-auth';
import { createAuthenticationMiddleware } from '../middleware/authentication.middleware';
import { attachAuthorizationGuard } from '../middleware/authorization.middleware';
import { RoomManager } from '../rooms/room-manager';
import { ConnectionRegistry } from './connection-registry';
import { RealtimeEventHandler } from '../events/event-handler';
import { InternalPublisherHandler } from '../publisher/internal-publisher';
import { RealtimeMetrics } from '../monitoring/metrics';
import { StructuredLogger } from '../utils/logger';
import { VerifiedUserIdentity } from '../events/event-types';

export interface RealtimeServiceDependencies {
  ticketValidator?: TicketValidator;
  sessionValidator?: SessionValidator;
}

export interface RealtimeServiceInstance {
  httpServer: http.Server;
  io: SocketIOServer;
  registry: ConnectionRegistry;
  metrics: RealtimeMetrics;
  publisherAuth: PublisherAuth;
  start: () => Promise<{ port: number }>;
  close: () => Promise<void>;
}

/**
 * Creates a self-contained ToothCare Hub Socket.IO real-time service instance.
 * Supports dependency injection for deterministic automated integration and security tests.
 */
export function createRealtimeService(
  env: RealtimeEnvironment,
  deps: RealtimeServiceDependencies = {}
): RealtimeServiceInstance {
  const logger = new StructuredLogger(env.logLevel);
  const metrics = new RealtimeMetrics();
  const registry = new ConnectionRegistry();
  const publisherAuth = new PublisherAuth(env.internalSecret, env.replayWindowSeconds);

  const ticketValidator =
    deps.ticketValidator ?? new PhpTicketValidator(env.backendInternalApiUrl, publisherAuth);
  const sessionValidator =
    deps.sessionValidator ?? new PhpSessionValidator(env.backendInternalApiUrl, publisherAuth);

  let internalPublisher!: InternalPublisherHandler;

  const httpServer = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const urlPath = (req.url || '/').split('?')[0];

    try {
      if (urlPath === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'healthy',
            service: 'toothcare-realtime',
            active_connections: registry.totalConnections(),
            uptime_seconds: metrics.getUptimeSeconds(),
            timestamp: new Date().toISOString(),
          })
        );
        return;
      }

      if (urlPath === '/metrics' && req.method === 'GET') {
        metrics.activeConnections = registry.totalConnections();
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
        res.end(metrics.renderPrometheus());
        return;
      }

      if (urlPath === '/internal/publish' && req.method === 'POST') {
        await internalPublisher.handlePublish(req, res);
        return;
      }

      if (urlPath === '/internal/revoke' && req.method === 'POST') {
        await internalPublisher.handleRevoke(req, res);
        return;
      }

      // Let Socket.IO handle its own path
      if (urlPath.startsWith(env.socketPath) || urlPath === env.socketPath.replace(/\/$/, '')) {
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  const io = new SocketIOServer(httpServer, buildSocketServerOptions(env));
  const eventHandler = new RealtimeEventHandler(
    io,
    metrics,
    logger,
    env.eventDedupTtlMs,
    env.eventDedupMaxSize
  );
  internalPublisher = new InternalPublisherHandler(
    publisherAuth,
    eventHandler,
    registry,
    metrics,
    logger,
    env.publishRateLimitPerMin
  );

  const authenticator = new ConnectionAuthenticator(
    ticketValidator,
    registry,
    metrics,
    logger,
    env.maxConnectionsPerUser
  );

  io.use(createAuthenticationMiddleware(authenticator));

  io.on('connection', async (socket) => {
    const identity = socket.data.identity as VerifiedUserIdentity | undefined;
    if (!identity) {
      socket.disconnect(true);
      return;
    }

    registry.register(socket, identity);
    metrics.activeConnections = registry.totalConnections();

    await RoomManager.assignAuthorizedRooms(socket, identity);
    attachAuthorizationGuard(socket, metrics, logger);

    logger.info('Authenticated realtime client connected', {
      socketId: socket.id,
      role: identity.role,
      activeConnections: metrics.activeConnections,
    });

    // Emit safe connection confirmation (no internal room membership or secrets)
    socket.emit('realtime:connected', {
      status: 'connected',
      timestamp: new Date().toISOString(),
    });

    socket.on('error', () => {
      metrics.socketErrorsTotal += 1;
    });

    socket.on('disconnect', (reason) => {
      registry.unregister(socket.id);
      metrics.activeConnections = registry.totalConnections();
      logger.info('Realtime client disconnected', {
        socketId: socket.id,
        reason,
        activeConnections: metrics.activeConnections,
      });
    });
  });

  // Periodic background session/user revalidation to enforce deactivation or role changes
  const revalidateTimer = setInterval(async () => {
    const sockets = registry.getAll();
    const checkedUsers = new Set<number>();

    for (const entry of sockets) {
      const uid = entry.identity.userId;
      if (checkedUsers.has(uid)) continue;
      checkedUsers.add(uid);

      const result = await sessionValidator.revalidateUser(uid, entry.identity.sessionIdHash);
      if (!result.active) {
        const count = registry.disconnectUser(uid, null, result.reason || 'SESSION_EXPIRED');
        metrics.sessionRevocationsTotal += count;
        metrics.activeConnections = registry.totalConnections();
      } else if (result.identity && result.identity.role !== entry.identity.role) {
        const count = registry.disconnectUser(uid, null, 'ROLE_CHANGED');
        metrics.sessionRevocationsTotal += count;
        metrics.activeConnections = registry.totalConnections();
      }
    }
  }, env.sessionRevalidateIntervalMs);
  revalidateTimer.unref();

  return {
    httpServer,
    io,
    registry,
    metrics,
    publisherAuth,
    start: () =>
      new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(env.port, env.host, () => {
          const addr = httpServer.address();
          const boundPort = typeof addr === 'object' && addr ? addr.port : env.port;
          logger.info('ToothCare Hub Real-Time service started', {
            host: env.host,
            port: boundPort,
            nodeEnv: env.nodeEnv,
          });
          resolve({ port: boundPort });
        });
      }),
    close: () =>
      new Promise((resolve) => {
        clearInterval(revalidateTimer);
        io.close(() => {
          httpServer.close(() => {
            resolve();
          });
        });
      }),
  };
}
