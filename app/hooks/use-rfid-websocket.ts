import { useState, useEffect, useRef, useCallback } from "react";

export interface WebSocketMessage {
  type: 'SCAN_RFID' | 'START_SESSION' | 'END_SESSION' | 'PING';
  sessionId?: string;
  rfidTag?: string;
  timestamp?: number;
}

export interface WebSocketResponse {
  type: 'RFID_RESULT' | 'SESSION_STARTED' | 'SESSION_ENDED' | 'ERROR' | 'PONG';
  sessionId?: string;
  rfidTag?: string;
  asset?: {
    id: string;
    title: string;
    status: string;
    category?: { name: string };
    location?: { id: string; name: string };
  } | null;
  error?: string;
  timestamp: number;
}

export interface RfidStreamingResult {
  rfidTag: string;
  asset: {
    id: string;
    title: string;
    status: string;
    category?: { name: string };
    location?: { id: string; name: string };
  } | null;
  timestamp: number;
}

export interface RfidStreamingStats {
  totalProcessed: number;
  foundAssets: number;
  notFoundAssets: number;
  errors: number;
}

export interface UseRfidWebSocketReturn {
  // Connection state
  isConnected: boolean;
  connectionState: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  
  // Session management
  sessionId: string | null;
  isStreaming: boolean;
  startSession: () => void;
  endSession: () => void;
  
  // RFID processing
  streamRfidTag: (tag: string) => void;
  results: RfidStreamingResult[];
  stats: RfidStreamingStats;
  
  // Error handling
  error: string | null;
  clearError: () => void;
  clearResults: () => void;
}

/**
 * WebSocket-based RFID streaming hook
 * Provides real-time RFID tag processing via WebSocket connection
 */
export function useRfidWebSocket(): UseRfidWebSocketReturn {
  const [connectionState, setConnectionState] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'>('DISCONNECTED');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [results, setResults] = useState<RfidStreamingResult[]>([]);
  const [stats, setStats] = useState<RfidStreamingStats>({
    totalProcessed: 0,
    foundAssets: 0,
    notFoundAssets: 0,
    errors: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pendingSessionIdRef = useRef<string | null>(null);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  // WebSocket connection management
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setConnectionState('CONNECTING');
    setError(null);

    try {
      // Connect to the real WebSocket server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsPort = process.env.NODE_ENV === 'development' ? '3001' : window.location.port;
      const wsHost = window.location.hostname;
      const wsUrl = `${protocol}//${wsHost}:${wsPort}/rfid-stream`;
      
      wsRef.current = new WebSocket(wsUrl);

      const ws = wsRef.current;

      ws.onopen = () => {
        setConnectionState('CONNECTED');
        reconnectAttemptsRef.current = 0;
        
        // If there's a pending session, start it now
        if (pendingSessionIdRef.current) {
          ws.send(JSON.stringify({
            type: 'START_SESSION',
            sessionId: pendingSessionIdRef.current,
            timestamp: Date.now(),
          } as WebSocketMessage));
          pendingSessionIdRef.current = null; // Clear the pending session
        }
        
        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
          }
        }, 30000); // 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketResponse = JSON.parse(event.data);
          handleMessage(message);
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
          setError('Failed to parse server message');
        }
      };

      ws.onclose = (event) => {
        setConnectionState('DISCONNECTED');
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt to reconnect if it wasn't a manual close
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          scheduleReconnect();
        }
      };

      ws.onerror = (event) => {
        console.error('[WebSocket] Connection error:', event);
        setConnectionState('ERROR');
        setError('WebSocket connection error');
      };

    } catch (err) {
      console.error('[WebSocket] Failed to create connection:', err);
      setConnectionState('ERROR');
      setError('Failed to establish WebSocket connection');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }

    setConnectionState('DISCONNECTED');
    setSessionId(null);
    setIsStreaming(false);
    pendingSessionIdRef.current = null; // Clear any pending session
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setError('Maximum reconnection attempts reached');
      return;
    }

    reconnectAttemptsRef.current++;
    
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, reconnectDelay);
  }, [connect]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error('[WebSocket] Cannot send message - not connected');
      setError('WebSocket not connected');
    }
  }, []);

  const handleMessage = useCallback((message: WebSocketResponse) => {
    switch (message.type) {
      case 'SESSION_STARTED':
        setSessionId(message.sessionId || null);
        setIsStreaming(true);
        break;

      case 'SESSION_ENDED':
        setSessionId(null);
        setIsStreaming(false);
        break;

      case 'RFID_RESULT':
        if (message.rfidTag) {
          const result: RfidStreamingResult = {
            rfidTag: message.rfidTag,
            asset: message.asset || null,
            timestamp: message.timestamp,
          };

          setResults(prev => [...prev, result]);
          setStats(prev => ({
            totalProcessed: prev.totalProcessed + 1,
            foundAssets: message.asset ? prev.foundAssets + 1 : prev.foundAssets,
            notFoundAssets: !message.asset ? prev.notFoundAssets + 1 : prev.notFoundAssets,
            errors: prev.errors,
          }));
        }
        break;

      case 'ERROR':
        setError(message.error || 'Unknown server error');
        setStats(prev => ({
          ...prev,
          errors: prev.errors + 1,
        }));
        break;

      case 'PONG':
        // Heartbeat response - connection is alive
        break;

      default:
        console.warn('[WebSocket] Unknown message type:', message.type);
    }
  }, []);

  // Session management
  const startSession = useCallback(() => {
    const newSessionId = crypto.randomUUID();
    console.log('[WebSocket] Requesting new session:', newSessionId);
    
    if (connectionState !== 'CONNECTED') {
      // Store the session ID to start once connected
      console.log('[WebSocket] Not connected, storing pending session:', newSessionId);
      pendingSessionIdRef.current = newSessionId;
      setSessionId(newSessionId);
      connect();
      return;
    }

    console.log('[WebSocket] Sending START_SESSION message:', newSessionId);
    sendMessage({
      type: 'START_SESSION',
      sessionId: newSessionId,
      timestamp: Date.now(),
    });
  }, [connectionState, connect, sendMessage]);

  const endSession = useCallback(() => {
    if (sessionId) {
      sendMessage({
        type: 'END_SESSION',
        sessionId,
        timestamp: Date.now(),
      });
    }
    setIsStreaming(false);
  }, [sessionId, sendMessage]);

  // RFID processing
  const streamRfidTag = useCallback((tag: string) => {
    console.log(`[WebSocket] streamRfidTag called with tag: ${tag}`);
    console.log(`[WebSocket] Current state - sessionId: ${sessionId}, isStreaming: ${isStreaming}`);
    
    if (!sessionId || !isStreaming) {
      console.warn('[WebSocket] Cannot stream tag - no active session');
      console.warn(`[WebSocket] sessionId: ${sessionId}, isStreaming: ${isStreaming}`);
      return;
    }

    console.log(`[WebSocket] Sending SCAN_RFID message for tag: ${tag}`);
    sendMessage({
      type: 'SCAN_RFID',
      sessionId,
      rfidTag: tag,
      timestamp: Date.now(),
    });
  }, [sessionId, isStreaming, sendMessage]);

  // Utility functions
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setStats({
      totalProcessed: 0,
      foundAssets: 0,
      notFoundAssets: 0,
      errors: 0,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // Connection state
    isConnected: connectionState === 'CONNECTED',
    connectionState,
    
    // Session management
    sessionId,
    isStreaming,
    startSession,
    endSession,
    
    // RFID processing
    streamRfidTag,
    results,
    stats,
    
    // Error handling
    error,
    clearError,
    clearResults,
  };
}
