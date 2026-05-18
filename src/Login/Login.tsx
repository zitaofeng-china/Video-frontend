import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axios';
import { API_ENDPOINTS } from '../config/api';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      setMessage('请输入用户名和密码');
      return;
    }

    setLoading(true);
    try {
      const response: any = await axiosInstance.post(API_ENDPOINTS.LOGIN, {
        username,
        password
      });
      
      if (response.success) {
        // 保存 token 和用户信息
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('currentUser', response.data.user.username);
        
        setMessage('登录成功');
        setTimeout(() => {
          navigate('/');
        }, 1000);
      }
    } catch (error: any) {
      console.error('登录失败:', error);
      setMessage(error.response?.data?.message || '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="container">
        <div className="form-container">
          {/* Logo 和品牌名称 */}
          <div className="brand-header">
            <img src="favicon.svg" alt="SoundLink Logo" className="brand-logo" />
            <h1 className="brand-name">SoundLink</h1>
            <p className="brand-tagline">智能视频通话平台</p>
          </div>
          
          <h2 className="form-title">用户登录</h2>
          <form onSubmit={handleLogin} className="form">
            <div className="form-group">
              <label htmlFor="username" className="form-label">用户名:</label>
              <input
                type="text"
                id="username"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                autoComplete="username"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password" className="form-label">密码:</label>
              <input
                type="password"
                id="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </div>
            
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
          
          {message && (
            <div className="alert alert-info">
              {message}
            </div>
          )}
          
          <div className="form-footer">
            <button 
              onClick={() => navigate('/register')}
              className="link-button"
            >
              账号注册
            </button>
            <span style={{ margin: '0 10px', color: '#999' }}>|</span>
            <button 
              onClick={() => navigate('/face-login')}
              className="link-button"
            >
              face-api.js 人脸登录
            </button>
          </div>
        </div>
      </div>
    </div>
    
  );
};

export default Login;