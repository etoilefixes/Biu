import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useFriendStore } from '../store/friendStore';
import api from '../services/api';
import NavBar from '../components/NavBar';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setReceivedRequests = useFriendStore((s) => s.setReceivedRequests);

  useEffect(() => {
    if (!isAuthenticated) return;

    const loadPendingRequests = async () => {
      try {
        const res: any = await api.get('/friends/requests');
        setReceivedRequests(res.data.received);
      } catch (err) {
        console.error('Failed to load friend requests:', err);
      }
    };

    loadPendingRequests();
  }, [isAuthenticated, setReceivedRequests]);

  return (
    <div className="flex h-screen gradient-bg page-transition">
      <div className="noise-overlay" />
      <NavBar />
      <Outlet />
    </div>
  );
}
