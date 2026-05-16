import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axios';
import { API_ENDPOINTS } from '../config/api';
import './Register.css'

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [message, setMessage] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendCode = async () => {
    if (!email) {
      setMessage('请输入邮箱地址');
      return;
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage('请输入有效的邮箱地址');
      return;
    }

    setIsSendingCode(true);
    try {
      const response: any = await axiosInstance.post(API_ENDPOINTS.SEND_CODE, { email });
      
      if (response.success) {
        setMessage('验证码已发送到您的邮箱');
        
        // 开发环境显示验证码（生产环境不会返回）
        if (response.code) {
          console.log('验证码（开发环境）:', response.code);
        }
        
        // 开始倒计时
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (error: any) {
      console.error('发送验证码错误:', error);
      setMessage(error.response?.data?.message || '发送验证码失败，请稍后重试');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !email || !password || !confirmPassword || !verificationCode) {
      setMessage('请填写所有字段');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setMessage('密码至少需要6个字符');
      return;
    }

    setLoading(true);
    try {
      // 先验证验证码
      await axiosInstance.post(API_ENDPOINTS.VERIFY_CODE, {
        email,
        code: verificationCode
      });

      // 注册用户
      const response: any = await axiosInstance.post(API_ENDPOINTS.REGISTER, {
        username,
        email,
        password
      });
      
      if (response.success) {
        // 保存 token 和用户信息
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('currentUser', response.data.user.username);
        
        setMessage('注册成功，即将跳转...');
        setTimeout(() => {
          navigate('/');
        }, 1000);
      }
    } catch (error: any) {
      console.error('注册失败:', error);
      setMessage(error.response?.data?.message || '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='register-page'>
      <div className="container">
      <div className="form-container">
        <h2 className="form-title">用户注册</h2>
        <form onSubmit={handleRegister} className="form">
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
            <label htmlFor="email" className="form-label">邮箱:</label>
            <div className="verification-group">
              <input
                type="email"
                id="email"
                className="form-input verification-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
              />
              <button 
                type="button" 
                className={`btn btn-secondary verification-btn ${isSendingCode || countdown > 0 ? 'countdown-button' : ''}`}
                onClick={handleSendCode}
                disabled={isSendingCode || countdown > 0}
              >
                {isSendingCode ? '发送中...' : countdown > 0 ? `${countdown}秒后重试` : '发送验证码'}
              </button>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="verificationCode" className="form-label">验证码:</label>
            <input
              type="text"
              id="verificationCode"
              className="form-input"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="请输入验证码"
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
              autoComplete="new-password"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">确认密码:</label>
            <input
              type="password"
              id="confirmPassword"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入密码"
              autoComplete="new-password"
            />
          </div>
          
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </button>
        </form>
        
        {message && (
          <div className="alert alert-info">
            {message}
          </div>
        )}
        
        <div className="form-footer">
          <button onClick={() => navigate('/login')} className="link-button">
            已有账号？立即登录
          </button>
        </div>
      </div>
      </div>
    </div>
    
  );
};

export default Register;