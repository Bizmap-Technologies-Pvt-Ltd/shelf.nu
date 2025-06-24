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

// Initialize database connection
initializeDb().then((success) => {
  if (success) {
    console.log('[WebSocket] Ready to serve real asset data from database');
  } else {
    console.log('[WebSocket] Warning: Database connection failed, may not return real data');
  }
});

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
            return;
          }

          session.tags.add(message.rfidTag);
          
          // Look up real asset data from the database
          let asset = null;
          try {
            const foundAsset = await getAssetByRfid(message.rfidTag, session.organizationId);
            
            if (foundAsset) {
              asset = {
                id: foundAsset.id,
                title: foundAsset.title,
                status: foundAsset.status,
                category: foundAsset.category ? { name: foundAsset.category.name } : undefined,
                location: foundAsset.location ? { 
                  id: foundAsset.location.id,
                  name: foundAsset.location.name 
                } : undefined,
              };
            }
          } catch (error) {
            console.error(`[WebSocket] Error looking up asset for ${message.rfidTag}:`, error);
            // Asset remains null
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
process.on('SIGINT', async () => {
  console.log("[WebSocket] Shutting down WebSocket server...");
  await closeDb();
  wss.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log("[WebSocket] Shutting down WebSocket server...");
  await closeDb();
  wss.close(() => {
    process.exit(0);
  });
});
