import { useEffect, useRef, useState, useCallback } from 'react';
import { ActiveSpeakerManager } from '../utils/activeSpeakerManager';
import { AudioAnalyzer } from '../utils/audioAnalyzer';

interface UseActiveSpeakerOptions {
  maxActiveSpeakers?: number;
  enabled?: boolean;
  updateInterval?: number;
}

export function useActiveSpeaker(options: UseActiveSpeakerOptions = {}) {
  const {
    maxActiveSpeakers = 9,
    enabled = true,
    updateInterval = 500,
  } = options;

  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const speakerManagerRef = useRef<ActiveSpeakerManager | null>(null);
  const audioAnalyzersRef = useRef<Map<string, AudioAnalyzer>>(new Map());
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    speakerManagerRef.current = new ActiveSpeakerManager(maxActiveSpeakers);
    const analyzers = audioAnalyzersRef.current;

    return () => {
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
      }

      analyzers.forEach(analyzer => analyzer.dispose());
      analyzers.clear();

      speakerManagerRef.current?.clear();
      speakerManagerRef.current = null;
    };
  }, [enabled, maxActiveSpeakers]);

  useEffect(() => {
    if (!enabled || !speakerManagerRef.current) return;

    updateTimerRef.current = setInterval(() => {
      const speakers = speakerManagerRef.current?.getActiveSpeakers() || [];
      setActiveSpeakers(speakers);
    }, updateInterval);

    return () => {
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    };
  }, [enabled, updateInterval]);

  const startMonitoring = useCallback((userId: string, stream: MediaStream) => {
    if (!enabled || !speakerManagerRef.current) return;

    const existingAnalyzer = audioAnalyzersRef.current.get(userId);
    if (existingAnalyzer) {
      existingAnalyzer.dispose();
      audioAnalyzersRef.current.delete(userId);
      speakerManagerRef.current.removeSpeaker(userId);
    }

    if (stream.getAudioTracks().length === 0) {
      return;
    }

    const analyzer = new AudioAnalyzer();
    const started = analyzer.startAnalyzing(stream, (level) => {
      speakerManagerRef.current?.updateAudioLevel(userId, level);
    });

    if (started) {
      audioAnalyzersRef.current.set(userId, analyzer);
    } else {
      analyzer.dispose();
    }
  }, [enabled]);

  const stopMonitoring = useCallback((userId: string) => {
    const analyzer = audioAnalyzersRef.current.get(userId);
    if (analyzer) {
      analyzer.dispose();
      audioAnalyzersRef.current.delete(userId);
    }

    speakerManagerRef.current?.removeSpeaker(userId);
  }, []);

  const setConnectionCallbacks = useCallback((
    _onConnect: (userId: string) => Promise<void>,
    _onDisconnect: (userId: string) => void
  ) => {
    // Active speaker detection is display-only. Room membership owns peer connections.
  }, []);

  const updateActiveConnections = useCallback(async () => {
    // Kept for API compatibility with the existing VideoChat composition.
  }, []);

  const getConnectionCount = useCallback(() => {
    return 0;
  }, []);

  return {
    activeSpeakers,
    startMonitoring,
    stopMonitoring,
    setConnectionCallbacks,
    updateActiveConnections,
    getConnectionCount,
  };
}
