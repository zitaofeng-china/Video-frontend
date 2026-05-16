import React, { useRef, useEffect } from 'react';
import { RemoteUser } from '../types';

interface RemoteVideoProps {
  user: RemoteUser;
}

export const RemoteVideo: React.FC<RemoteVideoProps> = ({ user }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    const audioElement = audioRef.current;

    if (videoElement && user.stream) {
      const stream = user.stream;

      const syncMediaElements = () => {
        videoElement.srcObject = stream;
        videoElement.muted = true;
        if (audioElement) {
          audioElement.srcObject = stream;
        }
      };

      const attemptPlayback = () => {
        syncMediaElements();
        void videoElement.play().catch(() => undefined);
        void audioElement?.play().catch(() => undefined);
      };

      const handleTrackListChange = () => {
        attemptPlayback();
      };

      syncMediaElements();
      videoElement.onloadedmetadata = attemptPlayback;
      if (audioElement) {
        audioElement.onloadedmetadata = attemptPlayback;
      }
      stream.addEventListener('addtrack', handleTrackListChange);
      stream.addEventListener('removetrack', handleTrackListChange);
      attemptPlayback();

      stream.getTracks().forEach((track) => {
        track.onunmute = attemptPlayback;
      });

      if (user.isScreenSharing && !videoElement.classList.contains('screen-share-video')) {
        videoElement.classList.add('screen-share-video');
      } else if (!user.isScreenSharing && videoElement.classList.contains('screen-share-video')) {
        videoElement.classList.remove('screen-share-video');
      }

      return () => {
        stream.getTracks().forEach((track) => {
          track.onunmute = null;
        });

        stream.removeEventListener('addtrack', handleTrackListChange);
        stream.removeEventListener('removetrack', handleTrackListChange);
        videoElement.onloadedmetadata = null;
        if (audioElement) {
          audioElement.onloadedmetadata = null;
        }
      };
    }

    return undefined;
  }, [user.stream, user.isScreenSharing]);

  return (
    <div className="video-container remote-video-container">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`remote-video ${user.isScreenSharing ? 'screen-share-video' : ''}`}
        muted
      />
      <audio ref={audioRef} autoPlay playsInline />
      <div className="user-label">
        {user.userId}
        {user.isAdmin && <span className="admin-badge">Admin</span>}
        {user.isScreenSharing && (
          <span className="screen-share-badge">Screen sharing</span>
        )}
      </div>
    </div>
  );
};
