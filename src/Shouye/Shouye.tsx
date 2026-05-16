import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axios';
import { API_ENDPOINTS } from '../config/api';
import VideoChat from '../ViedeoChat/VideoChat';
import './Shouye.css';

type ModalType = 'join' | 'quick' | 'schedule' | 'share' | null;

const sanitizeUsername = (value: string | null | undefined) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
    return '';
  }
  return trimmed;
};

export default function Shouye() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [username, setUsername] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [avatar, setAvatar] = useState('');
  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  const [joined, setJoined] = useState(false);

  const effectiveUsername = useMemo(() => {
    return sanitizeUsername(username) || sanitizeUsername(userId) || sanitizeUsername(localStorage.getItem('currentUser'));
  }, [username, userId]);

  const fetchUserInfo = useCallback(async () => {
    try {
      const response: any = await axiosInstance.get(API_ENDPOINTS.ME);
      if (response.success && response.data) {
        const user = response.data;
        const registeredUsername = sanitizeUsername(user.username);

        if (registeredUsername) {
          setUsername(registeredUsername);
          setUserId(registeredUsername);
          localStorage.setItem('currentUser', registeredUsername);
        }

        if (user.avatar) {
          setAvatar(user.avatar);
        }
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('currentUser');
      setIsLoggedIn(false);
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsLoggedIn(false);
      navigate('/login');
      return;
    }

    const storedUsername = sanitizeUsername(localStorage.getItem('currentUser'));
    if (storedUsername) {
      setUsername(storedUsername);
      setUserId(storedUsername);
    }

    fetchUserInfo();

    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('roomId');
    if (roomIdFromUrl) {
      setRoomId(roomIdFromUrl.toUpperCase());
      setActiveModal('join');
    }
  }, [fetchUserInfo, navigate]);

  const closeModal = () => setActiveModal(null);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('currentUser');
    setIsLoggedIn(false);
    setShowUserMenu(false);
    setJoined(false);
    navigate('/login');
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.match('image.*')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setAvatar(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 10).toUpperCase();
    setRoomId(id);
  };

  const handleJoinMeeting = () => {
    if (!roomId || !effectiveUsername) {
      return;
    }

    setUserId(effectiveUsername);
    setJoined(true);

    const url = new URL(window.location.href);
    url.searchParams.set('roomId', roomId);
    url.searchParams.set('userId', effectiveUsername);
    window.history.pushState({}, '', url.toString());
  };

  const startQuickMeeting = () => {
    const meetingId = Math.floor(100000000 + Math.random() * 900000000).toString();
    if (!effectiveUsername) {
      return;
    }

    setRoomId(meetingId);
    setUserId(effectiveUsername);
    setJoined(true);

    const url = new URL(window.location.href);
    url.searchParams.set('roomId', meetingId);
    url.searchParams.set('userId', effectiveUsername);
    window.history.pushState({}, '', url.toString());
  };

  const startScreenShare = () => {
    alert('请先加入房间后再分享屏幕共享');
    closeModal();
  };

  const gotozhuceface = () => {
    navigate('/face-register');
  };

  const getAvatarUrl = () => {
    if (avatar) {
      return avatar;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(effectiveUsername || 'User')}&background=0D8ABC&color=fff`;
  };

  if (joined) {
    return <VideoChat roomId={roomId} userId={effectiveUsername} />;
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="shouye-container">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleFileChange}
      />

      <header className="shouye-header">
        <h1>视频会议系统</h1>
        <div className="user-info">
          <div className="user-avatar" onClick={() => setShowUserMenu((prev) => !prev)}>
            <img src={getAvatarUrl()} alt="用户头像" />
          </div>

          {showUserMenu && (
            <div className="user-menu">
              <div className="user-menu-header">
                <div className="user-menu-avatar" onClick={triggerFileSelect}>
                  <img src={getAvatarUrl()} alt="用户头像" />
                </div>
                <div className="user-menu-info">
                  <div className="user-menu-name">{effectiveUsername}</div>
                  <div className="user-menu-id">当前登录用户</div>
                </div>
              </div>
              <ul className="user-menu-list">
                <li className="user-menu-item" onClick={() => setActiveModal('join')}>
                  <span className="icon-meeting">📹</span>
                  <span>加入会议</span>
                </li>
                <li className="user-menu-item" onClick={gotozhuceface}>
                  <span className="icon-about">👤</span>
                  <span>注册人脸</span>
                </li>
                <li className="user-menu-item logout-item" onClick={handleLogout}>
                  <span className="icon-logout">🚪</span>
                  <span>退出登录</span>
                </li>
              </ul>
            </div>
          )}

          {showUserMenu && <div className="menu-overlay" onClick={() => setShowUserMenu(false)} />}
        </div>
      </header>

      <div className="shouye-content">
        <main className="shouye-main">
          <div className="home-page">
            <h2>欢迎使用视频会议系统，{effectiveUsername}！</h2>
            <div className="function-buttons">
              <div className="function-button" onClick={() => setActiveModal('join')}>
                <div className="button-icon">📹</div>
                <div className="button-text">加入会议</div>
              </div>
              <div className="function-button" onClick={() => setActiveModal('quick')}>
                <div className="button-icon">⚡</div>
                <div className="button-text">快速会议</div>
              </div>
              <div className="function-button" onClick={() => setActiveModal('schedule')}>
                <div className="button-icon">📅</div>
                <div className="button-text">预约会议</div>
              </div>
              <div className="function-button" onClick={() => setActiveModal('share')}>
                <div className="button-icon">🖥️</div>
                <div className="button-text">共享屏幕</div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {activeModal === 'join' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>加入会议</h2>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={(e) => {
                e.preventDefault();
                handleJoinMeeting();
              }}>
                <div className="form-group">
                  <label>房间号:</label>
                  <div className="input-with-button">
                    <input
                      type="text"
                      placeholder="请输入房间号"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    />
                    <button type="button" onClick={generateRoomId} className="generate-btn">
                      生成
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>用户名:</label>
                  <input
                    type="text"
                    placeholder="将自动使用注册用户名"
                    value={effectiveUsername}
                    readOnly
                  />
                  <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    将自动使用您注册时的用户名: {effectiveUsername}
                  </small>
                </div>
                <button type="submit" disabled={!roomId || !effectiveUsername}>加入会议</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'quick' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>快速会议</h2>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="quick-meeting-content">
                <p>点击下方按钮立即开始会议。</p>
                <button onClick={startQuickMeeting} disabled={!effectiveUsername}>开始快速会议</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'schedule' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>预约会议</h2>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <p>预约会议功能尚未开发，敬请期待。</p>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'share' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>共享屏幕</h2>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="share-screen-content">
                <p>点击下方按钮开始共享您的屏幕。</p>
                <button onClick={startScreenShare}>开始共享屏幕</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
