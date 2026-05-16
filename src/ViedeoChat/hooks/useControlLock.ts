// useControlLock.ts - Hook for managing admin control locks
import { useState, useCallback, useEffect } from 'react';
import { ControlLockState } from '../types';

const LOCK_DURATION = 2000; // 2 seconds

export const useControlLock = () => {
  const [lockState, setLockState] = useState<ControlLockState>({
    audioLocked: false,
    videoLocked: false,
    audioLockTimestamp: 0,
    videoLockTimestamp: 0
  });

  // Lock a specific control type
  const lockControl = useCallback((controlType: 'audio' | 'video', duration: number = LOCK_DURATION) => {
    const now = Date.now();
    
    if (controlType === 'audio') {
      setLockState(prev => ({
        ...prev,
        audioLocked: true,
        audioLockTimestamp: now
      }));
    } else {
      setLockState(prev => ({
        ...prev,
        videoLocked: true,
        videoLockTimestamp: now
      }));
    }
  }, []);

  // Check if a control is locked
  const isControlLocked = useCallback((controlType: 'audio' | 'video'): boolean => {
    const now = Date.now();
    
    if (controlType === 'audio') {
      if (!lockState.audioLocked) return false;
      const elapsed = now - lockState.audioLockTimestamp;
      return elapsed < LOCK_DURATION;
    } else {
      if (!lockState.videoLocked) return false;
      const elapsed = now - lockState.videoLockTimestamp;
      return elapsed < LOCK_DURATION;
    }
  }, [lockState]);

  // Auto-expire locks after duration
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      setLockState(prev => {
        const audioElapsed = now - prev.audioLockTimestamp;
        const videoElapsed = now - prev.videoLockTimestamp;
        
        return {
          ...prev,
          audioLocked: prev.audioLocked && audioElapsed < LOCK_DURATION,
          videoLocked: prev.videoLocked && videoElapsed < LOCK_DURATION
        };
      });
    }, 100); // Check every 100ms for smooth UI updates
    
    return () => clearInterval(interval);
  }, []);

  return {
    lockControl,
    isControlLocked,
    lockState
  };
};
