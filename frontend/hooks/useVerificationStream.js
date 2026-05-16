/**
 * React hook for real-time verification streaming via WebSocket
 * Handles connection, reconnection, and state management
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

/**
 * WebSocket connection states
 */
const ConnectionState = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  RECONNECTING: 'reconnecting'
};

/**
 * Verification status states
 */
const VerificationStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Hook for streaming verification results via WebSocket
 * 
 * @param {string} prId - Pull request ID to verify
 * @param {Object} options - Configuration options
 * @param {Function} options.onStageComplete - Callback when a stage completes
 * @param {Function} options.onComplete - Callback when verification completes
 * @param {Function} options.onError - Callback on error
 * @param {boolean} options.autoReconnect - Enable automatic reconnection (default: true)
 * @param {number} options.maxRetries - Maximum reconnection attempts (default: 5)
 * @param {boolean} options.autoStart - Start verification on mount (default: true)
 * 
 * @returns {Object} Verification state and control functions
 */
export function useVerificationStream(prId, options = {}) {
  const {
    onStageComplete,
    onComplete,
    onError,
    autoReconnect = true,
    maxRetries = 5,
    autoStart = true
  } = options;

  // State
  const [connectionState, setConnectionState] = useState(ConnectionState.DISCONNECTED);
  const [verificationStatus, setVerificationStatus] = useState(VerificationStatus.IDLE);
  const [currentStage, setCurrentStage] = useState(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState({});
  const [error, setError] = useState(null);

  // Refs for WebSocket and reconnection logic
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isManualCloseRef = useRef(false);

  /**
   * Calculate exponential backoff delay
   */
  const getReconnectDelay = useCallback(() => {
    const baseDelay = 1000; // 1 second
    const maxDelay = 16000; // 16 seconds
    const delay = Math.min(
      baseDelay * Math.pow(2, reconnectAttemptsRef.current),
      maxDelay
    );
    return delay;
  }, []);

  /**
   * Add a log entry
   */
  const addLog = useCallback((message, level = 'info', stage = null) => {
    const logEntry = {
      id: `log-${Date.now()}-${Math.random()}`,
      message,
      level,
      stage,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [...prev, logEntry]);
  }, []);

  /**
   * Handle incoming WebSocket message
   */
  const handleMessage = useCallback((event) => {
    try {
      const message = JSON.parse(event.data);
      const { type, stage, data, timestamp } = message;

      switch (type) {
        case 'connected':
          setConnectionState(ConnectionState.CONNECTED);
          addLog('Connected to verification stream', 'success');
          break;

        case 'stage_start':
          setCurrentStage(stage);
          setProgress(data.progress || 0);
          addLog(`Starting ${stage}`, 'info', stage);
          break;

        case 'stage_complete':
          setCurrentStage(stage);
          setProgress(data.progress || 0);
          addLog(`Completed ${stage}`, 'success', stage);
          
          // Store stage results
          if (data.details) {
            setResults(prev => ({
              ...prev,
              [stage]: data.details
            }));
          }
          
          // Call callback
          if (onStageComplete) {
            onStageComplete(stage, data.details);
          }
          break;

        case 'log':
          addLog(data.message, data.level || 'info', stage);
          if (data.progress !== undefined) {
            setProgress(data.progress);
          }
          break;

        case 'error':
          const errorMsg = data.message || 'Unknown error';
          setError(errorMsg);
          setVerificationStatus(VerificationStatus.FAILED);
          addLog(errorMsg, 'error', stage);
          
          if (onError) {
            onError(new Error(errorMsg));
          }
          break;

        case 'complete':
          setVerificationStatus(VerificationStatus.COMPLETED);
          setProgress(1.0);
          addLog('Verification complete', 'success');
          
          if (onComplete) {
            onComplete(results);
          }
          break;

        default:
          console.warn('Unknown message type:', type);
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
      addLog('Failed to parse message from server', 'error');
    }
  }, [addLog, onStageComplete, onComplete, onError, results]);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (!prId) {
      console.warn('Cannot connect: prId is required');
      return;
    }

    // Close existing connection
    if (wsRef.current) {
      isManualCloseRef.current = true;
      wsRef.current.close();
    }

    try {
      setConnectionState(ConnectionState.CONNECTING);
      addLog('Connecting to verification server...', 'info');

      const ws = new WebSocket(`${WS_URL}/ws/verify/${prId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState(ConnectionState.CONNECTED);
        setVerificationStatus(VerificationStatus.RUNNING);
        reconnectAttemptsRef.current = 0;
        isManualCloseRef.current = false;
        addLog('Connected successfully', 'success');
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setConnectionState(ConnectionState.ERROR);
        addLog('Connection error occurred', 'error');
      };

      ws.onclose = (event) => {
        setConnectionState(ConnectionState.DISCONNECTED);
        
        // Only attempt reconnection if not manually closed and auto-reconnect is enabled
        if (!isManualCloseRef.current && autoReconnect && reconnectAttemptsRef.current < maxRetries) {
          const delay = getReconnectDelay();
          reconnectAttemptsRef.current += 1;
          
          setConnectionState(ConnectionState.RECONNECTING);
          addLog(
            `Connection lost. Reconnecting in ${delay / 1000}s (attempt ${reconnectAttemptsRef.current}/${maxRetries})...`,
            'warning'
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxRetries) {
          setError('Maximum reconnection attempts reached');
          setVerificationStatus(VerificationStatus.FAILED);
          addLog('Failed to reconnect after maximum attempts', 'error');
        }
      };

    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setConnectionState(ConnectionState.ERROR);
      setError(err.message);
      addLog(`Connection failed: ${err.message}`, 'error');
    }
  }, [prId, handleMessage, autoReconnect, maxRetries, getReconnectDelay, addLog]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    isManualCloseRef.current = true;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionState(ConnectionState.DISCONNECTED);
    addLog('Disconnected from server', 'info');
  }, [addLog]);

  /**
   * Reset verification state
   */
  const reset = useCallback(() => {
    setVerificationStatus(VerificationStatus.IDLE);
    setCurrentStage(null);
    setProgress(0);
    setLogs([]);
    setResults({});
    setError(null);
    reconnectAttemptsRef.current = 0;
  }, []);

  /**
   * Start verification (connect if not connected)
   */
  const start = useCallback(() => {
    reset();
    connect();
  }, [reset, connect]);

  // Auto-start on mount if enabled
  useEffect(() => {
    if (autoStart && prId) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [prId, autoStart]); // Only re-run if prId or autoStart changes

  // Send periodic ping to keep connection alive
  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED && wsRef.current) {
      const pingInterval = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send('ping');
        }
      }, 30000); // Ping every 30 seconds

      return () => clearInterval(pingInterval);
    }
  }, [connectionState]);

  return {
    // State
    connectionState,
    verificationStatus,
    currentStage,
    progress,
    logs,
    results,
    error,
    
    // Computed state
    isConnected: connectionState === ConnectionState.CONNECTED,
    isConnecting: connectionState === ConnectionState.CONNECTING,
    isReconnecting: connectionState === ConnectionState.RECONNECTING,
    isRunning: verificationStatus === VerificationStatus.RUNNING,
    isCompleted: verificationStatus === VerificationStatus.COMPLETED,
    isFailed: verificationStatus === VerificationStatus.FAILED,
    
    // Control functions
    connect,
    disconnect,
    reset,
    start
  };
}

/**
 * Hook for fetching verification status via polling (fallback for WebSocket)
 * Use this when WebSocket is not available or as a backup
 */
export function useVerificationPolling(jobId, options = {}) {
  const {
    interval = 1000,
    onComplete,
    onError,
    enabled = true
  } = options;

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !jobId) return;

    let intervalId;
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${WS_URL.replace('ws://', 'http://')}/api/verify/${jobId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (isMounted) {
          setStatus(data);
          setError(null);

          // Check if completed
          if (data.status === 'completed' && onComplete) {
            onComplete(data.result);
            clearInterval(intervalId);
          } else if (data.status === 'failed' && onError) {
            onError(new Error(data.result?.error || 'Verification failed'));
            clearInterval(intervalId);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          if (onError) {
            onError(err);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchStatus();

    // Set up polling
    intervalId = setInterval(fetchStatus, interval);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [jobId, interval, enabled, onComplete, onError]);

  return { status, loading, error };
}

export default useVerificationStream;

// Made with Bob
