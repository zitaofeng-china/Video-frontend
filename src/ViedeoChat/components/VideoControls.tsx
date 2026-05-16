import React from 'react';
import { useVideoChat } from '../context/VideoChatContext';
import RecordingControls from './RecordingControls';

const VideoControls: React.FC = () => {
  const { state, setState, toggleVideo, toggleAudio, toggleScreenShare, isControlLocked } = useVideoChat();

  const isAudioLocked = isControlLocked ? isControlLocked('audio') : false;
  const isVideoLocked = isControlLocked ? isControlLocked('video') : false;
  const screenSharingUser = state.remoteUsers.find(user => user.isScreenSharing);
  const isScreenShareLocked = !state.isScreenSharing && !!screenSharingUser;

  return (
    <div className="control-buttons">
      <button
        onClick={async () => {
          const newVideoState = !state.isVideoEnabled;
          const result = await toggleVideo(newVideoState);
          if (!result || result.ok) {
            setState(prev => ({ ...prev, isVideoEnabled: result?.enabled ?? newVideoState }));
          }
        }}
        className={`control-button ${state.isVideoEnabled ? 'video-enabled' : 'video-disabled'}`}
        title={isVideoLocked ? 'Video control is locked by admin' : (state.isVideoEnabled ? 'Turn camera off' : 'Turn camera on')}
        aria-label={state.isVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
        disabled={isVideoLocked}
      >
        {state.isVideoEnabled ? 'CAM' : 'NO CAM'}
      </button>

      <button
        onClick={async () => {
          const newAudioState = !state.isAudioEnabled;
          const result = await toggleAudio(newAudioState);
          if (!result || result.ok) {
            setState(prev => ({ ...prev, isAudioEnabled: result?.enabled ?? newAudioState }));
          }
        }}
        className={`control-button ${state.isAudioEnabled ? 'audio-enabled' : 'audio-disabled'}`}
        title={isAudioLocked ? 'Audio control is locked by admin' : (state.isAudioEnabled ? 'Mute microphone' : 'Unmute microphone')}
        aria-label={state.isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        disabled={isAudioLocked}
      >
        {state.isAudioEnabled ? 'MIC' : 'MUTED'}
      </button>

      <button
        onClick={toggleScreenShare}
        className={`control-button ${state.isScreenSharing ? 'screen-sharing' : ''}`}
        title={isScreenShareLocked ? `User ${screenSharingUser?.userId} is sharing screen` : (state.isScreenSharing ? 'Stop screen share' : 'Start screen share')}
        aria-label={isScreenShareLocked ? 'Another user is sharing screen' : (state.isScreenSharing ? 'Stop screen share' : 'Start screen share')}
        disabled={isScreenShareLocked}
      >
        {state.isScreenSharing ? 'STOP SHARE' : 'SHARE'}
      </button>

      <RecordingControls />

      {(isAudioLocked || isVideoLocked) && (
        <div className="admin-action-lock-indicator" title="Admin control is active. Try again later.">
          Locked: {isAudioLocked && isVideoLocked ? 'audio/video' : isAudioLocked ? 'audio' : 'video'}
        </div>
      )}
    </div>
  );
};

export default VideoControls;
