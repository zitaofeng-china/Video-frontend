import { useState, useCallback } from 'react';
import { RemoteUser, VideoChatState } from '../types';
import { LOG_CONFIG } from '../constants';
import { Logger } from '../utils/logger';

const initialState: VideoChatState = {
  iceState: 'disconnected',
  wsConnected: false,
  connectionLog: [],
  isVideoEnabled: true,
  isAudioEnabled: true,
  remoteUsers: [],
  isScreenSharing: false,
  connectionStatus: '初始化中...',
  stats: {
    bytesReceived: 0,
    bytesSent: 0,
    packetsLost: 0
  },
  isAdmin: false,
  adminId: null
};

export const useVideoChatState = () => {
  const [state, setState] = useState<VideoChatState>(initialState);

  const addLog = useCallback((message: string) => {
    Logger.log(message);
    const timestamp = new Date().toLocaleTimeString();
    setState(prev => ({
      ...prev,
      connectionLog: [
        ...prev.connectionLog.slice(-(LOG_CONFIG.maxLogEntries - 1)),
        `${timestamp}: ${message}`
      ]
    }));
  }, []);

  const updateStats = useCallback((stats: Partial<VideoChatState['stats']>) => {
    setState(prev => ({
      ...prev,
      stats: { ...prev.stats, ...stats }
    }));
  }, []);

  const updateRemoteUsers = useCallback((updater: (prev: RemoteUser[]) => RemoteUser[]) => {
    setState(prev => ({
      ...prev,
      remoteUsers: updater(prev.remoteUsers)
    }));
  }, []);

  return {
    state,
    setState,
    addLog,
    updateStats,
    updateRemoteUsers
  };
};
