import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { socketService } from './services/socket';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import AIChatPage from './pages/AIChatPage';
import AppLayout from './layouts/AppLayout';
import AILayout from './layouts/AILayout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  const { isAuthenticated, loadUser, token, user } = useAuthStore();

  useEffect(() => {
    if (token) {
      loadUser();
      socketService.connect(token);
    }
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          <Route
            element={
              <PrivateRoute>
                <AILayout />
              </PrivateRoute>
            }
          >
            <Route path="/ai-chat" element={<AIChatPage />} />
          </Route>
          
          <Route
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route path="/chat" element={<ChatPage />} />
          </Route>
          
          <Route 
            path="*" 
            element={<Navigate to={isAuthenticated ? (user?.username === 'biu_ai' ? '/ai-chat' : '/chat') : '/login'} />} 
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
