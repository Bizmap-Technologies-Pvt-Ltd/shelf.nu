const crypto = require('crypto');
const WebSocket = require('ws');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('tag', { type: 'string', describe: 'RFID tag to scan', default: 'TAG004' })
  .option('session', { type: 'string', describe: 'Session ID' })
  .option('retries', { type: 'number', describe: 'Connection retries', default: 3 })
  .help().argv;

function connectWebSocket(retriesLeft) {
  const ws = new WebSocket('ws://localhost:3001/rfid-stream');
  ws.on('open', () => {
    console.log('✅ Connected to WebSocket server');
    const sessionId = argv.session || crypto.randomUUID();
    console.log(`📝 Starting session: ${sessionId}`);
    ws.send(JSON.stringify({ type: 'START_SESSION', sessionId, timestamp: Date.now() }));
    setTimeout(() => {
      console.log(`🏷️  Scanning RFID tag: ${argv.tag}`);
      ws.send(JSON.stringify({ type: 'SCAN_RFID', sessionId, rfidTag: argv.tag, timestamp: Date.now() }));
    }, 1000);
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'END_SESSION', sessionId, timestamp: Date.now() }));
      setTimeout(() => ws.close(), 500);
    }, 3000);
  });
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📨 Received: ${message.type}`, message);
    } catch (e) {
      console.error('❌ Invalid message:', data.toString());
    }
  });
  ws.on('close', () => {
    console.log('❌ WebSocket connection closed');
    process.exit(0);
  });
  ws.on('error', (error) => {
    if (retriesLeft > 0) {
      console.log(`🔁 Retry connecting... (${retriesLeft} left)`);
      setTimeout(() => connectWebSocket(retriesLeft - 1), 1000);
    } else {
      console.error('❌ WebSocket error:', error);
      process.exit(1);
    }
  });
}

connectWebSocket(argv.retries);
