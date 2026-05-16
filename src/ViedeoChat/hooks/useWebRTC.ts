// hooks/useWebRTC.ts
import { useRef, useCallback, useEffect } from 'react';
import { RTC_CONFIG } from '../constants';

interface UseWebRTCProps {
  onTrack?: (event: RTCTrackEvent, remoteUserId: string) => void;
  onIceCandidate?: (event: RTCPeerConnectionIceEvent, remoteUserId: string) => void;
  onIceConnectionStateChange?: (pc: RTCPeerConnection, remoteUserId: string) => void;
}

export interface AdaptiveEncodingParams {
  targetBitrate: number;
  resolution: { width: number; height: number };
  frameRate: number;
}

export const useWebRTC = ({
  onTrack,
  onIceCandidate,
  onIceConnectionStateChange
}: UseWebRTCProps = {}) => {
  const pcRefs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const encodingParamsRef = useRef<Map<string, AdaptiveEncodingParams>>(new Map());
  const onTrackRef = useRef(onTrack);
  const onIceCandidateRef = useRef(onIceCandidate);
  const onIceConnectionStateChangeRef = useRef(onIceConnectionStateChange);

  // 更新回调引用
  useEffect(() => {
    onTrackRef.current = onTrack;
    onIceCandidateRef.current = onIceCandidate;
    onIceConnectionStateChangeRef.current = onIceConnectionStateChange;
  }, [onTrack, onIceCandidate, onIceConnectionStateChange]);

  const createPeerConnection = useCallback((remoteUserId: string) => {
    const existingPc = pcRefs.current.get(remoteUserId);
    if (existingPc && existingPc.signalingState !== 'closed') {
      return existingPc;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.ontrack = (e) => onTrackRef.current?.(e, remoteUserId);
    pc.onicecandidate = (e) => onIceCandidateRef.current?.(e, remoteUserId);
    pc.oniceconnectionstatechange = () => onIceConnectionStateChangeRef.current?.(pc, remoteUserId);

    pcRefs.current.set(remoteUserId, pc);
    return pc;
  }, []);

  const closeAllConnections = useCallback(() => {
    pcRefs.current.forEach(pc => pc.close());
    pcRefs.current.clear();
    encodingParamsRef.current.clear();
  }, []);

  const getPeerConnection = useCallback((remoteUserId: string) => {
    return pcRefs.current.get(remoteUserId);
  }, []);

  // 自适应编码：根据网络状况调整视频参数
  const updateEncodingParameters = useCallback(async (
    remoteUserId: string,
    params: AdaptiveEncodingParams
  ) => {
    const pc = pcRefs.current.get(remoteUserId);
    if (!pc) return;

    try {
      const senders = pc.getSenders();
      const videoSender = senders.find(
        sender => sender.track?.kind === 'video'
      );

      if (videoSender && videoSender.track) {
        const parameters = videoSender.getParameters();
        
        // 设置目标比特率
        if (!parameters.encodings) {
          parameters.encodings = [{}];
        }
        
        parameters.encodings[0].maxBitrate = params.targetBitrate;
        
        // 应用新的参数
        await videoSender.setParameters(parameters);
        
        // 保存当前参数
        encodingParamsRef.current.set(remoteUserId, params);
        
        return true;
      }
    } catch (error) {
      // 编码参数更新失败，但不影响主流程
      return false;
    }
    
    return false;
  }, []);

  // 获取当前编码参数
  const getEncodingParameters = useCallback((remoteUserId: string) => {
    return encodingParamsRef.current.get(remoteUserId);
  }, []);

  return {
    pcRefs,
    createPeerConnection,
    closeAllConnections,
    getPeerConnection,
    updateEncodingParameters,
    getEncodingParameters
  };
};
