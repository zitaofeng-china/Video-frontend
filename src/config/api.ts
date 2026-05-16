// src/config/api.ts
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8080/ws';

export const API_ENDPOINTS = {
  // 认证接口
  LOGIN: `${API_BASE_URL}/auth/login`,
  REGISTER: `${API_BASE_URL}/auth/register`,
  ME: `${API_BASE_URL}/auth/me`,
  UPDATE_USER: `${API_BASE_URL}/auth/update`,
  CHANGE_PASSWORD: `${API_BASE_URL}/auth/change-password`,
  
  // 人脸识别接口
  FACE_DATA: `${API_BASE_URL}/face/data`,
  FACE_REGISTER: `${API_BASE_URL}/face/register`,
  FACE_LOGIN: `${API_BASE_URL}/face/login`,
  FACE_DELETE: (username: string) => `${API_BASE_URL}/face/data/${username}`,
  
  // 邮件接口
  SEND_CODE: `${API_BASE_URL}/email/send-code`,
  VERIFY_CODE: `${API_BASE_URL}/email/verify-code`,
};

// WebSocket URL 生成函数
export const getWebSocketUrl = (roomId: string, userId: string) => {
  return `${WS_BASE_URL}/${roomId}/${userId}`;
};

export default API_BASE_URL;
