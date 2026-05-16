import { useCallback } from 'react';
import { RemoteUser, SignalMessage, VideoChatState } from '../types';

interface UseRoomStateSyncProps {
  userId: string;
  pcRefs: React.MutableRefObject<Map<string, RTCPeerConnection>>;
  remoteStreamsRef: React.MutableRefObject<Map<string, MediaStream>>;
  setState: React.Dispatch<React.SetStateAction<VideoChatState>>;
  updateRemoteUsers: (updater: (prev: RemoteUser[]) => RemoteUser[]) => void;
  stopMonitoring: (userId: string) => void;
  addLog: (message: string) => void;
}

const buildRemoteUsers = (
  participants: string[],
  adminId: string | null,
  screenShareUser: string | null,
  previousUsers: RemoteUser[],
  remoteStreams: Map<string, MediaStream>
): RemoteUser[] => {
  const existingUsers = new Map(previousUsers.map(remoteUser => [remoteUser.userId, remoteUser]));

  return participants.map((participantId) => {
    const existingUser = existingUsers.get(participantId);
    return {
      userId: participantId,
      stream: remoteStreams.get(participantId) || existingUser?.stream || null,
      isAdmin: participantId === adminId,
      isScreenSharing: participantId === screenShareUser
    };
  });
};

export const useRoomStateSync = ({
  userId,
  pcRefs,
  remoteStreamsRef,
  setState,
  updateRemoteUsers,
  stopMonitoring,
  addLog
}: UseRoomStateSyncProps) => {
  const syncConnectedState = useCallback((message: SignalMessage) => {
    const participants = Array.isArray(message.users)
      ? message.users.filter((participantId: string) => participantId && participantId !== userId)
      : [];
    const screenShareUser = Array.isArray(message.screenShareUsers) ? message.screenShareUsers[0] : null;
    const adminId = message.adminId ?? null;

    setState(prev => ({
      ...prev,
      wsConnected: true,
      connectionStatus: 'WebSocket connected; waiting for room sync...',
      isAdmin: message.isAdmin ?? false,
      adminId
    }));

    updateRemoteUsers(prev => buildRemoteUsers(
      participants,
      adminId,
      screenShareUser,
      prev,
      remoteStreamsRef.current
    ));
  }, [remoteStreamsRef, setState, updateRemoteUsers, userId]);

  const syncRoomState = useCallback((message: SignalMessage) => {
    const participants = Array.isArray(message.participants)
      ? message.participants.filter((participantId: string) => participantId && participantId !== userId)
      : [];
    const participantSet = new Set(participants);
    const screenShareUser = Array.isArray(message.screenShareUsers) ? message.screenShareUsers[0] : null;
    const adminId = message.adminId ?? null;

    pcRefs.current.forEach((pc, remoteUserId) => {
      if (!participantSet.has(remoteUserId)) {
        pc.close();
        pcRefs.current.delete(remoteUserId);
        remoteStreamsRef.current.delete(remoteUserId);
        stopMonitoring(remoteUserId);
      }
    });

    setState(prev => ({
      ...prev,
      wsConnected: true,
      adminId,
      isAdmin: adminId === userId
    }));

    updateRemoteUsers(prev => buildRemoteUsers(
      participants,
      adminId,
      screenShareUser,
      prev,
      remoteStreamsRef.current
    ));

    addLog(`Room state synced: ${participants.length + 1} participant(s) online`);
  }, [addLog, pcRefs, remoteStreamsRef, setState, stopMonitoring, updateRemoteUsers, userId]);

  return { syncConnectedState, syncRoomState };
};
