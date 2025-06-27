/**
 * Simple WebSocket server for RFID streaming in development
 */

const { WebSocketServer } = require('ws');

const port = process.env.WEBSOCKET_PORT ? parseInt(process.env.WEBSOCKET_PORT) : 3001;

const wss = new WebSocketServer({ 
  port,
  path: '/rfid-stream'
});

console.log(`[WebSocket] RFID WebSocket server listening on port ${port}`);

// Store active connections and sessions
const activeConnections = new Map();
const activeSessions = new Map();

wss.on('connection', (ws, request) => {
  const connectionId = crypto.randomUUID();
  
  console.log(`[WebSocket] New RFID connection: ${connectionId}`);
  
  activeConnections.set(connectionId, { 
    ws, 
    userId: '', 
    organizationId: '' 
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`[WebSocket] Received:`, message);
      
      switch (message.type) {
        case 'START_SESSION':
          const sessionId = message.sessionId || crypto.randomUUID();
          activeSessions.set(sessionId, {
            connectionId,
            userId: 'dev-user',
            organizationId: 'dev-org',
            startTime: Date.now(),
            tags: new Set()
          });
          
          ws.send(JSON.stringify({
            type: 'SESSION_STARTED',
            sessionId,
            timestamp: Date.now()
          }));
          break;

        case 'END_SESSION':
          if (message.sessionId) {
            activeSessions.delete(message.sessionId);
            ws.send(JSON.stringify({
              type: 'SESSION_ENDED',
              sessionId: message.sessionId,
              timestamp: Date.now()
            }));
          }
          break;

        case 'SCAN_RFID':
          if (!message.rfidTag || !message.sessionId) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              error: 'Missing rfidTag or sessionId',
              timestamp: Date.now()
            }));
            return;
          }

          const session = activeSessions.get(message.sessionId);
          if (!session) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              error: 'Invalid session',
              timestamp: Date.now()
            }));
            return;
          }

          // Check for duplicate tags in this session
          if (session.tags.has(message.rfidTag)) {
            console.log(`[WebSocket] Duplicate tag skipped: ${message.rfidTag}`);
            return;
          }

          session.tags.add(message.rfidTag);
          
          // For testing: simulate some assets
          let asset = null;
          if (message.rfidTag.includes('123') || message.rfidTag.includes('asset')) {
            asset = {
              id: `asset-${message.rfidTag}`,
              title: `Test Asset for ${message.rfidTag}`,
              status: 'AVAILABLE',
              category: { name: 'Test Category' },
              location: { name: 'Test Location' }
            };
          }

          ws.send(JSON.stringify({
            type: 'RFID_RESULT',
            sessionId: message.sessionId,
            rfidTag: message.rfidTag,
            asset,
            timestamp: Date.now()
          }));
          break;

        case 'PING':
          ws.send(JSON.stringify({
            type: 'PONG',
            timestamp: Date.now()
          }));
          break;

        default:
          ws.send(JSON.stringify({
            type: 'ERROR',
            error: `Unknown message type: ${message.type}`,
            timestamp: Date.now()
          }));
      }
    } catch (error) {
      console.error('[WebSocket] Message parsing error:', error);
      ws.send(JSON.stringify({
        type: 'ERROR',
        error: 'Invalid message format',
        timestamp: Date.now()
      }));
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket] Connection closed: ${connectionId}`);
    activeConnections.delete(connectionId);
    
    // Clean up any sessions for this connection
    for (const [sessionId, session] of activeSessions.entries()) {
      if (session.connectionId === connectionId) {
        activeSessions.delete(sessionId);
        console.log(`[WebSocket] Cleaned up session: ${sessionId}`);
      }
    }
  });

  ws.on('error', (error) => {
    console.error(`[WebSocket] Connection error: ${connectionId}`, error);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log("[WebSocket] Shutting down WebSocket server...");
  wss.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log("[WebSocket] Shutting down WebSocket server...");
  wss.close(() => {
    process.exit(0);
  });
});
