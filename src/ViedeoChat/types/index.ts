export interface RemoteUser {
  userId: string;
  stream: MediaStream | null;
  isScreenSharing?: boolean;
  isAdmin?: boolean;
}

export interface WebRTCStats {
  bytesReceived: number;
  bytesSent: number;
  packetsLost: number;
}

export interface VideoChatState {
  iceState: RTCIceConnectionState | 'disconnected';
  wsConnected: boolean;
  connectionLog: string[];
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  remoteUsers: RemoteUser[];
  isScreenSharing: boolean;
  connectionStatus: string;
  stats: WebRTCStats;
  isAdmin: boolean | null;
  adminId: string | null;
}

export interface SignalMessage {
  type: string;
  userId?: string;
  sender?: string;
  target?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  message?: string;
  isAdmin?: boolean;
  adminId?: string;
  newAdminId?: string;
  targetUserId?: string;
  text?: string;
  timestamp?: number;
  broadcast?: boolean;
  [key: string]: any;
}

export interface ScreenShareState {
  isScreenSharing: boolean;
  screenStream: MediaStream | null;
  originalCameraStream: MediaStream | null;
}

export interface ControlLockState {
  audioLocked: boolean;
  videoLocked: boolean;
  audioLockTimestamp: number;
  videoLockTimestamp: number;
}

export interface RecordingConfig {
  mimeType: string;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
  timeslice: number;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  startTime: number;
  currentStream: MediaStream | null;
}

export interface MessageDeduplication {
  messageIds: Set<string>;
  maxSize: number;
  pruneSize: number;

  isDuplicate(messageId: string): boolean;
  addMessageId(messageId: string): void;
  pruneOldMessages(): void;
}
