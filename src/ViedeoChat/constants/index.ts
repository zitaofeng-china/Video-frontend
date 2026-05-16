// ICE服务器配置
export const ICE_SERVERS: RTCConfiguration['iceServers'] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject"
  }
];

// WebRTC配置
export const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceTransportPolicy: "all",
  iceCandidatePoolSize: 10
};

// 自适应编码参数配置
export interface EncodingLevel {
  maxBitrate: number;
  resolution: { width: number; height: number };
  frameRate: number;
}

export const ENCODING_LEVELS: EncodingLevel[] = [
  {
    maxBitrate: 300000, // 300kbps
    resolution: { width: 640, height: 360 },
    frameRate: 15
  },
  {
    maxBitrate: 500000, // 500kbps
    resolution: { width: 854, height: 480 },
    frameRate: 20
  },
  {
    maxBitrate: 800000, // 800kbps
    resolution: { width: 1280, height: 720 },
    frameRate: 25
  },
  {
    maxBitrate: 1200000, // 1.2Mbps
    resolution: { width: 1280, height: 720 },
    frameRate: 30
  }
];

// 带宽阈值（bps）
export const BANDWIDTH_THRESHOLDS = {
  LOW: 200000,      // 200kbps
  MEDIUM: 500000,   // 500kbps
  HIGH: 1000000     // 1Mbps
};

// 统计信息更新间隔（毫秒）
export const STATS_UPDATE_INTERVAL = 1000;

// WebSocket重连配置
export const WS_RECONNECT_CONFIG = {
  maxRetries: 5,
  retryDelay: 3000,
  heartbeatInterval: 30000
};

// 日志配置
export const LOG_CONFIG = {
  maxLogEntries: 100,
  displayLogCount: 8
};

