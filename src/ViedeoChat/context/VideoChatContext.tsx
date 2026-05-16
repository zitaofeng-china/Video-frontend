// src/ViedeoChat/context/VideoChatContext.tsx
import React, { createContext, useContext } from 'react';
import { RemoteUser, VideoChatState } from '../types';

export interface VideoChatContextType {
  state: VideoChatState;
  setState: React.Dispatch<React.SetStateAction<VideoChatState>>;
  addLog: (message: string) => void;
  updateStats: (stats: Partial<VideoChatState['stats']>) => void;
  updateRemoteUsers: (updater: (prev: RemoteUser[]) => RemoteUser[]) => void;
  sendMessage: (message: any) => void;
  toggleVideo: (enabled: boolean) => void | Promise<{ ok: boolean; enabled: boolean; reason?: string } | void>;
  toggleAudio: (enabled: boolean) => void | Promise<{ ok: boolean; enabled: boolean; reason?: string } | void>;
  toggleScreenShare: () => void | Promise<void>;
  shareRoom: () => void;
  kickUser: (targetUserId: string) => void;
  transferAdmin: (newAdminId: string) => void;
  muteAll: () => void;
  unmuteAll: () => void;
  disableAllVideo: () => void;
  enableAllVideo: () => void;
  pcRefs: React.RefObject<Map<string, RTCPeerConnection>>;
  localStreamRef: React.RefObject<MediaStream | null>;
  getEncodingParameters: (remoteUserId: string) => any;
  // 新增功能
  isControlLocked?: (controlType: 'audio' | 'video') => boolean;
  isRecording?: boolean;
  isRecordingPaused?: boolean;
  recordingStartTime?: number;
  startRecording?: () => void;
  stopRecording?: () => void;
  pauseRecording?: () => void;
  resumeRecording?: () => void;
  isReconnecting?: boolean;
  reconnectAttemptCount?: number;
}

export const VideoChatContext = createContext<VideoChatContextType | undefined>(undefined);

export const useVideoChat = (): VideoChatContextType => {
  const context = useContext(VideoChatContext);
  
  if (!context) {
    throw new Error('useVideoChat must be used within a VideoChatProvider');
  }

  return context;
};
