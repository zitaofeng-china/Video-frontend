import { useCallback } from 'react';
import { ChatMessage } from '../components/ChatPanel';
import { RemoteUser, SignalMessage, VideoChatState } from '../types';

interface UseRoomEventHandlersProps {
  userId: string;
  setState: React.Dispatch<React.SetStateAction<VideoChatState>>;
  updateRemoteUsers: (updater: (prev: RemoteUser[]) => RemoteUser[]) => void;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  addLog: (message: string) => void;
}

export const useRoomEventHandlers = ({
  userId,
  setState,
  updateRemoteUsers,
  setChatMessages,
  addLog
}: UseRoomEventHandlersProps) => {
  const updateScreenSharingUser = useCallback((message: SignalMessage, isScreenSharing: boolean) => {
    const targetUserId = message.sender || message.userId;
    if (!targetUserId) {
      return;
    }

    addLog(
      isScreenSharing
        ? `User ${targetUserId} started screen sharing`
        : `User ${targetUserId} stopped screen sharing`
    );

    updateRemoteUsers(prev =>
      prev.map(user => {
        if (user.userId === targetUserId) {
          return { ...user, isScreenSharing };
        }

        return isScreenSharing ? { ...user, isScreenSharing: false } : user;
      })
    );
  }, [addLog, updateRemoteUsers]);

  const handleAdminChange = useCallback((message: SignalMessage) => {
    const newAdminId = message.newAdminId || message.newAdmin;

    if (!newAdminId) {
      addLog('Invalid admin-change message');
      return;
    }

    setState(prev => ({
      ...prev,
      adminId: newAdminId,
      isAdmin: newAdminId === userId
    }));

    updateRemoteUsers(prev =>
      prev.map(user => ({
        ...user,
        isAdmin: user.userId === newAdminId
      }))
    );

    addLog(newAdminId === userId ? 'You are now the admin' : `Admin changed to ${newAdminId}`);
  }, [addLog, setState, updateRemoteUsers, userId]);

  const handleChatMessage = useCallback((message: SignalMessage) => {
    if (!message.sender || !message.text) {
      return;
    }

    const messageTimestamp = message.timestamp || message.clientTimestamp || Date.now();
    const messageId = `chat-${messageTimestamp}-${message.sender}`;
    const chatMessage: ChatMessage = {
      id: messageId,
      sender: message.sender,
      message: message.text,
      timestamp: messageTimestamp,
      type: 'text'
    };

    setChatMessages(prev => {
      if (prev.some(existingMessage => existingMessage.id === messageId)) {
        return prev;
      }
      return [...prev, chatMessage];
    });
  }, [setChatMessages]);

  const handleRoomEventMessage = useCallback((message: SignalMessage) => {
    switch (message.type) {
      case 'screen-share-started':
        updateScreenSharingUser(message, true);
        return true;
      case 'screen-share-stopped':
        updateScreenSharingUser(message, false);
        return true;
      case 'admin-change':
        handleAdminChange(message);
        return true;
      case 'chat-message':
        handleChatMessage(message);
        return true;
      default:
        return false;
    }
  }, [handleAdminChange, handleChatMessage, updateScreenSharingUser]);

  return { handleRoomEventMessage };
};
