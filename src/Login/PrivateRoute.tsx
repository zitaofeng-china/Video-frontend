import React from 'react';
import { Navigate } from 'react-router-dom';

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  // 检查用户是否已登录（这里简单地检查localStorage中是否有用户信息）
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  
  // 如果用户已认证，渲染子组件，否则重定向到登录页面
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

export default PrivateRoute;