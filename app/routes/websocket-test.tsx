import { useRfidWebSocket } from "~/hooks/use-rfid-websocket";
import { useState } from "react";

export default function WebSocketTest() {
  const {
    isConnected,
    connectionState,
    sessionId,
    isStreaming,
    startSession,
    endSession,
    streamRfidTag,
    results,
    stats,
    error,
    clearError,
    clearResults,
  } = useRfidWebSocket();

  const [rfidTag, setRfidTag] = useState("test-tag-123");

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>WebSocket RFID Test</h1>
      
      <div style={{ marginBottom: "20px" }}>
        <h3>Connection Status</h3>
        <p>State: <span style={{ color: isConnected ? 'green' : 'red' }}>{connectionState}</span></p>
        <p>Session ID: {sessionId || 'None'}</p>
        <p>Is Streaming: {isStreaming ? 'Yes' : 'No'}</p>
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>Controls</h3>
        <button onClick={startSession} disabled={isStreaming}>
          Start Session
        </button>
        <button onClick={endSession} disabled={!isStreaming} style={{ marginLeft: "10px" }}>
          End Session
        </button>
        <button onClick={clearError} style={{ marginLeft: "10px" }}>
          Clear Error
        </button>
        <button onClick={clearResults} style={{ marginLeft: "10px" }}>
          Clear Results
        </button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>RFID Scanning</h3>
        <input
          type="text"
          value={rfidTag}
          onChange={(e) => setRfidTag(e.target.value)}
          placeholder="Enter RFID tag"
          style={{ marginRight: "10px", padding: "5px" }}
        />
        <button
          onClick={() => streamRfidTag(rfidTag)}
          disabled={!isStreaming || !rfidTag}
        >
          Scan Tag
        </button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>Statistics</h3>
        <p>Total Processed: {stats.totalProcessed}</p>
        <p>Found Assets: {stats.foundAssets}</p>
        <p>Not Found: {stats.notFoundAssets}</p>
        <p>Errors: {stats.errors}</p>
      </div>

      <div>
        <h3>Results</h3>
        <div style={{ maxHeight: "300px", overflow: "auto", border: "1px solid #ccc", padding: "10px" }}>
          {results.length === 0 ? (
            <p>No results yet</p>
          ) : (
            results.map((result, index) => (
              <div key={index} style={{ marginBottom: "10px", padding: "10px", border: "1px solid #eee" }}>
                <strong>Tag:</strong> {result.rfidTag}<br />
                <strong>Time:</strong> {new Date(result.timestamp).toLocaleTimeString()}<br />
                {result.asset ? (
                  <div>
                    <strong>Asset Found:</strong><br />
                    - ID: {result.asset.id}<br />
                    - Title: {result.asset.title}<br />
                    - Status: {result.asset.status}<br />
                    {result.asset.category && <>- Category: {result.asset.category.name}<br /></>}
                    {result.asset.location && <>- Location: {result.asset.location.name}<br /></>}
                  </div>
                ) : (
                  <div style={{ color: 'orange' }}>
                    <strong>Asset Not Found</strong>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
