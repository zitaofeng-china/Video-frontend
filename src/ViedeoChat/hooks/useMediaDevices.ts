// src/ViedeoChat/hooks/useMediaDevices.ts
import { useCallback } from 'react';

interface MediaDeviceConstraints {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
}

interface DisplayMediaStreamConstraints {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
}

export const useMediaDevices = () => {
  const getUserMedia = useCallback(async (constraints: MediaDeviceConstraints) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return { stream, error: null };
    } catch (error) {
      return { stream: null, error: error as Error };
    }
  }, []);

  const getDisplayMedia = useCallback(async (constraints: DisplayMediaStreamConstraints) => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Browser does not support screen sharing');
      }

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      return { stream, error: null };
    } catch (error) {
      return { stream: null, error: error as Error };
    }
  }, []);

  const getMediaWithFallback = useCallback(async () => {
    const cameraResult = await getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    if (cameraResult.stream) {
      return {
        stream: cameraResult.stream,
        type: 'camera' as const,
        error: null
      };
    }

    console.warn('Camera access failed, trying audio-only mode.', cameraResult.error);

    const audioResult = await getUserMedia({
      video: false,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    if (audioResult.stream) {
      console.log('Audio-only stream acquired.');
      return {
        stream: audioResult.stream,
        type: 'audio-only' as const,
        error: null
      };
    }

    // Do not call getDisplayMedia as an automatic fallback when joining a room.
    // Screen sharing must be started only by the explicit screen-share control.
    console.warn('Audio access also failed; not requesting screen share automatically.', audioResult.error);

    return {
      stream: null,
      type: null,
      error: cameraResult.error || audioResult.error || new Error('Unable to access camera or microphone')
    };
  }, [getUserMedia]);

  return {
    getUserMedia,
    getDisplayMedia,
    getMediaWithFallback
  };
};
