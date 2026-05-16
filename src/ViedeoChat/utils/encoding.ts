// 自适应编码工具函数
import { EncodingLevel, BANDWIDTH_THRESHOLDS, ENCODING_LEVELS } from '../constants';

/**
 * 根据当前比特率获取合适的编码级别
 */
export function getEncodingLevel(currentBitrate: number): EncodingLevel {
  if (currentBitrate < BANDWIDTH_THRESHOLDS.LOW) {
    return ENCODING_LEVELS[0]; // 最低质量
  } else if (currentBitrate < BANDWIDTH_THRESHOLDS.MEDIUM) {
    return ENCODING_LEVELS[1]; // 低质量
  } else if (currentBitrate < BANDWIDTH_THRESHOLDS.HIGH) {
    return ENCODING_LEVELS[2]; // 中等质量
  } else {
    return ENCODING_LEVELS[3]; // 高质量
  }
}

