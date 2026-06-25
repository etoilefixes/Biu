import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { socketService } from './services/socket';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingScreen from './components/LoadingScreen';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const AIChatPage = lazy(() => import('./pages/AIChatPage'));
const AppLayout = lazy(() => import('./layouts/AppLayout'));
const AILayout = lazy(() => import('./layouts/AILayout'));

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
        <Suspense fallback={<LoadingScreen />}>
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
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
