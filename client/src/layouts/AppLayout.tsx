import React from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from '../components/NavBar';

export default function AppLayout() {
  return (
    <div className="flex h-screen gradient-bg page-transition">
      <NavBar />
      <Outlet />
    </div>
  );
}
