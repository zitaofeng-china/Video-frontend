import { useState, useCallback, useRef } from 'react';
import { getErrorMessage } from '../utils/errorHandler';
import { ScreenShareState } from '../types';

interface UseScreenShareProps {
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  localStreamRef: React.RefObject<MediaStream | null>;
  pcRefs: React.RefObject<Map<string, RTCPeerConnection>>;
  addLog: (message: string) => void;
  onScreenShareStart?: () => void;
  onScreenShareStop?: () => void;
  onPeerNeedsRenegotiation?: (remoteUserId: string) => void | Promise<void>;
}

export const useScreenShare = ({
  localVideoRef,
  localStreamRef,
  pcRefs,
  addLog,
  onScreenShareStart,
  onScreenShareStop,
  onPeerNeedsRenegotiation
}: UseScreenShareProps) => {
  const [screenShareState, setScreenShareState] = useState<ScreenShareState>({
    isScreenSharing: false,
    screenStream: null,
    originalCameraStream: null
  });

  const screenShareStateRef = useRef(screenShareState);
  screenShareStateRef.current = screenShareState;

  const publishVideoTrack = useCallback(async (
    newVideoTrack: MediaStreamTrack,
    streamForTrack?: MediaStream,
    renegotiateExistingSenders = false
  ): Promise<void> => {
    const startTime = Date.now();
    const pcCount = pcRefs.current?.size || 0;
    addLog(`Publishing video track to ${pcCount} peer connections`);

    const publishPromises: Promise<void>[] = [];
    const mediaStream = streamForTrack || new MediaStream([newVideoTrack]);

    pcRefs.current?.forEach((pc, remoteUserId) => {
      const videoSender = pc.getSenders().find((sender) => sender.track?.kind === 'video');

      if (videoSender) {
        publishPromises.push(
          videoSender.replaceTrack(newVideoTrack)
            .then(async () => {
              addLog(`Replaced video track for ${remoteUserId}`);

              if (renegotiateExistingSenders && onPeerNeedsRenegotiation) {
                await onPeerNeedsRenegotiation(remoteUserId);
                addLog(`Renegotiated video track for ${remoteUserId}`);
              }
            })
            .catch((err) => {
              addLog(`Failed to replace video track for ${remoteUserId}: ${getErrorMessage(err)}`);
            })
        );
        return;
      }

      if (typeof pc.addTrack !== 'function') {
        addLog(`${remoteUserId} has no video sender and cannot add a new track`);
        return;
      }

      pc.addTrack(newVideoTrack, mediaStream);
      addLog(`${remoteUserId} has no video sender; added video track and will renegotiate`);

      if (onPeerNeedsRenegotiation) {
        publishPromises.push(
          Promise.resolve(onPeerNeedsRenegotiation(remoteUserId))
            .catch((err) => {
              addLog(`Renegotiation failed for ${remoteUserId}: ${getErrorMessage(err)}`);
            })
        );
      }
    });

    await Promise.allSettled(publishPromises);

    const elapsed = Date.now() - startTime;
    addLog(`Video track replacement complete in ${elapsed}ms`);
  }, [pcRefs, addLog, onPeerNeedsRenegotiation]);

  const stopScreenShare = useCallback(async () => {
    addLog('Stopping screen share...');

    const currentState = screenShareStateRef.current;

    if (currentState.screenStream) {
      currentState.screenStream.getTracks().forEach((track) => {
        track.stop();
        addLog(`Stopped screen share track: ${track.kind}`);
      });
    }

    const cameraStream = currentState.originalCameraStream || localStreamRef.current;

    if (cameraStream && localVideoRef.current) {
      localVideoRef.current.srcObject = cameraStream;
      localVideoRef.current.classList.remove('screen-sharing');
      addLog('Local video restored to camera stream');

      const videoTracks = cameraStream.getVideoTracks();
      if (videoTracks.length > 0) {
        await publishVideoTrack(videoTracks[0], cameraStream, true);
      } else {
        addLog('Camera stream has no available video track');
      }
    } else {
      addLog('Cannot restore camera stream: local stream or video element is missing');
    }

    setScreenShareState({
      isScreenSharing: false,
      screenStream: null,
      originalCameraStream: null
    });

    addLog('Screen share stopped');

    if (onScreenShareStop) {
      onScreenShareStop();
    }
  }, [localVideoRef, localStreamRef, publishVideoTrack, addLog, onScreenShareStop]);

  const startScreenShare = useCallback(async () => {
    try {
      addLog('Requesting screen share permission...');

      const originalStream = localStreamRef.current;
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      addLog(`Got screen share stream with ${screenStream.getVideoTracks().length} video tracks`);

      if (originalStream) {
        originalStream.getAudioTracks().forEach((track) => {
          screenStream.addTrack(track);
          addLog('Added microphone audio track to screen share stream');
        });
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
        localVideoRef.current.classList.add('screen-sharing');
        addLog('Local video switched to screen share stream');
      }

      const videoTracks = screenStream.getVideoTracks();
      if (videoTracks.length > 0) {
        await publishVideoTrack(videoTracks[0], screenStream, true);
      }

      setScreenShareState({
        isScreenSharing: true,
        screenStream,
        originalCameraStream: originalStream
      });

      addLog('Screen share started');

      if (onScreenShareStart) {
        onScreenShareStart();
      }

      videoTracks[0].onended = () => {
        addLog('User stopped screen sharing');
        stopScreenShare();
      };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      addLog(`Screen share failed: ${errorMsg}`);

      if (errorMsg.includes('Permission denied') || errorMsg.includes('NotAllowedError')) {
        addLog('User denied screen share permission');
      } else if (errorMsg.includes('NotFoundError')) {
        addLog('No shareable screen was found');
      }
    }
  }, [localVideoRef, localStreamRef, publishVideoTrack, addLog, onScreenShareStart, stopScreenShare]);

  const toggleScreenShare = useCallback(async () => {
    if (screenShareStateRef.current.isScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [startScreenShare, stopScreenShare]);

  const isScreenSharing = useCallback((): boolean => {
    return screenShareStateRef.current.isScreenSharing;
  }, []);

  return {
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    isScreenSharing,
    screenShareState,
    replaceVideoTrack: publishVideoTrack
  };
};
