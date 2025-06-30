#!/usr/bin/env node
/**
 * Development WebSocket server starter (robust)
 * Runs the WebSocket server alongside the main Vite dev server
 */

import { createWebSocketServer } from "../server/websocket.js";

const port = process.env.WEBSOCKET_PORT ? parseInt(process.env.WEBSOCKET_PORT) : 3001;

try {
  console.log(`[Dev] Starting RFID WebSocket server on port ${port}...`);
  createWebSocketServer(port);
} catch (err) {
  console.error('[Dev] Failed to start WebSocket server:', err);
  process.exit(1);
}

const shutdown = () => {
  console.log("[Dev] Shutting down WebSocket server...");
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
