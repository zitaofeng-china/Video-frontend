// useRecording.ts - Hook for recording video conference sessions
import { useState, useCallback, useRef } from 'react';
import { RecordingState, RecordingConfig } from '../types';

export interface UseRecordingProps {
  roomId: string;
  getCurrentStream: () => MediaStream | null;
  getCurrentEncodingBitrate: () => number;
  addLog: (message: string) => void;
}

export const useRecording = ({
  roomId,
  getCurrentStream,
  getCurrentEncodingBitrate,
  addLog
}: UseRecordingProps) => {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    recorder: null,
    chunks: [],
    startTime: 0,
    currentStream: null
  });

  const recordersRef = useRef<MediaRecorder[]>([]);
  const allChunksRef = useRef<Blob[]>([]);

  /**
   * Check if MediaRecorder is supported
   */
  const isRecordingSupported = useCallback((): boolean => {
    if (!window.MediaRecorder) {
      addLog("❌ 浏览器不支持录制功能");
      addLog("💡 请使用 Chrome, Firefox, 或 Edge 浏览器");
      return false;
    }

    // Check for WebM support
    const mimeType = 'video/webm;codecs=vp8,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      addLog("❌ 浏览器不支持 WebM 格式录制");
      return false;
    }

    return true;
  }, [addLog]);

  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    if (!isRecordingSupported()) {
      return;
    }

    const stream = getCurrentStream();
    if (!stream) {
      addLog("❌ 无法开始录制: 没有可用的媒体流");
      return;
    }

    try {
      addLog("🎥 开始录制...");

      const config: RecordingConfig = {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: getCurrentEncodingBitrate(),
        audioBitsPerSecond: 128000,
        timeslice: 1000
      };

      const recorder = new MediaRecorder(stream, {
        mimeType: config.mimeType,
        videoBitsPerSecond: config.videoBitsPerSecond,
        audioBitsPerSecond: config.audioBitsPerSecond
      });

      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
          allChunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        addLog("✅ 录制已开始");
      };

      recorder.onstop = () => {
        addLog("⏹️ 录制已停止");
      };

      recorder.onerror = (event: Event) => {
        const error = (event as any).error;
        addLog(`❌ 录制错误: ${error?.message || '未知错误'}`);
      };

      recorder.start(config.timeslice);
      recordersRef.current.push(recorder);

      setRecordingState({
        isRecording: true,
        isPaused: false,
        recorder,
        chunks,
        startTime: Date.now(),
        currentStream: stream
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`❌ 启动录制失败: ${errorMessage}`);
    }
  }, [isRecordingSupported, getCurrentStream, getCurrentEncodingBitrate, addLog]);

  /**
   * Stop recording and download file
   */
  const stopRecording = useCallback(() => {
    if (!recordingState.isRecording || !recordingState.recorder) {
      return;
    }

    addLog("⏹️ 正在停止录制...");

    // Stop all recorders
    recordersRef.current.forEach(recorder => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    });

    // Wait a bit for all data to be collected
    setTimeout(() => {
      // Concatenate all chunks
      const blob = new Blob(allChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `meeting-${roomId}-${timestamp}.webm`;
      
      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Cleanup
      URL.revokeObjectURL(url);
      
      const duration = Date.now() - recordingState.startTime;
      const durationSeconds = (duration / 1000).toFixed(1);
      addLog(`✅ 录制已保存: ${filename} (时长: ${durationSeconds}秒)`);
      
      // Reset state
      recordersRef.current = [];
      allChunksRef.current = [];
      
      setRecordingState({
        isRecording: false,
        isPaused: false,
        recorder: null,
        chunks: [],
        startTime: 0,
        currentStream: null
      });
    }, 500);
  }, [recordingState, roomId, addLog]);

  /**
   * Switch recording stream (for screen share)
   */
  const switchRecordingStream = useCallback((newStream: MediaStream) => {
    if (!recordingState.isRecording || !recordingState.recorder) {
      return;
    }

    addLog("🔄 切换录制流...");

    try {
      // Stop current recorder
      if (recordingState.recorder.state !== 'inactive') {
        recordingState.recorder.stop();
      }

      // Create new recorder with new stream
      const config: RecordingConfig = {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: getCurrentEncodingBitrate(),
        audioBitsPerSecond: 128000,
        timeslice: 1000
      };

      const newRecorder = new MediaRecorder(newStream, {
        mimeType: config.mimeType,
        videoBitsPerSecond: config.videoBitsPerSecond,
        audioBitsPerSecond: config.audioBitsPerSecond
      });

      newRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          allChunksRef.current.push(event.data);
        }
      };

      newRecorder.onerror = (event: Event) => {
        const error = (event as any).error;
        addLog(`❌ 录制错误: ${error?.message || '未知错误'}`);
      };

      newRecorder.start(config.timeslice);
      recordersRef.current.push(newRecorder);

      setRecordingState(prev => ({
        ...prev,
        recorder: newRecorder,
        currentStream: newStream
      }));

      addLog("✅ 录制流已切换");

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`❌ 切换录制流失败: ${errorMessage}`);
    }
  }, [recordingState, getCurrentEncodingBitrate, addLog]);

  /**
   * Pause recording
   */
  const pauseRecording = useCallback(() => {
    if (!recordingState.isRecording || !recordingState.recorder) {
      return;
    }

    if (recordingState.recorder.state === 'recording') {
      recordingState.recorder.pause();
      setRecordingState(prev => ({ ...prev, isPaused: true }));
      addLog("⏸️ 录制已暂停");
    }
  }, [recordingState, addLog]);

  /**
   * Resume recording
   */
  const resumeRecording = useCallback(() => {
    if (!recordingState.isRecording || !recordingState.recorder) {
      return;
    }

    if (recordingState.recorder.state === 'paused') {
      recordingState.recorder.resume();
      setRecordingState(prev => ({ ...prev, isPaused: false }));
      addLog("▶️ 录制已恢复");
    }
  }, [recordingState, addLog]);

  return {
    isRecording: recordingState.isRecording,
    isPaused: recordingState.isPaused,
    startTime: recordingState.startTime,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    switchRecordingStream,
    isRecordingSupported
  };
};
