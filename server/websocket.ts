import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { parse } from 'url';
import { handleWebSocketConnection } from '~/modules/rfid/websocket.server';

export function createWebSocketServer(port: number = 3001) {
  const wss = new WebSocketServer({ 
    port,
    path: '/rfid-stream'
  });

  console.log(`[WebSocket] RFID WebSocket server listening on port ${port}`);

  wss.on('connection', async (ws, request) => {
    try {
      // For now, we'll accept any connection and let the session management
      // happen at the application level through START_SESSION messages
      const url = parse(request.url || '', true);
      console.log(`[WebSocket] New connection attempt from: ${request.socket.remoteAddress}`);
      
      // We'll handle authentication through the WebSocket messages themselves
      // The client will send a START_SESSION message with authentication info
      await handleWebSocketConnection(
        ws, 
        request, 
        'temp-user', // Temporary - will be set properly via START_SESSION
        'temp-org'   // Temporary - will be set properly via START_SESSION
      );

    } catch (error) {
      console.error('[WebSocket] Connection setup error:', error);
      ws.close(1011, 'Internal server error');
    }
  });

  return wss;
}

// Start WebSocket server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.WEBSOCKET_PORT ? parseInt(process.env.WEBSOCKET_PORT) : 3001;
  createWebSocketServer(port);
}
