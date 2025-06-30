const crypto = require('crypto');
const WebSocket = require('ws');

console.log('Testing WebSocket connection to ws://localhost:3001/rfid-stream');

const ws = new WebSocket('ws://localhost:3001/rfid-stream');

ws.on('open', () => {
    console.log('✅ Connected to WebSocket server');
    
    // Start a session
    const sessionId = crypto.randomUUID();
    console.log(`📝 Starting session: ${sessionId}`);
    
    ws.send(JSON.stringify({
        type: 'START_SESSION',
        sessionId: sessionId,
        timestamp: Date.now()
    }));
    
    // Wait a bit, then send an RFID scan for TAG004
    setTimeout(() => {
        console.log('🏷️  Scanning RFID tag: TAG004 (should be found)');
        ws.send(JSON.stringify({
            type: 'SCAN_RFID',
            sessionId: sessionId,
            rfidTag: 'TAG004',
            timestamp: Date.now()
        }));
    }, 1000);
    
    // Test an unknown tag
    setTimeout(() => {
        console.log('🏷️  Scanning RFID tag: UNKNOWN_TAG (should not be found)');
        ws.send(JSON.stringify({
            type: 'SCAN_RFID',
            sessionId: sessionId,
            rfidTag: 'UNKNOWN_TAG',
            timestamp: Date.now()
        }));
    }, 2000);
    
    // End session after 5 seconds
    setTimeout(() => {
        console.log('🏁 Ending session');
        ws.send(JSON.stringify({
            type: 'END_SESSION',
            sessionId: sessionId,
            timestamp: Date.now()
        }));
        
        setTimeout(() => {
            ws.close();
        }, 500);
    }, 5000);
});

ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log(`📨 Received: ${message.type}`, message);
});

ws.on('close', () => {
    console.log('❌ WebSocket connection closed');
    process.exit(0);
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    process.exit(1);
});
