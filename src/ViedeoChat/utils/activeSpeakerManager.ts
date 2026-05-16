// src/ViedeoChat/utils/activeSpeakerManager.ts

export interface Speaker {
  userId: string;
  audioLevel: number;
  lastSpeakTime: number;
  isSpeaking: boolean;
}

export class ActiveSpeakerManager {
  private speakers: Map<string, Speaker> = new Map();
  private maxActiveSpeakers: number;
  private silenceThreshold: number = 0.01; // 音量阈值
  private speakingTimeout: number = 3000; // 3秒未说话视为静默

  constructor(maxActiveSpeakers: number = 9) {
    this.maxActiveSpeakers = maxActiveSpeakers;
  }

  // 更新用户音量
  updateAudioLevel(userId: string, audioLevel: number) {
    const now = Date.now();
    const isSpeaking = audioLevel > this.silenceThreshold;

    if (!this.speakers.has(userId)) {
      this.speakers.set(userId, {
        userId,
        audioLevel,
        lastSpeakTime: isSpeaking ? now : 0,
        isSpeaking,
      });
    } else {
      const speaker = this.speakers.get(userId)!;
      speaker.audioLevel = audioLevel;
      speaker.isSpeaking = isSpeaking;
      
      if (isSpeaking) {
        speaker.lastSpeakTime = now;
      }
    }
  }

  // 获取活跃说话者列表（最多 maxActiveSpeakers 个）
  getActiveSpeakers(): string[] {
    const now = Date.now();
    
    // 过滤出活跃的说话者
    const activeSpeakers = Array.from(this.speakers.values())
      .filter(speaker => {
        // 正在说话 或 最近3秒内说过话
        return speaker.isSpeaking || 
               (now - speaker.lastSpeakTime < this.speakingTimeout);
      })
      .sort((a, b) => {
        // 优先级：正在说话 > 音量大 > 最近说话
        if (a.isSpeaking && !b.isSpeaking) return -1;
        if (!a.isSpeaking && b.isSpeaking) return 1;
        if (a.audioLevel !== b.audioLevel) {
          return b.audioLevel - a.audioLevel;
        }
        return b.lastSpeakTime - a.lastSpeakTime;
      })
      .slice(0, this.maxActiveSpeakers)
      .map(s => s.userId);

    return activeSpeakers;
  }

  // 移除用户
  removeSpeaker(userId: string) {
    this.speakers.delete(userId);
  }

  // 清空所有说话者
  clear() {
    this.speakers.clear();
  }

  // 设置最大活跃说话者数量
  setMaxActiveSpeakers(max: number) {
    this.maxActiveSpeakers = max;
  }
}
