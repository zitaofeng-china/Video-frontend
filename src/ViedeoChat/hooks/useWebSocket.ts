import { useRef, useEffect, useCallback, useState } from 'react';

interface UseWebSocketProps {
  url: string;
  wsRef?: React.MutableRefObject<WebSocket | null>;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (error: Event) => void;
  onMessage?: (event: MessageEvent) => void;
}

const MAX_RECONNECT_ATTEMPTS = 8;
const MAX_RECONNECT_DELAY = 30000;
const MAX_QUEUED_MESSAGES = 100;
const NORMAL_CLOSE_CODES = new Set([1000, 1001, 1008, 4000]);

export const useWebSocket = ({
  url,
  wsRef: externalWsRef,
  onOpen,
  onClose,
  onError,
  onMessage
}: UseWebSocketProps) => {
  const internalWsRef = useRef<WebSocket | null>(null);
  const wsRef = externalWsRef || internalWsRef;
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const onMessageRef = useRef(onMessage);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const messageQueueRef = useRef<string[]>([]);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttemptCount, setReconnectAttemptCount] = useState(0);

  useEffect(() => {
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
    onMessageRef.current = onMessage;
  }, [onOpen, onClose, onError, onMessage]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const flushQueuedMessages = useCallback((ws: WebSocket) => {
    while (messageQueueRef.current.length > 0 && ws.readyState === WebSocket.OPEN) {
      const queuedMessage = messageQueueRef.current.shift();
      if (queuedMessage) {
        ws.send(queuedMessage);
      }
    }
  }, []);

  const shouldReconnect = useCallback((event: CloseEvent) => {
    return !intentionalCloseRef.current && !NORMAL_CLOSE_CODES.has(event.code);
  }, []);

  const connect = useCallback(() => {
    clearReconnectTimer();

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;

      reconnectAttemptRef.current = 0;
      setReconnectAttemptCount(0);
      setIsReconnecting(false);
      flushQueuedMessages(ws);
      onOpenRef.current?.();
    };

    ws.onclose = (event) => {
      if (wsRef.current !== ws) return;

      wsRef.current = null;
      onCloseRef.current?.(event);

      if (!shouldReconnect(event)) {
        setIsReconnecting(false);
        return;
      }

      if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setIsReconnecting(false);
        return;
      }

      reconnectAttemptRef.current += 1;
      const attempt = reconnectAttemptRef.current;
      const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), MAX_RECONNECT_DELAY);
      const jitter = Math.floor(Math.random() * 300);
      const delay = baseDelay + jitter;

      setIsReconnecting(true);
      setReconnectAttemptCount(attempt);

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = (error) => {
      if (wsRef.current === ws) {
        onErrorRef.current?.(error);
      }
    };

    ws.onmessage = (event) => {
      if (wsRef.current === ws) {
        onMessageRef.current?.(event);
      }
    };
  }, [
    clearReconnectTimer,
    flushQueuedMessages,
    shouldReconnect,
    url,
    wsRef
  ]);

  useEffect(() => {
    intentionalCloseRef.current = false;
    reconnectAttemptRef.current = 0;
    setReconnectAttemptCount(0);
    connect();

    return () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();

      const ws = wsRef.current;
      wsRef.current = null;
      if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        ws.close(1000, 'Component unmounted');
      }
    };
  }, [clearReconnectTimer, connect, wsRef]);

  const sendMessage = useCallback((message: unknown) => {
    const serializedMessage = JSON.stringify(message);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(serializedMessage);
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
      }
      return;
    }

    messageQueueRef.current.push(serializedMessage);
    if (messageQueueRef.current.length > MAX_QUEUED_MESSAGES) {
      messageQueueRef.current.shift();
    }
  }, [wsRef]);

  const reconnect = useCallback(() => {
    intentionalCloseRef.current = false;
    clearReconnectTimer();

    const currentWs = wsRef.current;
    wsRef.current = null;
    if (currentWs && (currentWs.readyState === WebSocket.CONNECTING || currentWs.readyState === WebSocket.OPEN)) {
      currentWs.close(1000, 'Manual reconnect');
    }

    reconnectAttemptRef.current = 0;
    setReconnectAttemptCount(0);
    connect();
  }, [clearReconnectTimer, connect, wsRef]);

  return {
    wsRef,
    sendMessage,
    reconnect,
    isReconnecting,
    reconnectAttemptCount
  };
};
