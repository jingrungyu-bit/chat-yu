import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectionStatus, ServerMessage } from '../types';
import { WS_ENDPOINT, MAX_RETRY_ATTEMPTS } from '../config';

const BASE_DELAY = 2000;
const MAX_DELAY = 30000;

export function useWebSocket(
  callsign: string,
  onMessage: (msg: ServerMessage) => void,
) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [failedAttempts, setFailedAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const activeRef = useRef(true);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Forward-declared so onclose can always call the current version
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (!activeRef.current || !WS_ENDPOINT) {
      if (!WS_ENDPOINT) setStatus('disconnected');
      return;
    }
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    const url = `${WS_ENDPOINT}?callsign=${encodeURIComponent(callsign)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!activeRef.current) return;
      retryCountRef.current = 0;
      setFailedAttempts(0);
      setStatus('connected');
    };

    ws.onmessage = (e: MessageEvent) => {
      if (!activeRef.current) return;
      try {
        onMessageRef.current(JSON.parse(e.data as string) as ServerMessage);
      } catch { /* ignore malformed frames */ }
    };

    ws.onclose = () => {
      if (!activeRef.current) return;
      retryCountRef.current += 1;
      const count = retryCountRef.current;
      setFailedAttempts(count);

      if (count > MAX_RETRY_ATTEMPTS) {
        setStatus('disconnected');
        return;
      }

      setStatus('reconnecting');
      const delay = Math.min(BASE_DELAY * Math.pow(2, count - 1), MAX_DELAY);
      retryTimerRef.current = setTimeout(() => connectRef.current(), delay);
    };

    ws.onerror = () => { /* errors are followed by close; handled there */ };
  }, [callsign]);

  connectRef.current = connect;

  const disconnect = useCallback(() => {
    activeRef.current = false;
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    wsRef.current?.close();
    setStatus('disconnected');
  }, []);

  const reconnect = useCallback(() => {
    activeRef.current = true;
    retryCountRef.current = 0;
    setFailedAttempts(0);
    setStatus('connecting');
    connect();
  }, [connect]);

  const sendMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'sendMessage', text }));
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    connect();
    return () => {
      activeRef.current = false;
      if (retryTimerRef.current !== null) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { status, failedAttempts, sendMessage, disconnect, reconnect };
}
