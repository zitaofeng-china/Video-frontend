import React from 'react';
import { useVideoChat } from '../context/VideoChatContext';

const RecordingControls: React.FC = () => {
  const {
    isRecording,
    isRecordingPaused,
    recordingStartTime,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording
  } = useVideoChat();

  const [, forceTick] = React.useState(0);

  React.useEffect(() => {
    if (!isRecording || isRecordingPaused) {
      return;
    }

    const interval = window.setInterval(() => {
      forceTick((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRecording, isRecordingPaused]);

  if (!startRecording || !stopRecording) {
    return null;
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const elapsedSeconds = recordingStartTime
    ? Math.max(0, Math.floor((Date.now() - recordingStartTime) / 1000))
    : 0;

  return (
    <div className="recording-controls">
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="control-button recording-start"
          title="开始录制"
          aria-label="开始录制"
        >
          ⏺
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="control-button recording-stop"
          title="停止录制"
          aria-label="停止录制"
        >
          ⏹
        </button>
      )}

      {isRecording && pauseRecording && resumeRecording && (
        <button
          onClick={isRecordingPaused ? resumeRecording : pauseRecording}
          className="control-button"
          title={isRecordingPaused ? '继续录制' : '暂停录制'}
          aria-label={isRecordingPaused ? '继续录制' : '暂停录制'}
        >
          {isRecordingPaused ? '▶' : '⏸'}
        </button>
      )}

      {isRecording && (
        <div className="recording-status">
          <span className="recording-dot"></span>
          <span className="recording-time">
            {isRecordingPaused ? '已暂停' : formatTime(elapsedSeconds)}
          </span>
        </div>
      )}
    </div>
  );
};

export default RecordingControls;
