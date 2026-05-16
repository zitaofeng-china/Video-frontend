import { useCallback } from 'react';
import { SignalMessage, VideoChatState } from '../types';

interface UseAdminCommandHandlersProps {
  userId: string;
  adminId: string | null;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  setState: React.Dispatch<React.SetStateAction<VideoChatState>>;
  lockControl: (controlType: 'audio' | 'video', duration?: number) => void;
  addLog: (message: string) => void;
  stopScreenShare?: () => Promise<void> | void;
}

export const useAdminCommandHandlers = ({
  userId,
  adminId,
  localStreamRef,
  setState,
  lockControl,
  addLog,
  stopScreenShare
}: UseAdminCommandHandlersProps) => {
  const isFromCurrentAdmin = useCallback((message: SignalMessage) => {
    if (!adminId || message.sender !== adminId) {
      addLog(`忽略非当前管理员发出的管理命令: ${message.type}`);
      return false;
    }
    return true;
  }, [addLog, adminId]);

  const applyAudioCommand = useCallback((message: SignalMessage, enabled: boolean) => {
    if (message.sender === userId || !localStreamRef.current) {
      return;
    }

    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = enabled;
    });

    setState(prev => ({ ...prev, isAudioEnabled: enabled }));
    lockControl('audio', 2000);
    addLog(enabled
      ? `🎤 管理员${message.sender} 已取消全员静音`
      : `🔇 管理员${message.sender} 已静音所有用户`
    );
  }, [addLog, localStreamRef, lockControl, setState, userId]);

  const applyVideoCommand = useCallback(async (message: SignalMessage, enabled: boolean) => {
    if (message.sender === userId || !localStreamRef.current) {
      return;
    }

    if (!enabled && stopScreenShare) {
      await stopScreenShare();
    }

    localStreamRef.current.getVideoTracks().forEach(track => {
      track.enabled = enabled;
    });

    setState(prev => ({ ...prev, isVideoEnabled: enabled }));
    lockControl('video', 2000);
    addLog(enabled
      ? `📹 管理员${message.sender} 已允许所有用户开启摄像头`
      : `📹 管理员${message.sender} 已关闭所有用户的摄像头`
    );
  }, [addLog, localStreamRef, lockControl, setState, stopScreenShare, userId]);

  const handleAdminCommandMessage = useCallback((message: SignalMessage) => {
    switch (message.type) {
      case 'mute-all':
        if (!isFromCurrentAdmin(message)) return true;
        applyAudioCommand(message, false);
        return true;
      case 'unmute-all':
        if (!isFromCurrentAdmin(message)) return true;
        applyAudioCommand(message, true);
        return true;
      case 'disable-all-video':
        if (!isFromCurrentAdmin(message)) return true;
        void applyVideoCommand(message, false);
        return true;
      case 'enable-all-video':
        if (!isFromCurrentAdmin(message)) return true;
        void applyVideoCommand(message, true);
        return true;
      default:
        return false;
    }
  }, [applyAudioCommand, applyVideoCommand, isFromCurrentAdmin]);

  return { handleAdminCommandMessage };
};
