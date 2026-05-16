import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import axiosInstance from '../utils/axios';
import { API_ENDPOINTS } from '../config/api';
import './FaceLogin.css';


function FaceLogin() {
  const [message, setMessage] = useState('');
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const videoElement = videoRef.current;
    loadModels();
    startVideo();

    return () => {
      if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const loadModels = async () => {
    try {
      setMessage('正在加载模型...');
      // 确保按正确顺序加载模型
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      setIsModelLoaded(true);
      setMessage('模型加载成功，可以开始面部识别登录');
    } catch (error) {
      console.error('模型加载失败:', error);
      setMessage('模型加载失败: ' + (error as Error).message);
      setIsModelLoaded(false);
    }
  };

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.error('获取摄像头权限失败:', err);
        setMessage('无法访问摄像头: ' + err.message);
      });
  };

  const handleFaceLogin = async () => {
    if (!isModelLoaded || !videoRef.current) {
      setMessage('系统尚未准备好，请稍后重试');
      return;
    }

    setIsProcessing(true);
    try {
      // 确保模型已加载
      if (!faceapi.nets.tinyFaceDetector.isLoaded) {
        setMessage('人脸检测模型未加载');
        setIsProcessing(false);
        return;
      }

      if (!faceapi.nets.faceLandmark68Net.isLoaded) {
        setMessage('人脸特征点模型未加载');
        setIsProcessing(false);
        return;
      }

      if (!faceapi.nets.faceRecognitionNet.isLoaded) {
        setMessage('人脸识别模型未加载');
        setIsProcessing(false);
        return;
      }

      // 检查视频元素是否就绪
      if (!videoRef.current || videoRef.current.videoWidth === 0) {
        setMessage('视频流尚未就绪，请稍后重试');
        setIsProcessing(false);
        return;
      }

      setMessage('正在检测面部...');
      
      // 检测人脸并获取特征
      const detections = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detections) {
        setMessage('面部检测成功，正在匹配...');
        
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

        // 调用后端 API 进行人脸识别
        setMessage('正在识别...');
        try {
          const response: any = await axiosInstance.post(API_ENDPOINTS.FACE_LOGIN, {
            descriptor: Array.from(detections.descriptor)
          });
          
          if (response.success) {
            // 保存 token 和用户信息
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('currentUser', response.data.user.username);
            localStorage.setItem('isFaceLogin', 'true');
            
            setMessage(`面部识别成功，欢迎 ${response.data.user.username}!`);
            setTimeout(() => {
              navigate('/');
            }, 1000);
          }
        } catch (error: any) {
          console.error('人脸识别失败:', error);
          setMessage(error.response?.data?.message || '人脸识别失败，请重试');
        }
      } else {
        setMessage('未检测到面部，请调整位置后重试');
      }
    } catch (error) {
      console.error('面部识别失败:', error);
      setMessage('面部识别失败，请重试: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
  <div className="login-page">
    <div className="container">
      <div className="form-container">
        <h2 className="form-title">面部识别登录</h2>
        
        <div className="content">
          <div className="message-info">
            <p>{message}</p>
          </div>
          
          <div className="video-container">
            <div className="video-wrapper">
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline
                className="video-element"
              />
              <canvas 
                ref={canvasRef} 
                className="canvas-element"
              />
            </div>
          </div>
          
          <div className="button-group">
            <button 
              onClick={handleFaceLogin} 
              className="btn btn-primary" 
              disabled={!isModelLoaded || isProcessing}
            >
              {isProcessing ? '识别中...' : '面部识别登录'}
            </button>
          </div>
        </div>
        
        <div className="form-footer">
          <button onClick={() => navigate('/login')} className="link-button">
            账号密码登录
          </button>
          <span style={{ margin: '0 10px', color: '#999' }}>|</span>
          <button onClick={() => navigate('/register')} className="link-button">
            注册账号
          </button>
        </div>
      </div>
    </div>
  </div>
);
}

export default FaceLogin;
