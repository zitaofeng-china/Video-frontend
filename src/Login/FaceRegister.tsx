// src/Login/FaceRegister.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import axiosInstance from '../utils/axios';
import { API_ENDPOINTS } from '../config/api';
import './FaceRegister.css';

function FaceRegister() {
  const [message, setMessage] = useState('正在初始化系统...');
  const [messageType, setMessageType] = useState<'info' | 'success' | 'error' | 'processing'>('info');
  const [currentUser, setCurrentUser] = useState('');
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [descriptors, setDescriptors] = useState<Float32Array | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const videoElement = videoRef.current;
    const user = localStorage.getItem('currentUser');
    if (!user) {
      navigate('/login');
    } else {
      setCurrentUser(user);
      loadModels();
      startVideo();
    }

    return () => {
      if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [navigate]);

  const loadModels = async () => {
    try {
      setMessage('正在加载面部识别模型...');
      setMessageType('processing');
      
      // 确保按正确顺序加载模型
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      
      setIsModelLoaded(true);
      setMessage('模型加载成功！请确保面部在摄像头范围内');
      setMessageType('success');
    } catch (error) {
      console.error('模型加载失败:', error);
      setMessage('模型加载失败: ' + (error as Error).message);
      setMessageType('error');
      setIsModelLoaded(false);
    }
  };

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: 640, 
        height: 480,
        facingMode: 'user'
      } 
    })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // 等待视频元数据加载完成
          videoRef.current.onloadedmetadata = () => {
            console.log('视频元数据已加载');
            setMessage('摄像头已就绪，模型加载成功！请点击"采集面部数据"');
            setMessageType('success');
          };
          
          // 等待视频可以播放
          videoRef.current.oncanplay = () => {
            console.log('视频可以播放了');
          };
        }
      })
      .catch(err => {
        console.error('获取摄像头权限失败:', err);
        setMessage('无法访问摄像头: ' + err.message + '。请确保已授予摄像头权限。');
        setMessageType('error');
      });
  };

  const captureFace = async () => {
    if (!isModelLoaded || !videoRef.current) {
      setMessage('系统尚未准备好，请稍后重试');
      setMessageType('error');
      return;
    }

    setIsProcessing(true);
    setMessage('正在检测面部...');
    setMessageType('processing');
    
    try {
      // 确保模型已加载
      if (!faceapi.nets.tinyFaceDetector.isLoaded) {
        setMessage('人脸检测模型未加载');
        setMessageType('error');
        setIsProcessing(false);
        return;
      }

      if (!faceapi.nets.faceLandmark68Net.isLoaded) {
        setMessage('人脸特征点模型未加载');
        setMessageType('error');
        setIsProcessing(false);
        return;
      }

      if (!faceapi.nets.faceRecognitionNet.isLoaded) {
        setMessage('人脸识别模型未加载');
        setMessageType('error');
        setIsProcessing(false);
        return;
      }

      // 等待视频就绪
      if (!videoRef.current || videoRef.current.readyState < 2) {
        setMessage('摄像头正在启动，请稍后重试...');
        setMessageType('error');
        setIsProcessing(false);
        return;
      }

      // 再次检查视频尺寸
      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        setMessage('摄像头画面未加载完成，请稍后重试...');
        setMessageType('error');
        setIsProcessing(false);
        return;
      }

      const detections = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detections) {
        setDescriptors(detections.descriptor);
        setMessage('面部数据采集成功！请点击"注册面部数据"完成绑定');
        setMessageType('success');
        
        // 绘制面部框
        if (canvasRef.current && videoRef.current) {
          const dims = faceapi.matchDimensions(canvasRef.current, videoRef.current, true);
          const resizedResults = faceapi.resizeResults(detections, dims);
          const canvas = canvasRef.current.getContext('2d');
          if (canvas) {
            canvas.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            faceapi.draw.drawDetections(canvasRef.current, resizedResults);
            faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedResults);
          }
        }
        
        // 添加成功检测的视觉反馈
        if (videoRef.current) {
          videoRef.current.classList.add('face-detected');
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.classList.remove('face-detected');
            }
          }, 2000);
        }
      } else {
        setMessage('未检测到面部，请调整位置后重试');
        setMessageType('error');
        
        // 添加失败检测的视觉反馈
        if (videoRef.current) {
          videoRef.current.classList.add('face-not-detected');
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.classList.remove('face-not-detected');
            }
          }, 1000);
        }
      }
    } catch (error) {
      console.error('面部检测失败:', error);
      setMessage('面部检测失败: ' + (error as Error).message);
      setMessageType('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegisterFace = async () => {
    if (!descriptors) {
      setMessage('请先采集面部数据');
      setMessageType('error');
      return;
    }

    setIsProcessing(true);
    setMessage('正在注册面部数据...');
    setMessageType('processing');
    
    try {
      // 发送到后端API
      const response: any = await axiosInstance.post(API_ENDPOINTS.FACE_REGISTER, {
        username: currentUser,
        descriptor: Array.from(descriptors)
      });
      
      if (response.success) {
        setMessage('面部识别数据注册成功！您的面部已与账号 ' + currentUser + ' 绑定。');
        setMessageType('success');
        
        // 3秒后自动跳转
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        throw new Error('服务器返回错误状态');
      }
    } catch (error) {
      console.error('面部数据注册失败:', error);
      setMessage('面部数据注册失败: ' + (error as Error).message);
      setMessageType('error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="face-register-container">
      <div className="face-register-card">
        <h2 className="face-register-title">面部识别注册</h2>
        <p className="face-register-subtitle">为您的账户添加面部识别功能，提升安全性</p>
        
        {/* <div className="instructions">
          <h3>使用说明</h3>
          <ul>
            <li>确保面部完全在摄像头范围内</li>
            <li>保持光线充足且均匀</li>
            <li>正面对准摄像头，不要偏斜</li>
            <li>点击"采集面部数据"进行面部扫描</li>
            <li>确认采集成功后点击"注册面部数据"</li>
          </ul>
        </div> */}
        
        <div className="current-user-info">
          <div className="current-user-label">当前登录用户</div>
          <div className="current-user-value">{currentUser}</div>
        </div>
        
        <div className="video-section">
          <div className="video-wrapper">
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline
              className="video-feed"
            />
            <canvas 
              ref={canvasRef} 
              className="overlay-canvas"
            />
          </div>
        </div>
        
        <div className={`status-message ${messageType}`}>
          {message}
        </div>
        
        <div className="controls-section">
          <button 
            onClick={captureFace} 
            className="btn btn-primary" 
            disabled={!isModelLoaded || isProcessing}
          >
            {isProcessing ? (
              <>
                <span className="loading-spinner"></span>
                处理中...
              </>
            ) : (
              '采集面部数据'
            )}
          </button>
          <button 
            onClick={handleRegisterFace} 
            className="btn btn-secondary" 
            disabled={!descriptors || isProcessing}
          >
            {isProcessing ? (
              <>
                <span className="loading-spinner"></span>
                注册中...
              </>
            ) : (
              '注册面部数据'
            )}
          </button>
        </div>
        
        <div className="navigation-section">
          <button 
            onClick={() => navigate('/')} 
            className="btn btn-back"
          >
            ← 返回主页
          </button>
        </div>
      </div>
    </div>
  );
}

export default FaceRegister;
