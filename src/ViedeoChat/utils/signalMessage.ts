import { SignalMessage } from '../types';

const hasString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export const normalizeSignalMessage = (raw: unknown): SignalMessage | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const message = raw as SignalMessage;

  if (!hasString(message.type)) {
    return null;
  }

  const normalized: SignalMessage = {
    ...message,
    type: message.type
  };

  switch (message.type) {
    case 'connected':
      return Array.isArray(message.users) ? normalized : null;
    case 'room-state':
      return Array.isArray(message.participants) ? normalized : null;
    case 'user-joined':
    case 'user-left':
      return hasString(message.userId) ? normalized : null;
    case 'offer':
    case 'answer':
      return hasString(message.sender) && !!message.sdp ? normalized : null;
    case 'ice-candidate':
      return hasString(message.sender) && !!message.candidate ? normalized : null;
    case 'chat-message':
      return hasString(message.sender) && hasString(message.text) ? normalized : null;
    case 'screen-share-started':
    case 'screen-share-stopped':
      return hasString(message.sender) || hasString(message.userId) ? normalized : null;
    case 'admin-change': {
      const newAdminId = message.newAdminId || message.newAdmin;
      return hasString(newAdminId) ? { ...normalized, newAdminId } : null;
    }
    case 'mute-all':
    case 'unmute-all':
    case 'disable-all-video':
    case 'enable-all-video':
      return hasString(message.sender) ? normalized : null;
    case 'kick-user':
      return hasString(message.sender) && hasString(message.targetUserId) ? normalized : null;
    case 'kicked':
    case 'error':
      return normalized;
    default:
      return null;
  }
};
