import React from 'react';

export const LocalUserLabel: React.FC<{
  userId: string;
  isAdmin: boolean;
  isSpeaking: boolean;
}> = ({ userId, isAdmin, isSpeaking }) => {
  return (
    <div className="user-label">
      我 ({userId})
      {isAdmin && <span className="admin-badge">管理员</span>}
      {isSpeaking && <span className="active-speaker-badge">发言中</span>}
    </div>
  );
};

export const ActiveSpeakerIndicator: React.FC = () => {
  return <div className="active-speaker-indicator">活跃发言者</div>;
};

export const InactiveUserPlaceholder: React.FC<{ userId: string }> = ({ userId }) => {
  return (
    <div className="inactive-user-placeholder">
      <div className="user-name">{userId}</div>
      <div className="inactive-status">未发言</div>
    </div>
  );
};
