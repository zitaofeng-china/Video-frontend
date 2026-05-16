import { useCallback } from 'react';
import { RemoteUser, VideoChatState } from '../types';
import { getErrorMessage } from '../utils/errorHandler';

interface UseKickHandlerProps {
  userId: string;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  pcRefs: React.MutableRefObject<Map<string, RTCPeerConnection>>;
  statsIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
  setState: React.Dispatch<React.SetStateAction<VideoChatState>>;
  stopMonitoring: (userId: string) => void;
  addLog: (message: string) => void;
}

interface HandleKickedMessageOptions {
  remoteUsers: RemoteUser[];
  screenStream: MediaStream | null;
  wsRef: React.MutableRefObject<WebSocket | null>;
}

export const useKickHandler = ({
  userId,
  localStreamRef,
  pcRefs,
  statsIntervalRef,
  setState,
  stopMonitoring,
  addLog
}: UseKickHandlerProps) => {
  const handleKickedMessage = useCallback(async ({
    remoteUsers,
    screenStream,
    wsRef
  }: HandleKickedMessageOptions) => {
    addLog('❌您已被管理员踢出房间');

    try {
      stopMonitoring(userId);
      remoteUsers.forEach(user => {
        if (user.userId) {
          stopMonitoring(user.userId);
        }
      });
      addLog('✅已停止音频监听');

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          addLog(`🛑 已停止本地轨道 ${track.kind}`);
        });
        localStreamRef.current = null;
      }

      if (screenStream) {
        screenStream.getTracks().forEach(track => {
          track.stop();
          addLog(`🛑 已停止屏幕共享轨道 ${track.kind}`);
        });
      }

      const pcCount = pcRefs.current.size;
      pcRefs.current.forEach((pc, remoteUserId) => {
        pc.close();
        addLog(`🔌 已关闭与 ${remoteUserId} 的连接`);
      });
      pcRefs.current.clear();
      addLog(`✅已关闭所有${pcCount} 个PeerConnection`);

      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
        addLog('✅已清除统计定时器');
      }

      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.close(4000, 'Kicked by admin');
        addLog('✅已关闭WebSocket 连接');
      }

      setState(prev => ({
        ...prev,
        wsConnected: false,
        iceState: 'disconnected',
        connectionStatus: '已断开连接',
        remoteUsers: []
      }));

      addLog('✅资源清理完成');
      await new Promise(resolve => setTimeout(resolve, 500));

      alert('您已被管理员踢出房间，即将返回首页');
      window.location.href = '/';
    } catch (error) {
      console.error('踢出用户时发生错误', error);
      addLog('❌踢出过程中出现错误: ' + getErrorMessage(error));
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    }
  }, [addLog, localStreamRef, pcRefs, setState, statsIntervalRef, stopMonitoring, userId]);

  return { handleKickedMessage };
};
