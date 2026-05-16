import React from 'react';
import { RemoteUser } from '../types';

interface AdminPanelProps {
  isVisible: boolean;
  isDragging: boolean;
  position: { x: number; y: number };
  adminId: string | null;
  currentUserId: string;
  remoteUsers: RemoteUser[];
  panelRef: React.RefObject<HTMLDivElement | null>;
  onOpen: () => void;
  onClose: () => void;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMuteAll: () => void;
  onUnmuteAll: () => void;
  onDisableAllVideo: () => void;
  onEnableAllVideo: () => void;
  onKickUser: (userId: string) => void;
  onTransferAdmin: (userId: string) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
  isVisible,
  isDragging,
  position,
  adminId,
  currentUserId,
  remoteUsers,
  panelRef,
  onOpen,
  onClose,
  onMouseDown,
  onMuteAll,
  onUnmuteAll,
  onDisableAllVideo,
  onEnableAllVideo,
  onKickUser,
  onTransferAdmin,
}) => {
  return (
    <>
      {!isVisible && (
        <button
          className="admin-panel-toggle-btn"
          onClick={onOpen}
          title="管理员面板"
        >
          管
        </button>
      )}

      {isVisible && (
        <div
          ref={panelRef}
          className={`admin-panel-card ${isDragging ? 'dragging' : ''}`}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`
          }}
        >
          <div
            className="admin-panel-header"
            onMouseDown={onMouseDown}
          >
            <div className="admin-panel-header-content">
              <span className="admin-panel-drag-icon">::</span>
              <h3>管理员面板</h3>
            </div>
            <div className="admin-panel-header-actions">
              <button
                className="admin-panel-minimize-btn"
                onClick={onClose}
                title="最小化"
              >
                -
              </button>
            </div>
          </div>

          <div className="admin-panel-body">
            <div className="admin-controls">
              <div className="admin-quick-actions">
                <h4>快捷操作</h4>
                <div className="admin-buttons">
                  <button onClick={onMuteAll} className="admin-action-btn">
                    全员静音
                  </button>
                  <button onClick={onUnmuteAll} className="admin-action-btn">
                    取消静音
                  </button>
                  <button onClick={onDisableAllVideo} className="admin-action-btn">
                    关闭摄像头
                  </button>
                  <button onClick={onEnableAllVideo} className="admin-action-btn">
                    开启摄像头
                  </button>
                </div>
              </div>

              <div className="admin-users-list">
                <h4>房间用户 ({remoteUsers.length + 1})</h4>
                <ul>
                  <li className={currentUserId === adminId ? 'admin' : ''}>
                    <span>我 ({currentUserId}) {currentUserId === adminId ? '(管理员)' : ''}</span>
                  </li>

                  {remoteUsers.map((user) => (
                    <li key={user.userId} className={user.isAdmin ? 'admin' : ''}>
                      <span>{user.userId} {user.isAdmin ? '(管理员)' : ''}</span>
                      <div className="user-actions">
                        {user.userId !== currentUserId && (
                          <button
                            onClick={() => onKickUser(user.userId)}
                            className="kick-user-btn"
                            title="移出用户"
                          >
                            移出
                          </button>
                        )}
                        {!user.isAdmin && user.userId !== currentUserId && (
                          <button
                            onClick={() => onTransferAdmin(user.userId)}
                            className="transfer-admin-btn"
                            title="设为管理员"
                          >
                            设为管理员
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminPanel;
