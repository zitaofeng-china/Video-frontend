import { act, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { useScreenShare } from './useScreenShare';

type MockTrack = {
  kind: 'audio' | 'video';
  stop: jest.Mock<void, []>;
  onended: null | (() => void);
};

type MockStream = {
  addTrack: jest.Mock<void, [MockTrack]>;
  getTracks: jest.Mock<MockTrack[], []>;
  getAudioTracks: jest.Mock<MockTrack[], []>;
  getVideoTracks: jest.Mock<MockTrack[], []>;
};

const mockGetDisplayMedia = jest.fn();

Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getDisplayMedia: mockGetDisplayMedia,
  },
  writable: true,
});

const createMockTrack = (kind: 'audio' | 'video'): MockTrack => ({
  kind,
  stop: jest.fn(),
  onended: null,
});

const createMockStream = (tracks: MockTrack[]): MockStream => ({
  addTrack: jest.fn((track: MockTrack) => {
    tracks.push(track);
  }),
  getTracks: jest.fn(() => tracks),
  getAudioTracks: jest.fn(() => tracks.filter((track) => track.kind === 'audio')),
  getVideoTracks: jest.fn(() => tracks.filter((track) => track.kind === 'video')),
});

describe('useScreenShare', () => {
  let mockLocalVideoRef: RefObject<HTMLVideoElement | null>;
  let mockLocalStreamRef: RefObject<MediaStream | null>;
  let mockPcRefs: RefObject<Map<string, RTCPeerConnection>>;
  let mockAddLog: jest.Mock;
  let mockOnScreenShareStart: jest.Mock;
  let mockOnScreenShareStop: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLocalVideoRef = {
      current: document.createElement('video'),
    };

    const localStream = createMockStream([
      createMockTrack('audio'),
      createMockTrack('video'),
    ]) as unknown as MediaStream;

    mockLocalStreamRef = {
      current: localStream,
    };

    mockPcRefs = {
      current: new Map(),
    };

    mockAddLog = jest.fn();
    mockOnScreenShareStart = jest.fn();
    mockOnScreenShareStop = jest.fn();
  });

  test('initializes with independent state', () => {
    const { result } = renderHook(() =>
      useScreenShare({
        localVideoRef: mockLocalVideoRef,
        localStreamRef: mockLocalStreamRef,
        pcRefs: mockPcRefs,
        addLog: mockAddLog,
        onScreenShareStart: mockOnScreenShareStart,
        onScreenShareStop: mockOnScreenShareStop,
      })
    );

    expect(result.current.screenShareState).toEqual({
      isScreenSharing: false,
      screenStream: null,
      originalCameraStream: null,
    });
    expect(result.current.isScreenSharing()).toBe(false);
  });

  test('requests display media without audio', async () => {
    const screenStream = createMockStream([createMockTrack('video')]) as unknown as MediaStream;
    mockGetDisplayMedia.mockResolvedValue(screenStream);

    const { result } = renderHook(() =>
      useScreenShare({
        localVideoRef: mockLocalVideoRef,
        localStreamRef: mockLocalStreamRef,
        pcRefs: mockPcRefs,
        addLog: mockAddLog,
      })
    );

    await act(async () => {
      await result.current.startScreenShare();
    });

    expect(mockGetDisplayMedia).toHaveBeenCalledWith({
      video: true,
      audio: false,
    });
  });

  test('adds audio track from camera stream to screen share stream', async () => {
    const screenStream = createMockStream([createMockTrack('video')]) as unknown as MediaStream;
    mockGetDisplayMedia.mockResolvedValue(screenStream);

    const { result } = renderHook(() =>
      useScreenShare({
        localVideoRef: mockLocalVideoRef,
        localStreamRef: mockLocalStreamRef,
        pcRefs: mockPcRefs,
        addLog: mockAddLog,
      })
    );

    await act(async () => {
      await result.current.startScreenShare();
    });

    const addTrackMock = (screenStream as unknown as MockStream).addTrack;
    expect(addTrackMock).toHaveBeenCalled();
    expect(addTrackMock.mock.calls[0][0].kind).toBe('audio');
  });

  test('handles screen share without audio track gracefully', async () => {
    const localStreamWithoutAudio = createMockStream([
      createMockTrack('video'),
    ]) as unknown as MediaStream;

    mockLocalStreamRef.current = localStreamWithoutAudio;

    const screenStream = createMockStream([createMockTrack('video')]) as unknown as MediaStream;
    mockGetDisplayMedia.mockResolvedValue(screenStream);

    const { result } = renderHook(() =>
      useScreenShare({
        localVideoRef: mockLocalVideoRef,
        localStreamRef: mockLocalStreamRef,
        pcRefs: mockPcRefs,
        addLog: mockAddLog,
      })
    );

    await act(async () => {
      await result.current.startScreenShare();
    });

    expect(result.current.isScreenSharing()).toBe(true);
    expect(mockAddLog).toHaveBeenCalled();
  });

  test('maintains independent state during screen share', async () => {
    const screenStream = createMockStream([createMockTrack('video')]) as unknown as MediaStream;
    mockGetDisplayMedia.mockResolvedValue(screenStream);

    const { result } = renderHook(() =>
      useScreenShare({
        localVideoRef: mockLocalVideoRef,
        localStreamRef: mockLocalStreamRef,
        pcRefs: mockPcRefs,
        addLog: mockAddLog,
      })
    );

    await act(async () => {
      await result.current.startScreenShare();
    });

    expect(result.current.screenShareState.isScreenSharing).toBe(true);
    expect(result.current.screenShareState.screenStream).toBe(screenStream);
    expect(result.current.screenShareState.originalCameraStream).toBe(mockLocalStreamRef.current);
    expect(result.current.isScreenSharing()).toBe(true);
  });

  test('restores camera stream on stop', async () => {
    const screenStream = createMockStream([createMockTrack('video')]) as unknown as MediaStream;
    mockGetDisplayMedia.mockResolvedValue(screenStream);

    const { result } = renderHook(() =>
      useScreenShare({
        localVideoRef: mockLocalVideoRef,
        localStreamRef: mockLocalStreamRef,
        pcRefs: mockPcRefs,
        addLog: mockAddLog,
      })
    );

    await act(async () => {
      await result.current.startScreenShare();
    });

    await act(async () => {
      await result.current.stopScreenShare();
    });

    expect(mockLocalVideoRef.current?.srcObject).toBe(mockLocalStreamRef.current);
    expect(result.current.screenShareState.isScreenSharing).toBe(false);
    expect(result.current.screenShareState.screenStream).toBe(null);
  });

  test('calls callbacks on screen share start and stop', async () => {
    const screenStream = createMockStream([createMockTrack('video')]) as unknown as MediaStream;
    mockGetDisplayMedia.mockResolvedValue(screenStream);

    const { result } = renderHook(() =>
      useScreenShare({
        localVideoRef: mockLocalVideoRef,
        localStreamRef: mockLocalStreamRef,
        pcRefs: mockPcRefs,
        addLog: mockAddLog,
        onScreenShareStart: mockOnScreenShareStart,
        onScreenShareStop: mockOnScreenShareStop,
      })
    );

    await act(async () => {
      await result.current.startScreenShare();
    });
    expect(mockOnScreenShareStart).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.stopScreenShare();
    });
    expect(mockOnScreenShareStop).toHaveBeenCalledTimes(1);
  });

  test('toggles screen share on and off', async () => {
    const screenStream = createMockStream([createMockTrack('video')]) as unknown as MediaStream;
    mockGetDisplayMedia.mockResolvedValue(screenStream);

    const { result } = renderHook(() =>
      useScreenShare({
        localVideoRef: mockLocalVideoRef,
        localStreamRef: mockLocalStreamRef,
        pcRefs: mockPcRefs,
        addLog: mockAddLog,
      })
    );

    await act(async () => {
      await result.current.toggleScreenShare();
    });
    expect(result.current.isScreenSharing()).toBe(true);

    await act(async () => {
      await result.current.toggleScreenShare();
    });
    expect(result.current.isScreenSharing()).toBe(false);
  });

  test('handles user cancellation gracefully', async () => {
    const error = new Error('Permission denied');
    error.name = 'NotAllowedError';
    mockGetDisplayMedia.mockRejectedValue(error);

    const { result } = renderHook(() =>
      useScreenShare({
        localVideoRef: mockLocalVideoRef,
        localStreamRef: mockLocalStreamRef,
        pcRefs: mockPcRefs,
        addLog: mockAddLog,
      })
    );

    await act(async () => {
      await result.current.startScreenShare();
    });

    expect(mockAddLog).toHaveBeenCalledWith(expect.stringContaining('Permission denied'));
    expect(result.current.isScreenSharing()).toBe(false);
  });

  test('replaceVideoTrack replaces video tracks in all peer connections', async () => {
    const mockReplaceTrack = jest.fn().mockResolvedValue(undefined);
    const mockGetSenders = jest.fn().mockReturnValue([
      {
        track: { kind: 'video' },
        replaceTrack: mockReplaceTrack,
      },
      {
        track: { kind: 'audio' },
        replaceTrack: jest.fn(),
      },
    ]);

    const mockPc1 = { getSenders: mockGetSenders } as unknown as RTCPeerConnection;
    const mockPc2 = { getSenders: mockGetSenders } as unknown as RTCPeerConnection;

    mockPcRefs.current?.set('user1', mockPc1);
    mockPcRefs.current?.set('user2', mockPc2);

    const { result } = renderHook(() =>
      useScreenShare({
        localVideoRef: mockLocalVideoRef,
        localStreamRef: mockLocalStreamRef,
        pcRefs: mockPcRefs,
        addLog: mockAddLog,
      })
    );

    const newVideoTrack = createMockTrack('video') as unknown as MediaStreamTrack;

    await act(async () => {
      await result.current.replaceVideoTrack(newVideoTrack);
    });

    expect(mockReplaceTrack).toHaveBeenCalledTimes(2);
    expect(mockReplaceTrack).toHaveBeenCalledWith(newVideoTrack);
    expect(mockAddLog).toHaveBeenCalledWith(expect.stringContaining('Replaced video track for user1'));
    expect(mockAddLog).toHaveBeenCalledWith(expect.stringContaining('Replaced video track for user2'));
  });

  test('replaceVideoTrack preserves audio track senders', async () => {
    const mockVideoReplaceTrack = jest.fn().mockResolvedValue(undefined);
    const mockAudioReplaceTrack = jest.fn().mockResolvedValue(undefined);
    const mockGetSenders = jest.fn().mockReturnValue([
      {
        track: { kind: 'video' },
        replaceTrack: mockVideoReplaceTrack,
      },
      {
        track: { kind: 'audio' },
        replaceTrack: mockAudioReplaceTrack,
      },
    ]);

    const mockPc = { getSenders: mockGetSenders } as unknown as RTCPeerConnection;
    mockPcRefs.current?.set('user1', mockPc);

    const { result } = renderHook(() =>
      useScreenShare({
        localVideoRef: mockLocalVideoRef,
        localStreamRef: mockLocalStreamRef,
        pcRefs: mockPcRefs,
        addLog: mockAddLog,
      })
    );

    const newVideoTrack = createMockTrack('video') as unknown as MediaStreamTrack;

    await act(async () => {
      await result.current.replaceVideoTrack(newVideoTrack);
    });

    expect(mockVideoReplaceTrack).toHaveBeenCalledTimes(1);
    expect(mockAudioReplaceTrack).not.toHaveBeenCalled();
  });

  test('replaceVideoTrack completes within 500ms', async () => {
    const mockReplaceTrack = jest.fn().mockResolvedValue(undefined);
    const mockGetSenders = jest.fn().mockReturnValue([
      {
        track: { kind: 'video' },
        replaceTrack: mockReplaceTrack,
      },
    ]);

    const mockPc = { getSenders: mockGetSenders } as unknown as RTCPeerConnection;
    mockPcRefs.current?.set('user1', mockPc);

    const { result } = renderHook(() =>
      useScreenShare({
        localVideoRef: mockLocalVideoRef,
        localStreamRef: mockLocalStreamRef,
        pcRefs: mockPcRefs,
        addLog: mockAddLog,
      })
    );

    const newVideoTrack = createMockTrack('video') as unknown as MediaStreamTrack;
    const startTime = Date.now();

    await act(async () => {
      await result.current.replaceVideoTrack(newVideoTrack);
    });

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(500);
    expect(mockAddLog).toHaveBeenCalledWith(expect.stringContaining('Video track replacement complete'));
  });

  test('replaceVideoTrack handles individual track replacement failures', async () => {
    const mockReplaceTrackSuccess = jest.fn().mockResolvedValue(undefined);
    const mockReplaceTrackFailure = jest.fn().mockRejectedValue(new Error('Track replacement failed'));

    const mockGetSenders1 = jest.fn().mockReturnValue([
      {
        track: { kind: 'video' },
        replaceTrack: mockReplaceTrackSuccess,
      },
    ]);

    const mockGetSenders2 = jest.fn().mockReturnValue([
      {
        track: { kind: 'video' },
        replaceTrack: mockReplaceTrackFailure,
      },
    ]);

    const mockPc1 = { getSenders: mockGetSenders1 } as unknown as RTCPeerConnection;
    const mockPc2 = { getSenders: mockGetSenders2 } as unknown as RTCPeerConnection;

    mockPcRefs.current?.set('user1', mockPc1);
    mockPcRefs.current?.set('user2', mockPc2);

    const { result } = renderHook(() =>
      useScreenShare({
        localVideoRef: mockLocalVideoRef,
        localStreamRef: mockLocalStreamRef,
        pcRefs: mockPcRefs,
        addLog: mockAddLog,
      })
    );

    const newVideoTrack = createMockTrack('video') as unknown as MediaStreamTrack;

    await act(async () => {
      await result.current.replaceVideoTrack(newVideoTrack);
    });

    expect(mockReplaceTrackSuccess).toHaveBeenCalledTimes(1);
    expect(mockReplaceTrackFailure).toHaveBeenCalledTimes(1);
    expect(mockAddLog).toHaveBeenCalledWith(expect.stringContaining('Replaced video track for user1'));
    expect(mockAddLog).toHaveBeenCalledWith(expect.stringContaining('Failed to replace video track for user2'));
  });

  test('replaceVideoTrack handles peer connections without video sender', async () => {
    const mockGetSenders = jest.fn().mockReturnValue([
      {
        track: { kind: 'audio' },
        replaceTrack: jest.fn(),
      },
    ]);

    const mockAddTrack = jest.fn();
    const mockPc = { getSenders: mockGetSenders, addTrack: mockAddTrack } as unknown as RTCPeerConnection;
    mockPcRefs.current?.set('user1', mockPc);

    const { result } = renderHook(() =>
      useScreenShare({
        localVideoRef: mockLocalVideoRef,
        localStreamRef: mockLocalStreamRef,
        pcRefs: mockPcRefs,
        addLog: mockAddLog,
      })
    );

    const newVideoTrack = createMockTrack('video') as unknown as MediaStreamTrack;

    await act(async () => {
      await result.current.replaceVideoTrack(newVideoTrack);
    });

    expect(mockAddTrack).toHaveBeenCalledWith(newVideoTrack, expect.any(MediaStream));
    expect(mockAddLog).toHaveBeenCalledWith(expect.stringContaining('user1 has no video sender; added video track'));
  });
});
