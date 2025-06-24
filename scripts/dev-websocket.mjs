#!/usr/bin/env node

/**
 * Development WebSocket server starter
 * This runs the WebSocket server alongside the main Vite dev server
 */

import { createWebSocketServer } from "../server/websocket.js";

const port = process.env.WEBSOCKET_PORT ? parseInt(process.env.WEBSOCKET_PORT) : 3001;

console.log("[Dev] Starting RFID WebSocket server...");
createWebSocketServer(port);

// Keep the process alive
process.on('SIGINT', () => {
  console.log("[Dev] Shutting down WebSocket server...");
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log("[Dev] Shutting down WebSocket server...");
  process.exit(0);
});
