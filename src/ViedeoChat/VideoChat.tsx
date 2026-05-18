// src/ViedeoChat/VideoChat.tsx
import React, { useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import './VideoChat.css';
import ConnectionStatusBar from './components/ConnectionStatusBar';
import AdminPanel from './components/AdminPanel';
import { LocalUserLabel, ActiveSpeakerIndicator, InactiveUserPlaceholder } from './components/VideoText';
import VideoControls from './components/VideoControls';
import { RemoteVideo } from './components/RemoteVideo';
import ChatPanel, { ChatMessage } from './components/ChatPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { useWebRTC } from './hooks/useWebRTC';
import { useVideoChatState } from './hooks/useVideoChatState';
import { useScreenShare } from './hooks/useScreenShare';
import { useMediaDevices } from './hooks/useMediaDevices';
import { useActiveSpeaker } from './hooks/useActiveSpeaker';
import { useControlLock } from './hooks/useControlLock';
import { useAdminControls } from './hooks/useAdminControls';
import { useRecording } from './hooks/useRecording';
import { useRoomStateSync } from './hooks/useRoomStateSync';
import { useSignalingHandlers } from './hooks/useSignalingHandlers';
import { useRoomEventHandlers } from './hooks/useRoomEventHandlers';
import { useAdminCommandHandlers } from './hooks/useAdminCommandHandlers';
import { useKickHandler } from './hooks/useKickHandler';
import { useWebSocketMessageDispatcher } from './hooks/useWebSocketMessageDispatcher';
import { VideoChatContext } from './context/VideoChatContext';
import { STATS_UPDATE_INTERVAL, LOG_CONFIG } from './constants';
import { ChatDeduplicationManager } from './utils/chatDeduplication';
import { getEncodingLevel } from './utils/encoding';
import { getErrorMessage } from './utils/errorHandler';
import { getWebSocketUrl as getWsUrl } from '../config/api';


const VideoChat: React.FC<{ roomId: string; userId: string }> = ({ roomId, userId }) => {
  const localVideo = useRef<HTMLVideoElement>(null);
  const mountedRef = useRef(true);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isScreenSharingRef = useRef(false);
  const stopScreenShareRef = useRef<(() => Promise<void>) | null>(null);
  const connectionLocksRef = useRef<Map<string, Promise<void>>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const initiatedOffersRef = useRef<Set<string>>(new Set());
  const createAndSendOfferRef = useRef<((remoteUserId: string) => Promise<void>) | null>(null);
  const handleUserJoinedRef = useRef<((remoteUserId: string, isAdmin: boolean, adminId: string | null) => Promise<void>) | null>(null);
  const handleUserLeftRef = useRef<((remoteUserId: string) => void) | null>(null);
  const handleOfferRef = useRef<((sender: string, sdp: RTCSessionDescriptionInit) => Promise<void>) | null>(null);
  const handleAnswerRef = useRef<((sender: string, sdp: RTCSessionDescriptionInit) => Promise<void>) | null>(null);
  const handleIceCandidateMsgRef = useRef<((sender: string, candidate: RTCIceCandidateInit) => Promise<void>) | null>(null);
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const chatDeduplicationRef = useRef(new ChatDeduplicationManager());
  const [isAdminPanelOpen, setIsAdminPanelOpen] = React.useState(true);
  const [adminPanelPosition, setAdminPanelPosition] = React.useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [screenShareDock, setScreenShareDock] = React.useState<'top' | 'right' | 'bottom' | 'left'>('right');
  const adminPanelRef = useRef<HTMLDivElement>(null);
  const adminPanelResizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const lastStatsRef = useRef({
    bytesReceived: 0,
    timestamp: 0,
    bitrate: 0
  });

const { state, setState, addLog, updateRemoteUsers, updateStats } = useVideoChatState();
  const { getMediaWithFallback } = useMediaDevices();

  const { lockControl, isControlLocked } = useControlLock();

  const { handlePeerSignalingMessage } = useSignalingHandlers({
    handleUserJoinedRef,
    handleUserLeftRef,
    handleOfferRef,
    handleAnswerRef,
    handleIceCandidateMsgRef
  });

  const { handleRoomEventMessage } = useRoomEventHandlers({
    userId,
    setState,
    updateRemoteUsers,
    setChatMessages,
    addLog
  });

  const { handleAdminCommandMessage } = useAdminCommandHandlers({
    userId,
    adminId: state.adminId,
    localStreamRef,
    setState,
    lockControl,
    addLog,
    stopScreenShare: () => stopScreenShareRef.current?.()
  });

  const upsertChatMessage = useCallback((message: ChatMessage) => {
    const deduplicationManager = chatDeduplicationRef.current;

    if (deduplicationManager.isDuplicate(message.id)) {
      return;
    }

    deduplicationManager.addMessageId(message.id);

    setChatMessages((prev) => {
      const nextMessages = [...prev, message];
      nextMessages.sort((left, right) => left.timestamp - right.timestamp);
      return nextMessages;
    });
  }, []);

  const {
    activeSpeakers,
    startMonitoring,
    stopMonitoring,
    setConnectionCallbacks,
  } = useActiveSpeaker({
    maxActiveSpeakers: 9,
    enabled: true,
    updateInterval: 500
  });

  const getWebSocketUrl = useCallback(() => {
    return getWsUrl(roomId, userId);
  }, [roomId, userId]);

  const startLocal = useCallback(async () => {
    try {
      addLog('开始获取本地媒体流');
      
      const { stream, type, error } = await getMediaWithFallback();
      
      if (stream) {
        if (localVideo.current) {
          localVideo.current.srcObject = stream;
        }
        
        localStreamRef.current = stream;
        
        addLog(type === 'audio-only' ? "Local audio stream started" : "Local media stream started");
        
        startMonitoring(userId, stream);
        addLog("Started monitoring local audio");
        
        return stream;
      } else if (error) {
        const errorMessage = getErrorMessage(error);
        addLog(`Failed to start local media: ${errorMessage}`);
        setState(prev => ({ 
          ...prev, 
          connectionStatus: `Failed to start local media: ${errorMessage}`
        }));
        return null;
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      addLog(`Failed to start local media: ${errorMessage}`);
      setState(prev => ({ 
        ...prev, 
        connectionStatus: `Failed to start local media: ${errorMessage}`
      }));
      return null;
    }
  }, [addLog, getMediaWithFallback, setState, startMonitoring, userId]);

  const sendMessageRef = useRef<((message: any) => void) | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  const sendMessage = useCallback((message: any) => {
    if (sendMessageRef.current) {
      sendMessageRef.current(message);
    }
  }, []);

  const waitForStableSignalingState = useCallback((pc: RTCPeerConnection, remoteUserId: string) => {
    if (pc.signalingState === 'stable') {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for stable signaling state for ${remoteUserId}`));
      }, 3000);

      const handleStateChange = () => {
        if (pc.signalingState === 'stable') {
          cleanup();
          resolve();
        }
      };

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        pc.removeEventListener('signalingstatechange', handleStateChange);
      };

      pc.addEventListener('signalingstatechange', handleStateChange);
    });
  }, []);

  const handleTrackEvent = useCallback((e: RTCTrackEvent, remoteUserId: string) => {
    addLog(
      `Received ${e.track.kind} track from ${remoteUserId} ` +
      `[muted=${e.track.muted}, readyState=${e.track.readyState}, streams=${e.streams.length}]`
    );

    e.track.onunmute = () => {
      addLog(`Track ${e.track.kind} from ${remoteUserId} unmuted`);
    };
    e.track.onmute = () => {
      addLog(`Track ${e.track.kind} from ${remoteUserId} muted`);
    };
    e.track.onended = () => {
      addLog(`Track ${e.track.kind} from ${remoteUserId} ended`);
    };

    const previousStream = remoteStreamsRef.current.get(remoteUserId);
    const preservedTracks = previousStream
      ? previousStream.getTracks().filter(track => track.kind !== e.track.kind && track.readyState !== 'ended')
      : [];
    const incomingTracks = e.streams.length > 0
      ? e.streams.flatMap(stream => stream.getTracks()).filter(track => track.readyState !== 'ended')
      : [e.track];
    const nextStream = new MediaStream();
    const trackIds = new Set<string>();

    [...preservedTracks, ...incomingTracks].forEach((track) => {
      if (!trackIds.has(track.id)) {
        nextStream.addTrack(track);
        trackIds.add(track.id);
      }
    });

    remoteStreamsRef.current.set(remoteUserId, nextStream);
    updateRemoteUsers(prev => prev.map(user => ({
      ...user,
      stream: user.userId === remoteUserId ? nextStream : (remoteStreamsRef.current.get(user.userId) || null)
    })));

    startMonitoring(remoteUserId, nextStream);
    addLog(
      `Updated remote media stream for ${remoteUserId} ` +
      `[audio=${nextStream.getAudioTracks().length}, video=${nextStream.getVideoTracks().length}]`
    );
  }, [addLog, updateRemoteUsers, startMonitoring]);

  const handleIceCandidate = useCallback((e: RTCPeerConnectionIceEvent, remoteUserId: string) => {
    if (e.candidate) {
      addLog(`收到 ICE 候选并发送给 ${remoteUserId}`);
      if (e.candidate.type === 'relay') {
        addLog("Using TURN relay");
      }
      
      sendMessage({
        type: "ice-candidate",
        target: remoteUserId,
        candidate: e.candidate,
      });
    } else {
      addLog(`与 ${remoteUserId} 的 ICE 候选收集已完成`);
    }
  }, [addLog, sendMessage]);

  const handleIceConnectionStateChange = useCallback((pc: RTCPeerConnection, remoteUserId: string) => {
    const currentState = pc.iceConnectionState;
    setState(prev => ({ ...prev, iceState: currentState }));
    addLog(`与 ${remoteUserId} 的 ICE 连接状态变更为 ${currentState}`);

    switch (currentState) {
      case "connected":
        addLog(`与 ${remoteUserId} 的 WebRTC 连接已建立（connected）`);
        setState(prev => ({ ...prev, connectionStatus: "WebRTC connected" }));
        break;
      case "failed":
        addLog(`与 ${remoteUserId} 的 ICE 连接失败（failed）`);
        setState(prev => ({ ...prev, connectionStatus: 'WebRTC 连接失败' }));
        break;
      case "disconnected":
        addLog(`与 ${remoteUserId} 的 ICE 连接已断开（disconnected）`);
        setState(prev => ({ ...prev, connectionStatus: 'WebRTC 连接已断开' }));
        break;
      case "checking":
        setState(prev => ({ ...prev, connectionStatus: 'WebRTC 连接检测中' }));
        break;
    }
  }, [addLog, setState]);

  const handleWebSocketOpen = useCallback(() => {
    addLog("WebSocket connected");
    setState(prev => ({ 
      ...prev, 
      wsConnected: true, 
      connectionStatus: 'WebSocket 信令通道已建立'
    }));
    setTimeout(() => {
      sendMessageRef.current?.({ type: "request-room-state" });
      sendMessageRef.current?.({ type: "join-room", roomId, userId });
      addLog("Requested room state snapshot");
    }, 0);
  }, [addLog, roomId, setState, userId]);

  const handleWebSocketClose = useCallback((event: CloseEvent) => {
    addLog(`WebSocket closed: ${event.reason || 'closed'}`);
    setState(prev => ({ 
      ...prev, 
      wsConnected: false, 
      connectionStatus: "Disconnected",
      iceState: "disconnected"
    }));
  }, [addLog, setState]);

  const handleWebSocketError = useCallback((error: Event) => {
    addLog("WebSocket error");
    setState(prev => ({ 
      ...prev, 
      wsConnected: false, 
      connectionStatus: "Connection error",
      iceState: "disconnected"
    }));
  }, [addLog, setState]);
 
  const {
    pcRefs,
    createPeerConnection,
    closeAllConnections,
    updateEncodingParameters,
    getEncodingParameters
  } = useWebRTC({
    onTrack: handleTrackEvent,
    onIceCandidate: handleIceCandidate,
    onIceConnectionStateChange: handleIceConnectionStateChange
  });

  const runWithConnectionLock = useCallback((remoteUserId: string, task: () => Promise<void>) => {
    const previousTask = connectionLocksRef.current.get(remoteUserId) || Promise.resolve();
    const nextTask = previousTask
      .catch(() => undefined)
      .then(task)
      .finally(() => {
        if (connectionLocksRef.current.get(remoteUserId) === nextTask) {
          connectionLocksRef.current.delete(remoteUserId);
        }
      });

    connectionLocksRef.current.set(remoteUserId, nextTask);
    return nextTask;
  }, []);

  const flushPendingCandidates = useCallback(async (remoteUserId: string) => {
    const pc = pcRefs.current.get(remoteUserId);
    const pendingCandidates = pendingCandidatesRef.current.get(remoteUserId);

    if (!pc || !pc.remoteDescription || !pendingCandidates?.length) {
      return;
    }

    pendingCandidatesRef.current.delete(remoteUserId);

    for (const candidate of pendingCandidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        addLog(`缓存 ICE 候选添加失败（${remoteUserId}）：${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, [addLog, pcRefs]);

  const shouldInitiateOffer = useCallback((remoteUserId: string) => {
    return userId.localeCompare(remoteUserId) < 0;
  }, [userId]);

  const { syncConnectedState, syncRoomState } = useRoomStateSync({
    userId,
    pcRefs,
    remoteStreamsRef,
    setState,
    updateRemoteUsers,
    stopMonitoring,
    addLog
  });

  const { handleKickedMessage } = useKickHandler({
    userId,
    localStreamRef,
    pcRefs,
    statsIntervalRef,
    setState,
    stopMonitoring,
    addLog
  });

  const updateAdaptiveEncoding = useCallback(async (remoteUserId: string, currentBitrate: number) => {
    const encodingLevel = getEncodingLevel(currentBitrate);
    
    const success = await updateEncodingParameters(remoteUserId, {
      targetBitrate: encodingLevel.maxBitrate,
      resolution: encodingLevel.resolution,
      frameRate: encodingLevel.frameRate
    });
    
    if (success) {
      addLog(`已为 ${remoteUserId} 更新自适应编码参数（${currentBitrate} bps）`);
    }
  }, [addLog, updateEncodingParameters]);

  const updateConnectionStats = useCallback(async () => {
    let totalBytesReceived = 0;
    let totalBytesSent = 0;
    let totalPacketsLost = 0;
    
    const now = Date.now();
    const remoteUserIds: string[] = [];
    
    for (const [remoteUserId, pc] of pcRefs.current.entries()) {
      try {
        const stats = await pc.getStats();
        let bytesReceived = 0;
        let bytesSent = 0;
        let packetsLost = 0;
        
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
            bytesReceived += report.bytesReceived || 0;
            packetsLost += report.packetsLost || 0;
          } else if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
            bytesSent += report.bytesSent || 0;
          }
        });
        
        totalBytesReceived += bytesReceived;
        totalBytesSent += bytesSent;
        totalPacketsLost += packetsLost;
        remoteUserIds.push(remoteUserId);
      } catch (err) {
        console.warn(`Failed to collect stats for ${remoteUserId}:`, err);
      }
    }

    const timeDiff = now - lastStatsRef.current.timestamp;
    const bytesDiff = totalBytesReceived - lastStatsRef.current.bytesReceived;
    
    let currentBitrate = 0;
    if (timeDiff > 0) {
      currentBitrate = Math.floor((bytesDiff * 8) / (timeDiff / 1000));
    }

    updateStats({
      bytesReceived: totalBytesReceived,
      bytesSent: totalBytesSent,
      packetsLost: totalPacketsLost
    });
    
    lastStatsRef.current = {
      bytesReceived: totalBytesReceived,
      timestamp: now,
      bitrate: currentBitrate
    };
    
    if (remoteUserIds.length > 0) {
      const encodingPromises = remoteUserIds.map(remoteUserId => 
        updateAdaptiveEncoding(remoteUserId, currentBitrate)
      );
      await Promise.allSettled(encodingPromises);
    }
    
    if (Math.floor(now / 1000) % 10 === 0) {
      addLog(`连接统计：↓${totalBytesReceived}B ↑${totalBytesSent}B 丢包=${totalPacketsLost} 码率=${currentBitrate}bps`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog, updateStats, updateAdaptiveEncoding]); // Peer connections are read from refs inside the interval.

  const toggleScreenShareRef = useRef<(() => Promise<void>) | null>(null);

    // Keep camera toggling separate from active screen sharing.
  const toggleVideo = useCallback(async (enabled: boolean) => {
    if (!enabled && isScreenSharingRef.current) {
      addLog("Another user is already sharing screen");
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(track => {
          track.enabled = false;
        });
      }
      addLog("Server rejected screen sharing; local sharing stopped");
    } else if (enabled && isScreenSharingRef.current) {
      addLog("Failed to stop local screen sharing");
      // Stop screen sharing which will automatically restore camera feed
      if (toggleScreenShareRef.current) {
        await toggleScreenShareRef.current();
      }
      // Ensure camera video track is enabled
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(track => {
          track.enabled = true;
        });
      }
      addLog("Camera state toggled");
    } else {
      // Requirement 1.4: Normal camera toggle (not during screen share)
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(track => {
          track.enabled = enabled;
        });
        addLog(enabled ? "Camera enabled" : "Camera disabled");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog]);

  const toggleAudio = useCallback((enabled: boolean) => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = enabled;
      });
      addLog(enabled ? "Microphone enabled" : "Microphone disabled");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog]);

  

  const { toggleScreenShare: toggleScreenShareRaw, stopScreenShare, screenShareState } = useScreenShare({
    localVideoRef: localVideo,
    localStreamRef,
    pcRefs,
    addLog,
    onScreenShareStart: () => {
      sendMessage({
        type: "screen-share-started",
        broadcast: true
      });
      addLog("Screen share started and broadcast");
    },
    onScreenShareStop: () => {
      sendMessage({
        type: "screen-share-stopped",
        broadcast: true
      });
      addLog("Screen share stopped and broadcast");
    },
    onPeerNeedsRenegotiation: (remoteUserId) => {
      return runWithConnectionLock(remoteUserId, async () => {
        await createAndSendOfferRef.current?.(remoteUserId);
      });
    }
  });

  const remoteScreenSharingUser = useMemo(
    () => state.remoteUsers.find(user => user.isScreenSharing),
    [state.remoteUsers]
  );

  const screenSharingUserId = state.isScreenSharing ? userId : remoteScreenSharingUser?.userId || null;

  useLayoutEffect(() => {
    const videoElement = localVideo.current;
    if (!videoElement) {
      return;
    }

    const activeStream = screenShareState.screenStream || localStreamRef.current || null;
    if (videoElement.srcObject !== activeStream) {
      videoElement.srcObject = activeStream;
    }

    videoElement.classList.toggle('screen-sharing', screenShareState.isScreenSharing);
    void videoElement.play().catch(() => undefined);
  }, [screenShareState.isScreenSharing, screenShareState.screenStream, screenSharingUserId]);

  const toggleScreenShare = useCallback(async () => {
    if (!state.isScreenSharing && remoteScreenSharingUser) {
      const message = `User ${remoteScreenSharingUser.userId} is sharing screen. Please wait until it ends.`;
      addLog(message);
      setState(prev => ({ ...prev, connectionStatus: message }));
      return;
    }

    await toggleScreenShareRaw();
  }, [addLog, remoteScreenSharingUser, setState, state.isScreenSharing, toggleScreenShareRaw]);

  // Update toggleScreenShareRef after hook is initialized
  useEffect(() => {
    toggleScreenShareRef.current = toggleScreenShare;
    stopScreenShareRef.current = stopScreenShare;
  }, [stopScreenShare, toggleScreenShare]);

  // Sync screen share state with component state and ref
  useEffect(() => {
    isScreenSharingRef.current = screenShareState.isScreenSharing;
    setState(prev => ({ ...prev, isScreenSharing: screenShareState.isScreenSharing }));
  }, [screenShareState.isScreenSharing, setState]);

  const ensurePeerConnectionWithLocalTracks = useCallback(async (remoteUserId: string) => {
    if (!localStreamRef.current) {
      addLog(`本地媒体流未就绪，先启动本地流后再建立与 ${remoteUserId} 的连接`);
      await startLocal();
    }

    const pc = createPeerConnection(remoteUserId);
    const hasLocalSenders = pc.getSenders().some(sender => sender.track);

    if (!hasLocalSenders) {
      let streamToSend = localStreamRef.current;
      if (isScreenSharingRef.current && screenShareState.screenStream) {
        streamToSend = screenShareState.screenStream;
      }

      if (streamToSend) {
        streamToSend.getTracks().forEach(track => {
          pc.addTrack(track, streamToSend!);
        });
      }
    }

    return pc;
  }, [addLog, createPeerConnection, screenShareState.screenStream, startLocal]);

  const {
    isRecording,
    isPaused: isRecordingPaused,
    startTime: recordingStartTime,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    switchRecordingStream,
  } = useRecording({
    roomId,
    getCurrentStream: () => screenShareState.screenStream || localStreamRef.current,
    getCurrentEncodingBitrate: () => getEncodingLevel(state.stats.bytesReceived || 0).maxBitrate,
    addLog,
  });

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const currentStream = screenShareState.screenStream || localStreamRef.current;
    if (currentStream) {
      switchRecordingStream(currentStream);
    }
  }, [isRecording, screenShareState.screenStream, switchRecordingStream]);

  const shareRoom = useCallback(() => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?roomId=${roomId}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Video call invite',
        text: `Join my video chat room: ${roomId}`,
        url: shareUrl
      }).catch(error => {
        console.log('Web Share API failed, falling back to clipboard copy', error);
        fallbackCopyTextToClipboard(shareUrl);
      });
    } else {
      fallbackCopyTextToClipboard(shareUrl);
    }
    
    function fallbackCopyTextToClipboard(text: string) {
      navigator.clipboard.writeText(text)
        .then(() => {
          addLog("Room link copied to clipboard");
          alert("Room link copied to clipboard");
        })
        .catch(err => {
          addLog('房间链接复制到剪贴板失败，请手动复制');
        });
    }
  }, [roomId, addLog]);

  const kickUser = useCallback((targetUserId: string) => {
    if (!state.isAdmin) {
      addLog("Kick user failed");
      return;
    }
    
    sendMessage({
      type: "kick-user",
      targetUserId: targetUserId
    });
    
    addLog(`Kick user requested: ${targetUserId}`);
  }, [state.isAdmin, sendMessage, addLog]);

  const transferAdmin = useCallback((newAdminId: string) => {
    if (!state.isAdmin) {
      addLog("Only the admin can transfer admin role");
      return;
    }
    
    sendMessage({
      type: "transfer-admin",
      newAdminId: newAdminId
    });
    
    addLog(`已向服务端发送管理员转让请求，新管理员：${newAdminId}`);
  }, [state.isAdmin, sendMessage, addLog]);

  const { muteAll, unmuteAll, disableAllVideo, enableAllVideo } = useAdminControls({
    isAdmin: state.isAdmin ?? false,
    localStreamRef,
    sendMessage,
    setState,
    lockControl,
    addLog
  });

  const handleAdminPanelMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (adminPanelRef.current && 
        (target.classList.contains('admin-panel-header') || 
         target.closest('.admin-panel-header')) &&
        !target.closest('.admin-panel-header-actions')) {
      setIsDragging(true);
      const rect = adminPanelRef.current.getBoundingClientRect();
      setDragStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      e.preventDefault();
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && adminPanelRef.current) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        
        const rect = adminPanelRef.current.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        
        setAdminPanelPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  useEffect(() => {
    const clampAdminPanelPosition = () => {
      if (!adminPanelRef.current) {
        return;
      }

      const rect = adminPanelRef.current.getBoundingClientRect();
      const maxX = Math.max(0, window.innerWidth - rect.width);
      const maxY = Math.max(0, window.innerHeight - rect.height);

      setAdminPanelPosition((prev) => ({
        x: Math.max(0, Math.min(prev.x, maxX)),
        y: Math.max(0, Math.min(prev.y, maxY)),
      }));
    };

    const handleResize = () => {
      if (adminPanelResizeTimeoutRef.current) {
        clearTimeout(adminPanelResizeTimeoutRef.current);
      }

      adminPanelResizeTimeoutRef.current = setTimeout(() => {
        clampAdminPanelPosition();
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (adminPanelResizeTimeoutRef.current) {
        clearTimeout(adminPanelResizeTimeoutRef.current);
        adminPanelResizeTimeoutRef.current = null;
      }
    };
  }, []);

  const getKickContext = useCallback(() => ({
    remoteUsers: state.remoteUsers,
    screenStream: screenShareState.screenStream,
    wsRef
  }), [screenShareState.screenStream, state.remoteUsers]);

  const handleServerErrorMessage = useCallback(async (message: any) => {
    const errorMessage = message.message || 'Server returned an error';
    addLog(`收到服务端错误响应：${errorMessage}`);
    setState(prev => ({ ...prev, connectionStatus: errorMessage }));

    if (isScreenSharingRef.current && (message.code === 'SCREEN_SHARE_BUSY' || String(errorMessage).includes('screen'))) {
      await stopScreenShareRef.current?.();
    }
  }, [addLog, setState]);

  const { handleWebSocketMessage } = useWebSocketMessageDispatcher({
    mountedRef,
    addLog,
    handlePeerSignalingMessage,
    handleRoomEventMessage,
    handleAdminCommandMessage,
    syncConnectedState,
    syncRoomState,
    handleErrorMessage: handleServerErrorMessage,
    handleKickedMessage,
    getKickContext
  });

  const webSocketHook = useWebSocket({
    url: getWebSocketUrl(),
    wsRef,
    onOpen: handleWebSocketOpen,
    onClose: handleWebSocketClose,
    onError: handleWebSocketError,
    onMessage: handleWebSocketMessage
  });
  
  useEffect(() => {
    sendMessageRef.current = webSocketHook.sendMessage;
  }, [webSocketHook.sendMessage]);

  const createAndSendOffer = useCallback(async (remoteUserId: string) => {
    const pc = pcRefs.current?.get(remoteUserId);
    if (!pc) {
      addLog(`无法为 ${remoteUserId} 创建 Offer：PeerConnection 不存在`);
      return;
    }
    
    try {
      if (pc.signalingState !== 'stable') {
        addLog(`Waiting for stable signaling state before renegotiating ${remoteUserId}`);
        await waitForStableSignalingState(pc, remoteUserId);
      }

      if (pc.signalingState !== 'stable' || pc.connectionState === 'closed') {
        addLog(`Skipped renegotiation for ${remoteUserId}`);
        return;
      }

      addLog(`开始为 ${remoteUserId} 创建 Offer（signalingState=${pc.signalingState}）`);
      
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await pc.setLocalDescription(offer);
      addLog(`已为 ${remoteUserId} 设置本地 SDP 描述（Offer）`);
      
      sendMessage({
        type: "offer",
        target: remoteUserId,
        sdp: offer
      });
      addLog(`Offer 已发送至 ${remoteUserId}`);
    } catch (err) {
      addLog(`Failed to create offer for ${remoteUserId}: ${getErrorMessage(err)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog, sendMessage, waitForStableSignalingState]);
  
  useEffect(() => {
    createAndSendOfferRef.current = createAndSendOffer;
  }, [createAndSendOffer]);

  useEffect(() => {
    setConnectionCallbacks(
      async (remoteUserId: string) => {
        addLog(`活跃发言者检测到 ${remoteUserId} 连接，准备发起 Offer`);
        if (!pcRefs.current.has(remoteUserId)) {
          const userInRoom = state.remoteUsers.some(u => u.userId === remoteUserId);
          if (userInRoom && createAndSendOfferRef.current) {
            await ensurePeerConnectionWithLocalTracks(remoteUserId);
            if (shouldInitiateOffer(remoteUserId)) {
              await createAndSendOfferRef.current(remoteUserId);
            }
          }
        }
      },
      (remoteUserId: string) => {
        addLog(`活跃发言者监控：${remoteUserId} 已断开连接`);
      }
    );
  }, [setConnectionCallbacks, addLog, pcRefs, state.remoteUsers, ensurePeerConnectionWithLocalTracks, shouldInitiateOffer]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (activeSpeakers.length > 0) {
        addLog(`当前活跃发言者（${activeSpeakers.length}）：${activeSpeakers.join(', ')}`);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [activeSpeakers, addLog]);

  useEffect(() => {
    if (!state.wsConnected) {
      return;
    }

    state.remoteUsers.forEach((remoteUser) => {
      const remoteUserId = remoteUser.userId;
      if (!shouldInitiateOffer(remoteUserId) || initiatedOffersRef.current.has(remoteUserId)) {
        return;
      }

      const existingPc = pcRefs.current.get(remoteUserId);
      if (existingPc?.remoteDescription) {
        return;
      }

      initiatedOffersRef.current.add(remoteUserId);
      runWithConnectionLock(remoteUserId, async () => {
        await ensurePeerConnectionWithLocalTracks(remoteUserId);
        await createAndSendOfferRef.current?.(remoteUserId);
      }).catch((error) => {
        initiatedOffersRef.current.delete(remoteUserId);
        addLog(`为 ${remoteUserId} 建立连接锁失败，已撤销 offer 发起标记`);
      });
    });
  }, [addLog, ensurePeerConnectionWithLocalTracks, pcRefs, runWithConnectionLock, shouldInitiateOffer, state.remoteUsers, state.wsConnected]);

  const handleUserJoined = useCallback(async (remoteUserId: string, isAdmin: boolean = false, adminId: string | null = null) => {
    addLog(`远端用户 ${remoteUserId} 加入房间`);
    setState(prev => ({ ...prev, connectionStatus: `用户 ${remoteUserId} 加入，正在建立连接` }));

    if (adminId) {
      setState(prev => ({
        ...prev,
        adminId: adminId,
        isAdmin: userId === adminId
      }));
    }

    if (!localStreamRef.current) {
      addLog(`用户 ${remoteUserId} 加入，本地流未就绪，正在启动本地媒体`);
      await startLocal();
    }

    if (pcRefs.current?.has(remoteUserId)) {
      addLog(`用户 ${remoteUserId} 加入，PeerConnection 已存在，仅更新用户列表`);
      updateRemoteUsers(prev => {
        if (!prev.some(user => user.userId === remoteUserId)) {
          return [...prev, { userId: remoteUserId, stream: null, isAdmin }];
        }
        return prev.map(user =>
          user.userId === remoteUserId ? { ...user, isAdmin } : user
        );
      });
      return;
    }

    const newPc = await ensurePeerConnectionWithLocalTracks(remoteUserId);
    
    let streamToSend: MediaStream | null = null;
    if (isScreenSharingRef.current && screenShareState.screenStream) {
      streamToSend = screenShareState.screenStream;
    }

    if (streamToSend && !newPc.getSenders().some(sender => sender.track)) {
      streamToSend.getTracks().forEach(track => {
        newPc.addTrack(track, streamToSend!);
      });
    }

    updateRemoteUsers(prev => {
      if (!prev.some(user => user.userId === remoteUserId)) {
        return [...prev, { userId: remoteUserId, stream: null, isAdmin }];
      }
      return prev.map(user => 
        user.userId === remoteUserId ? { ...user, isAdmin } : user
      );
    });

    if (
      createAndSendOfferRef.current &&
      shouldInitiateOffer(remoteUserId) &&
      !initiatedOffersRef.current.has(remoteUserId)
    ) {
      initiatedOffersRef.current.add(remoteUserId);
      await createAndSendOfferRef.current(remoteUserId);
    }
    
    if (isScreenSharingRef.current) {
      sendMessage({
        type: "screen-share-started",
        target: remoteUserId
      });
    }
  }, [addLog, ensurePeerConnectionWithLocalTracks, pcRefs, screenShareState.screenStream, sendMessage, setState, shouldInitiateOffer, startLocal, updateRemoteUsers, userId]);

  useEffect(() => {
    handleUserJoinedRef.current = handleUserJoined;
  }, [handleUserJoined]);

  const handleUserLeft = useCallback((remoteUserId: string) => {
    addLog(`远端用户 ${remoteUserId} 已离开房间，正在释放连接资源`);
    initiatedOffersRef.current.delete(remoteUserId);

    const pc = pcRefs.current?.get(remoteUserId);
    if (pc) {
      pc.close();
      pcRefs.current?.delete(remoteUserId);
    }
    
    remoteStreamsRef.current.delete(remoteUserId);
    
    stopMonitoring(remoteUserId);
    addLog(`Stopped monitoring audio for ${remoteUserId}`);
    
    updateRemoteUsers(prev => prev.filter(user => user.userId !== remoteUserId));
    
    setState(prev => ({ 
      ...prev, 
      iceState: "disconnected", 
      connectionStatus: "User left"
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog, updateRemoteUsers, setState, stopMonitoring]);

  useEffect(() => {
    handleUserLeftRef.current = handleUserLeft;
  }, [handleUserLeft]);

  const createAndSendAnswer = useCallback(async (sender: string) => {
    const pc = pcRefs.current?.get(sender);
    if (!pc) {
      addLog(`无法为 ${sender} 创建 Answer：PeerConnection 不存在`);
      return;
    }
    
    try {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      addLog(`已为 ${sender} 创建并设置本地 SDP 描述（Answer）`);
      
      sendMessage({
        type: "answer",
        target: sender,
        sdp: answer
      });
      addLog(`Answer 已发送至 ${sender}`);
    } catch (err) {
      addLog(`为 ${sender} 创建/发送 Answer 失败：${err instanceof Error ? err.message : String(err)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog, sendMessage]);

  const handleOffer = useCallback(async (sender: string, sdp: RTCSessionDescriptionInit) => {
    addLog(`收到来自 ${sender} 的 Offer，开始协商`);
    setState(prev => ({ ...prev, connectionStatus: `正在与 ${sender} 进行 WebRTC 协商` }));

    if (!localStreamRef.current) {
      addLog(`收到 ${sender} 的 Offer，本地流未就绪，先启动本地媒体`);
      await startLocal();
    }

    let pc = pcRefs.current?.get(sender);
    if (!pc) {
      pc = await ensurePeerConnectionWithLocalTracks(sender);

      let streamToAdd: MediaStream | null = null;
      if (isScreenSharingRef.current && screenShareState.screenStream) {
        streamToAdd = screenShareState.screenStream;
      }

      if (streamToAdd && pc && !pc.getSenders().some(sender => sender.track)) {
        streamToAdd.getTracks().forEach(track => {
          pc!.addTrack(track, streamToAdd!);
        });
      }
      
      updateRemoteUsers(prev => {
        if (!prev.some(user => user.userId === sender)) {
          return [...prev, { userId: sender, stream: null }];
        }
        return prev;
      });
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingCandidates(sender);
      addLog(`已应用来自 ${sender} 的远端 SDP 描述（Offer），正在发送 Answer`);

      await createAndSendAnswer(sender);
    } catch (err) {
      addLog(`处理来自 ${sender} 的 Offer 失败：${err instanceof Error ? err.message : String(err)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog, setState, startLocal, ensurePeerConnectionWithLocalTracks, updateRemoteUsers, createAndSendAnswer]);

  useEffect(() => {
    handleOfferRef.current = (sender, sdp) => runWithConnectionLock(sender, () => handleOffer(sender, sdp));
  }, [handleOffer, runWithConnectionLock]);

  const handleAnswer = useCallback(async (sender: string, sdp: RTCSessionDescriptionInit) => {
    addLog(`收到来自 ${sender} 的 Answer，准备应用远端 SDP`);
    try {
      const pc = pcRefs.current?.get(sender);
      if (!pc) {
        addLog(`无法应用 ${sender} 的 Answer：PeerConnection 不存在`);
        return;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingCandidates(sender);
      addLog(`已应用来自 ${sender} 的远端 SDP 描述（Answer）`);
    } catch (err) {
      addLog(`应用来自 ${sender} 的 Answer 失败：${err instanceof Error ? err.message : String(err)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog]);

  useEffect(() => {
    handleAnswerRef.current = (sender, sdp) => runWithConnectionLock(sender, () => handleAnswer(sender, sdp));
  }, [handleAnswer, runWithConnectionLock]);

  const handleIceCandidateMsg = useCallback(async (sender: string, candidate: RTCIceCandidateInit) => {
    if (candidate) {
      addLog(`收到来自 ${sender} 的 ICE 候选`);
      const pc = pcRefs.current?.get(sender);
      if (pc) {
        if (!pc.remoteDescription) {
          const pending = pendingCandidatesRef.current.get(sender) || [];
          pending.push(candidate);
          pendingCandidatesRef.current.set(sender, pending);
          addLog(`来自 ${sender} 的 ICE 候选已暂存（remoteDescription 未就绪）`);
          return;
        }

        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          addLog(`已添加来自 ${sender} 的 ICE 候选`);
        } catch (err) {
          addLog(`添加来自 ${sender} 的 ICE 候选失败：${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        addLog(`收到来自 ${sender} 的 ICE 候选，但 PeerConnection 不存在，已忽略`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog]);

  useEffect(() => {
    handleIceCandidateMsgRef.current = (sender, candidate) => runWithConnectionLock(sender, () => handleIceCandidateMsg(sender, candidate));
  }, [handleIceCandidateMsg, runWithConnectionLock]);

  useEffect(() => {
    const chatDeduplicationManager = chatDeduplicationRef.current;
    mountedRef.current = true;
    addLog(`Initializing room ${roomId} for user ${userId}`);
    setState(prev => ({ ...prev, connectionStatus: "Initializing..." }));

    startLocal();

    statsIntervalRef.current = setInterval(updateConnectionStats, STATS_UPDATE_INTERVAL);

    return () => {
      mountedRef.current = false;
      chatDeduplicationManager.clear();
      stopRecording();
      
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      
      closeAllConnections();
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Screen share stream cleanup is now handled by useScreenShare hook
      if (screenShareState.screenStream) {
        screenShareState.screenStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId, userId, addLog, setState, startLocal, closeAllConnections, updateConnectionStats, screenShareState.screenStream, stopRecording]);

  const renderLocalTile = (className = '') => (
    <div className={`video-container local-video-container ${className}`}>
      <video
        ref={localVideo}
        autoPlay
        muted
        playsInline
        className={`local-video ${state.isScreenSharing ? 'screen-sharing' : ''}`}
      />
      <LocalUserLabel userId={userId} isAdmin={!!state.isAdmin} isSpeaking={activeSpeakers.includes(userId)} />
      {state.isScreenSharing && <span className="screen-share-badge local-screen-share-badge">Screen sharing</span>}
    </div>
  );

  const renderRemoteTile = (user: typeof state.remoteUsers[number]) => {
    const isSpeaking = activeSpeakers.includes(user.userId);
    return (
      <div
        key={user.userId}
        className={`video-tile-shell ${isSpeaking ? 'active-speaker' : 'inactive-user'}`}
      >
        {user.stream ? (
          <RemoteVideo user={user} />
        ) : (
          <div className="video-container remote-video-container">
            <InactiveUserPlaceholder userId={user.userId} />
          </div>
        )}
        {isSpeaking && <ActiveSpeakerIndicator />}
      </div>
    );
  };

  const galleryUsers = state.remoteUsers.slice(0, 9);
  const sideUsers = state.remoteUsers.filter(user => user.userId !== screenSharingUserId).slice(0, 8);

  const contextValue = {
    state,
    setState,
    addLog,
    updateStats,
    updateRemoteUsers,
    sendMessage,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    shareRoom,
    kickUser,
    transferAdmin,
    muteAll,
    unmuteAll,
    disableAllVideo,
    enableAllVideo,
    pcRefs,
    localStreamRef,
    getEncodingParameters,
    isControlLocked,
    isRecording,
    isRecordingPaused,
    recordingStartTime,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    isReconnecting: webSocketHook.isReconnecting,
    reconnectAttemptCount: webSocketHook.reconnectAttemptCount
  };
  return (
  <VideoChatContext.Provider value={contextValue}>
    <div className="video-chat-container">
      <ConnectionStatusBar />

      {state.isAdmin === true && (
      <AdminPanel
        isVisible={isAdminPanelOpen}
        isDragging={isDragging}
        position={adminPanelPosition}
        adminId={state.adminId}
        currentUserId={userId}
        remoteUsers={state.remoteUsers}
        panelRef={adminPanelRef}
        onOpen={() => setIsAdminPanelOpen(true)}
        onClose={() => setIsAdminPanelOpen(false)}
        onMouseDown={handleAdminPanelMouseDown}
        onMuteAll={muteAll}
        onUnmuteAll={unmuteAll}
        onDisableAllVideo={disableAllVideo}
        onEnableAllVideo={enableAllVideo}
        onKickUser={kickUser}
        onTransferAdmin={transferAdmin}
      />
      )}

      {screenSharingUserId ? (
        <div className={`screen-share-layout dock-${screenShareDock}`}>
          <div className="screen-share-main">
            {screenSharingUserId === userId
              ? renderLocalTile('screen-share-main-video')
              : remoteScreenSharingUser
                ? renderRemoteTile(remoteScreenSharingUser)
                : null}
          </div>

          <div className="screen-share-side">
            <div className="screen-share-side-controls" aria-label="Screen share side position">
              {(['top', 'right', 'bottom', 'left'] as const).map(position => (
                <button
                  key={position}
                  type="button"
                  className={screenShareDock === position ? 'active' : ''}
                  onClick={() => setScreenShareDock(position)}
                  title={`Move screen share panel to ${position}`}
                >
                  {position === 'top' ? 'T' : position === 'right' ? 'R' : position === 'bottom' ? 'B' : 'L'}
                </button>
              ))}
            </div>

            <div className="screen-share-side-list">
              {screenSharingUserId !== userId && renderLocalTile('screen-share-side-video')}
              {sideUsers.map(renderRemoteTile)}
            </div>
          </div>
        </div>
      ) : (
        <div className="video-grid">
          {renderLocalTile()}
          {galleryUsers.map(renderRemoteTile)}
        </div>
      )}

      <VideoControls />

      {/*  */}
      <ChatPanel
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        userId={userId}
        messages={chatMessages}
        onSendMessage={(text: string) => {
          const timestamp = Date.now();
          const chatMessage: ChatMessage = {
            id: ChatDeduplicationManager.generateMessageId(timestamp, userId),
            sender: userId,
            message: text,
            timestamp,
            type: 'text'
          };
          upsertChatMessage(chatMessage);
          sendMessage({
            type: 'chat-message',
            broadcast: true,
            text: text,
            timestamp,
            clientTimestamp: timestamp
          });
        }}
      />

      <div className="debug-panel">
        <div className="debug-title">Debug</div>
        {state.connectionLog.slice(-LOG_CONFIG.displayLogCount).map((log, index) => (
          <div key={index} className="debug-log">{log}</div>
        ))}
      </div>
    </div>
  </VideoChatContext.Provider>
);
};

export default VideoChat;

