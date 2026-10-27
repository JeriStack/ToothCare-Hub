/**
 * ToothCare Hub - Real-Time WebSocket Service
 * Node.js + Socket.IO microservice for appointment status sync and clinic notifications.
 */

const http = require('http');
const { Server } = require('socket.io');

const PORT = parseInt(process.env.PORT || '4000', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:8080')
  .split(',')
  .map(o => o.trim());

let activeConnections = 0;

// Native HTTP server for health, metrics, and Socket.IO handshake
const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'toothcare-realtime',
      active_connections: activeConnections,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (req.url === '/metrics' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
    res.end([
      '# HELP toothcare_realtime_up Service availability indicator',
      '# TYPE toothcare_realtime_up gauge',
      'toothcare_realtime_up 1',
      '# HELP toothcare_realtime_active_connections Current active WebSocket connections',
      '# TYPE toothcare_realtime_active_connections gauge',
      `toothcare_realtime_active_connections ${activeConnections}`,
      ''
    ].join('\n'));
    return;
  }

  // Fallback for non-health/non-socket HTTP requests
  if (!req.url.startsWith('/socket.io/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
});

// Initialize Socket.IO with CORS rules
const io = new Server(server, {
  path: '/socket.io/',
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 20000,
  pingInterval: 25000
});

io.on('connection', (socket) => {
  activeConnections++;
  console.log(`[realtime] Client connected: ${socket.id} (Total: ${activeConnections})`);

  socket.emit('system:connected', {
    status: 'connected',
    clientId: socket.id,
    timestamp: new Date().toISOString()
  });

  socket.on('disconnect', (reason) => {
    activeConnections = Math.max(0, activeConnections - 1);
    console.log(`[realtime] Client disconnected: ${socket.id} (${reason}) (Total: ${activeConnections})`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[realtime] ToothCare Hub Real-Time service running on port ${PORT}`);
});

// Graceful termination handling
const handleShutdown = (signal) => {
  console.log(`[realtime] Received ${signal}. Closing server gracefully...`);
  io.close(() => {
    server.close(() => {
      console.log('[realtime] Server closed cleanly.');
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error('[realtime] Forced shutdown after timeout.');
    process.exit(1);
  }, 5000).unref();
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
