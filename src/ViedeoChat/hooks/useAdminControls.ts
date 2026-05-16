// useAdminControls.ts - Hook for admin global control commands
import { useCallback } from 'react';

export interface UseAdminControlsProps {
  isAdmin: boolean;
  localStreamRef: React.RefObject<MediaStream | null>;
  sendMessage: (message: any) => void;
  setState: (updater: any) => void;
  lockControl: (controlType: 'audio' | 'video', duration?: number) => void;
  addLog: (message: string) => void;
}

export const useAdminControls = ({
  isAdmin,
  localStreamRef,
  sendMessage,
  setState,
  lockControl,
  addLog
}: UseAdminControlsProps) => {

  /**
   * 全员静音
   */
  const muteAll = useCallback(() => {
    if (!isAdmin) {
      addLog("❌ 只有管理员可以执行此操作");
      return;
    }
    
    // 立即对自己执行静音
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = false;
      });
      setState((prev: any) => ({ ...prev, isAudioEnabled: false }));
    }
    
    // 锁定音频控制 2 秒
    lockControl('audio', 2000);
    
    // 发送全员静音消息
    sendMessage({
      type: "mute-all"
    });
    
    addLog("📤 已发送全员静音指令");
  }, [isAdmin, localStreamRef, sendMessage, setState, lockControl, addLog]);

  /**
   * 取消全员静音
   */
  const unmuteAll = useCallback(() => {
    if (!isAdmin) {
      addLog("❌ 只有管理员可以执行此操作");
      return;
    }
    
    // 立即对自己执行取消静音
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = true;
      });
      setState((prev: any) => ({ ...prev, isAudioEnabled: true }));
    }
    
    // 锁定音频控制 2 秒
    lockControl('audio', 2000);
    
    // 发送取消全员静音消息
    sendMessage({
      type: "unmute-all"
    });
    
    addLog("📤 已发送取消全员静音指令");
  }, [isAdmin, localStreamRef, sendMessage, setState, lockControl, addLog]);

  /**
   * 全员关闭摄像头
   */
  const disableAllVideo = useCallback(() => {
    if (!isAdmin) {
      addLog("❌ 只有管理员可以执行此操作");
      return;
    }
    
    // 立即对自己执行关闭摄像头
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = false;
      });
      setState((prev: any) => ({ ...prev, isVideoEnabled: false }));
    }
    
    // 锁定视频控制 2 秒
    lockControl('video', 2000);
    
    // 发送全员关闭摄像头消息
    sendMessage({
      type: "disable-all-video"
    });
    
    addLog("📤 已发送全员关闭摄像头指令");
  }, [isAdmin, localStreamRef, sendMessage, setState, lockControl, addLog]);

  /**
   * 全员开启摄像头
   */
  const enableAllVideo = useCallback(() => {
    if (!isAdmin) {
      addLog("❌ 只有管理员可以执行此操作");
      return;
    }
    
    // 立即对自己执行开启摄像头
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = true;
      });
      setState((prev: any) => ({ ...prev, isVideoEnabled: true }));
    }
    
    // 锁定视频控制 2 秒
    lockControl('video', 2000);
    
    // 发送全员开启摄像头消息
    sendMessage({
      type: "enable-all-video"
    });
    
    addLog("📤 已发送全员开启摄像头指令");
  }, [isAdmin, localStreamRef, sendMessage, setState, lockControl, addLog]);

  return {
    muteAll,
    unmuteAll,
    disableAllVideo,
    enableAllVideo
  };
};
