// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login/Login';
import Register from './Login/Register';
import Shouye from './Shouye/Shouye';
import PrivateRoute from './Login/PrivateRoute';
import FaceRegister from './Login/FaceRegister';
import FaceLogin from './Login/FaceLogin';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="App">
          <Routes>
            {/* Login routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/face-login" element={<FaceLogin />} />

            {/* Protected routes */}
            <Route path="/" element={
              <PrivateRoute>
                <Shouye />
              </PrivateRoute>
            } />
            <Route path="/face-register" element={
              <PrivateRoute>
                <FaceRegister />
              </PrivateRoute>
            } />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
}
