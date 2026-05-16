import { useCallback } from 'react';
import { SignalMessage } from '../types';

interface UseSignalingHandlersProps {
  handleUserJoinedRef: React.MutableRefObject<((remoteUserId: string, isAdmin: boolean, adminId: string | null) => Promise<void>) | null>;
  handleUserLeftRef: React.MutableRefObject<((remoteUserId: string) => void) | null>;
  handleOfferRef: React.MutableRefObject<((sender: string, sdp: RTCSessionDescriptionInit) => Promise<void>) | null>;
  handleAnswerRef: React.MutableRefObject<((sender: string, sdp: RTCSessionDescriptionInit) => Promise<void>) | null>;
  handleIceCandidateMsgRef: React.MutableRefObject<((sender: string, candidate: RTCIceCandidateInit) => Promise<void>) | null>;
}

export const useSignalingHandlers = ({
  handleUserJoinedRef,
  handleUserLeftRef,
  handleOfferRef,
  handleAnswerRef,
  handleIceCandidateMsgRef
}: UseSignalingHandlersProps) => {
  const handlePeerSignalingMessage = useCallback(async (message: SignalMessage) => {
    switch (message.type) {
      case 'user-joined':
        if (message.userId && handleUserJoinedRef.current) {
          const isAdmin = message.isAdmin || false;
          await handleUserJoinedRef.current(message.userId, isAdmin, message.adminId || null);
        }
        return true;
      case 'user-left':
        if (message.userId && handleUserLeftRef.current) {
          handleUserLeftRef.current(message.userId);
        }
        return true;
      case 'offer':
        if (message.sender && message.sdp && handleOfferRef.current) {
          await handleOfferRef.current(message.sender, message.sdp);
        }
        return true;
      case 'answer':
        if (message.sender && message.sdp && handleAnswerRef.current) {
          await handleAnswerRef.current(message.sender, message.sdp);
        }
        return true;
      case 'ice-candidate':
        if (message.sender && message.candidate && handleIceCandidateMsgRef.current) {
          await handleIceCandidateMsgRef.current(message.sender, message.candidate);
        }
        return true;
      default:
        return false;
    }
  }, [
    handleAnswerRef,
    handleIceCandidateMsgRef,
    handleOfferRef,
    handleUserJoinedRef,
    handleUserLeftRef
  ]);

  return { handlePeerSignalingMessage };
};
