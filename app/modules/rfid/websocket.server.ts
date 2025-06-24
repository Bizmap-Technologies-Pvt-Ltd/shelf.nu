import { getAssetByRfid } from "~/modules/asset/service.server";
import { WebSocket } from 'ws';
import type { WebSocketMessage, WebSocketResponse } from "~/routes/api+/rfid-websocket";

// Store active WebSocket connections with their authentication context
const activeConnections = new Map<string, { 
  ws: WebSocket; 
  userId: string; 
  organizationId: string; 
}>();
const activeSessions = new Map<string, { 
  connectionId: string;
  userId: string; 
  organizationId: string; 
  startTime: number;
  tags: Set<string>;
}>();

// WebSocket handler function for Node.js ws library
export async function handleWebSocketConnection(
  ws: WebSocket, 
  request: any, // Node.js IncomingMessage
  tempUserId: string, // Will be replaced by real auth
  tempOrgId: string   // Will be replaced by real auth
) {
  const connectionId = crypto.randomUUID();
  
  // Store connection without auth initially - auth will come from START_SESSION
  activeConnections.set(connectionId, { 
    ws, 
    userId: '', 
    organizationId: '' 
  });
  
  console.log(`[WebSocket] New RFID connection: ${connectionId}`);

  ws.on('message', async (data) => {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      await handleWebSocketMessage(ws, message, connectionId);
    } catch (error) {
      console.error('[WebSocket] Message parsing error:', error);
      sendWebSocketMessage(ws, {
        type: 'ERROR',
        error: 'Invalid message format',
        timestamp: Date.now()
      });
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
}

async function handleWebSocketMessage(
  ws: WebSocket,
  message: WebSocketMessage,
  connectionId: string
) {
  console.log(`[WebSocket] Received message:`, message);

  const connection = activeConnections.get(connectionId);
  if (!connection) {
    sendWebSocketMessage(ws, {
      type: 'ERROR',
      error: 'Connection not found',
      timestamp: Date.now()
    });
    return;
  }

  switch (message.type) {
    case 'START_SESSION':
      // For now, we'll use hardcoded values
      // In a real implementation, these would come from authentication
      const userId = 'user-123'; // TODO: Get from authentication
      const organizationId = 'org-123'; // TODO: Get from authentication
      
      const sessionId = message.sessionId || crypto.randomUUID();
      activeSessions.set(sessionId, {
        connectionId,
        userId,
        organizationId,
        startTime: Date.now(),
        tags: new Set()
      });
      
      // Update connection with auth info
      connection.userId = userId;
      connection.organizationId = organizationId;
      
      sendWebSocketMessage(ws, {
        type: 'SESSION_STARTED',
        sessionId,
        timestamp: Date.now()
      });
      break;

    case 'END_SESSION':
      if (message.sessionId) {
        activeSessions.delete(message.sessionId);
        sendWebSocketMessage(ws, {
          type: 'SESSION_ENDED',
          sessionId: message.sessionId,
          timestamp: Date.now()
        });
      }
      break;

    case 'SCAN_RFID':
      if (!message.rfidTag || !message.sessionId) {
        sendWebSocketMessage(ws, {
          type: 'ERROR',
          error: 'Missing rfidTag or sessionId',
          timestamp: Date.now()
        });
        return;
      }

      const session = activeSessions.get(message.sessionId);
      if (!session) {
        sendWebSocketMessage(ws, {
          type: 'ERROR',
          error: 'Invalid session',
          timestamp: Date.now()
        });
        return;
      }

      // Check for duplicate tags in this session
      if (session.tags.has(message.rfidTag)) {
        console.log(`[WebSocket] Duplicate tag skipped: ${message.rfidTag}`);
        return;
      }

      session.tags.add(message.rfidTag);
      
      try {
        // Look up the asset by RFID tag
        const asset = await getAssetByRfid({
          rfid: message.rfidTag,
          organizationId: session.organizationId,
          include: {
            category: true,
            location: true
          }
        });

        sendWebSocketMessage(ws, {
          type: 'RFID_RESULT',
          sessionId: message.sessionId,
          rfidTag: message.rfidTag,
          asset: asset ? {
            id: asset.id,
            title: asset.title,
            status: asset.status,
            category: asset.category ? { name: asset.category.name } : undefined,
            location: asset.location ? { name: asset.location.name } : undefined
          } : null,
          timestamp: Date.now()
        });

      } catch (err) {
        console.error(`[WebSocket] Asset lookup error for ${message.rfidTag}:`, err);
        
        sendWebSocketMessage(ws, {
          type: 'RFID_RESULT',
          sessionId: message.sessionId,
          rfidTag: message.rfidTag,
          asset: null,
          timestamp: Date.now()
        });
      }
      break;

    case 'PING':
      sendWebSocketMessage(ws, {
        type: 'PONG',
        timestamp: Date.now()
      });
      break;

    default:
      sendWebSocketMessage(ws, {
        type: 'ERROR',
        error: `Unknown message type: ${message.type}`,
        timestamp: Date.now()
      });
  }
}

function sendWebSocketMessage(ws: WebSocket, message: WebSocketResponse) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Utility to broadcast to all connections in a session
export function broadcastToSession(sessionId: string, message: WebSocketResponse) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  for (const [connectionId, connection] of activeConnections.entries()) {
    sendWebSocketMessage(connection.ws, message);
  }
}

// Clean up old sessions (call periodically)
export function cleanupOldSessions() {
  const now = Date.now();
  const MAX_SESSION_AGE = 24 * 60 * 60 * 1000; // 24 hours

  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.startTime > MAX_SESSION_AGE) {
      activeSessions.delete(sessionId);
      console.log(`[WebSocket] Cleaned up old session: ${sessionId}`);
    }
  }
}
