import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function AILayout() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    const hasAIBadge = user?.badges?.some((b) => b.type === 'AI');
    if (!hasAIBadge && user?.username !== 'biu_ai') {
      navigate('/chat');
    }
  }, [user, navigate]);

  return (
    <div className="h-screen w-screen overflow-hidden">
      <Outlet />
    </div>
  );
}
