import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useFriendStore } from '../store/friendStore';
import { socketService } from '../services/socket';
import api from '../services/api';
import NavBar from '../components/NavBar';
import TitleBar from '../components/TitleBar';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setReceivedRequests = useFriendStore((s) => s.setReceivedRequests);
  const addReceivedRequest = useFriendStore((s) => s.addReceivedRequest);

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

    socketService.onFriendRequest(() => {
      loadPendingRequests();
    });

    return () => {
      socketService.offFriendRequest();
    };
  }, [isAuthenticated, setReceivedRequests, addReceivedRequest]);

  return (
    <div className="flex flex-col h-screen gradient-bg page-transition">
      <div className="noise-overlay" />
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <NavBar />
        <Outlet />
      </div>
    </div>
  );
}
