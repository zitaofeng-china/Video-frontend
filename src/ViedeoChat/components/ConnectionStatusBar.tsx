import React from 'react';
import { useVideoChat } from '../context/VideoChatContext';

const normalizeStatusText = (rawStatus: string, isScreenSharing: boolean) => {
  if (!rawStatus) return 'Not connected';

  if (rawStatus.includes('Requested device not found')) {
    return 'Media device error: Requested device not found';
  }

  if (rawStatus.includes('Permission denied by user')) {
    return 'Screen share failed: Permission denied by user';
  }

  if (rawStatus.includes('WebSocket')) {
    return 'WebSocket connected. Waiting for other users...';
  }

  if (isScreenSharing && rawStatus.includes('camera')) {
    return `Screen sharing: ${rawStatus}`;
  }

  return rawStatus;
};

const ConnectionStatusBar: React.FC = () => {
  const { state, shareRoom } = useVideoChat();

  const getStatusColor = () => {
    if (!state.wsConnected) return 'gray';
    switch (state.iceState) {
      case 'connected':
        return 'limegreen';
      case 'checking':
        return 'orange';
      default:
        return 'red';
    }
  };

  return (
    <div className="status-header">
      <div className="status-header-left">
        <div className="connection-status">
          {normalizeStatusText(state.connectionStatus, state.isScreenSharing)}
        </div>
      </div>

      <div className="status-header-center">
        <button className="share-button" onClick={shareRoom}>
          Share room
        </button>
      </div>

      <div className="status-header-right">
        <div className="status-indicator">
          <div
            className="status-light"
            style={{ background: getStatusColor() }}
          ></div>
          <span>
            {state.iceState === 'connected'
              ? 'Connected'
              : state.iceState === 'checking'
                ? 'Connecting...'
                : 'Not connected'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ConnectionStatusBar;
