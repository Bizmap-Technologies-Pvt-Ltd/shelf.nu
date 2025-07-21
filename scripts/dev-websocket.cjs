/**
 * Simple WebSocket server for RFID streaming in development
 */

const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { getAssetByRfid, initializeDb, closeDb } = require('./rfid-db-service.cjs');

const port = process.env.WEBSOCKET_PORT ? parseInt(process.env.WEBSOCKET_PORT) : 3001;

const wss = new WebSocketServer({ 
  port,
  path: '/rfid-stream',
  // Add proper headers for browser connections
  verifyClient: (info) => {
    console.log(`[WebSocket] Connection attempt from origin: ${info.origin}`);
    return true; // Accept all origins in development
  }
});

console.log(`[WebSocket] RFID WebSocket server listening on port ${port}`);

// Robust: Track DB ready state
let dbReady = false;

initializeDb().then((success) => {
  dbReady = success;
  if (success) {
    console.log('[WebSocket] Ready to serve real asset data from database');
  } else {
    console.log('[WebSocket] Warning: Database connection failed, may not return real data');
  }
});

const activeConnections = new Map();
const activeSessions = new Map();

wss.on('connection', (ws, request) => {
  const connectionId = crypto.randomUUID();
  console.log(`[WebSocket] New RFID connection: ${connectionId}`);
  activeConnections.set(connectionId, { ws });

  ws.on('message', async (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        error: 'Invalid message format',
        timestamp: Date.now()
      }));
      return;
    }
    try {
      switch (message.type) {
        case 'START_SESSION': {
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
        }
        case 'END_SESSION': {
          if (message.sessionId) {
            activeSessions.delete(message.sessionId);
            ws.send(JSON.stringify({
              type: 'SESSION_ENDED',
              sessionId: message.sessionId,
              timestamp: Date.now()
            }));
          }
          break;
        }
        case 'SCAN_RFID': {
          if (!message.rfidTag || !message.sessionId) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              error: 'Missing rfidTag or sessionId',
              timestamp: Date.now()
            }));
            return;
          }
          
          // Normalize RFID tag: trim and convert to uppercase for consistency
          const normalizedRfidTag = message.rfidTag.trim().toUpperCase();
          
          const session = activeSessions.get(message.sessionId);
          if (!session) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              error: 'Invalid session',
              timestamp: Date.now()
            }));
            return;
          }
          if (session.tags.has(normalizedRfidTag)) return;
          session.tags.add(normalizedRfidTag);
          let asset = null;
          if (dbReady) {
            try {
              const foundAsset = await getAssetByRfid(normalizedRfidTag, session.organizationId);
              if (foundAsset) {
                asset = {
                  id: foundAsset.id,
                  title: foundAsset.title,
                  status: foundAsset.status,
                  category: foundAsset.category ? { name: foundAsset.category.name } : undefined,
                  location: foundAsset.location ? { id: foundAsset.location.id, name: foundAsset.location.name } : undefined,
                };
              }
            } catch (error) {
              ws.send(JSON.stringify({
                type: 'ERROR',
                error: 'DB lookup failed',
                timestamp: Date.now()
              }));
            }
          } else {
            ws.send(JSON.stringify({
              type: 'ERROR',
              error: 'DB not ready',
              timestamp: Date.now()
            }));
          }
          ws.send(JSON.stringify({
            type: 'RFID_RESULT',
            sessionId: message.sessionId,
            rfidTag: normalizedRfidTag,
            asset,
            timestamp: Date.now()
          }));
          break;
        }
        case 'PING': {
          ws.send(JSON.stringify({
            type: 'PONG',
            timestamp: Date.now()
          }));
          break;
        }
        default: {
          ws.send(JSON.stringify({
            type: 'ERROR',
            error: `Unknown message type: ${message.type}`,
            timestamp: Date.now()
          }));
        }
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        error: 'Internal server error',
        timestamp: Date.now()
      }));
    }
  });

  ws.on('close', () => {
    activeConnections.delete(connectionId);
    for (const [sessionId, session] of activeSessions.entries()) {
      if (session.connectionId === connectionId) {
        activeSessions.delete(sessionId);
      }
    }
  });

  ws.on('error', (error) => {
    console.error(`[WebSocket] Connection error: ${connectionId}`, error);
  });
});

// Robust: Handle shutdown and cleanup
const shutdown = async () => {
  console.log('[WebSocket] Shutting down WebSocket server...');
  try { await closeDb(); } catch {}
  wss.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
