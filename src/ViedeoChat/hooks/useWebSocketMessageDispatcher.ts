import { useCallback } from 'react';
import { RemoteUser, SignalMessage } from '../types';
import { getErrorMessage } from '../utils/errorHandler';
import { normalizeSignalMessage } from '../utils/signalMessage';

interface KickContext {
  remoteUsers: RemoteUser[];
  screenStream: MediaStream | null;
  wsRef: React.MutableRefObject<WebSocket | null>;
}

interface UseWebSocketMessageDispatcherProps {
  mountedRef: React.MutableRefObject<boolean>;
  addLog: (message: string) => void;
  handlePeerSignalingMessage: (message: SignalMessage) => Promise<boolean>;
  handleRoomEventMessage: (message: SignalMessage) => boolean;
  handleAdminCommandMessage: (message: SignalMessage) => boolean;
  syncConnectedState: (message: SignalMessage) => void;
  syncRoomState: (message: SignalMessage) => void;
  handleErrorMessage?: (message: SignalMessage) => Promise<void> | void;
  handleKickedMessage: (context: KickContext) => Promise<void>;
  getKickContext: () => KickContext;
}

export const useWebSocketMessageDispatcher = ({
  mountedRef,
  addLog,
  handlePeerSignalingMessage,
  handleRoomEventMessage,
  handleAdminCommandMessage,
  syncConnectedState,
  syncRoomState,
  handleErrorMessage,
  handleKickedMessage,
  getKickContext
}: UseWebSocketMessageDispatcherProps) => {
  const handleWebSocketMessage = useCallback(async (event: MessageEvent) => {
    if (!mountedRef.current) {
      return;
    }

    try {
      const rawMessage = JSON.parse(event.data);
      const message = normalizeSignalMessage(rawMessage);

      if (!message) {
        addLog('Ignored invalid or unsupported signaling message');
        return;
      }

      addLog(`Received signaling message: ${message.type} from ${message.sender || message.userId || 'server'}`);

      if (await handlePeerSignalingMessage(message)) {
        return;
      }

      if (handleRoomEventMessage(message)) {
        return;
      }

      if (handleAdminCommandMessage(message)) {
        return;
      }

      switch (message.type) {
        case 'connected':
          syncConnectedState(message);
          break;
        case 'room-state':
          syncRoomState(message);
          break;
        case 'kicked':
          await handleKickedMessage(getKickContext());
          break;
        case 'error':
          if (handleErrorMessage) {
            await handleErrorMessage(message);
          } else {
            addLog(`Server error: ${message.message || 'Unknown error'}`);
          }
          break;
        default:
          addLog(`Unhandled signaling message type: ${message.type}`);
      }
    } catch (error) {
      addLog('Failed to process signaling message: ' + getErrorMessage(error));
    }
  }, [
    addLog,
    getKickContext,
    handleAdminCommandMessage,
    handleKickedMessage,
    handleErrorMessage,
    handlePeerSignalingMessage,
    handleRoomEventMessage,
    mountedRef,
    syncConnectedState,
    syncRoomState
  ]);

  return { handleWebSocketMessage };
};
