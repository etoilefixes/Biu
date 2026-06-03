import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';
import AvatarWithBadge from '../components/AvatarWithBadge';
import { User } from '@biu/shared';
import { IconSearch, IconAnnouncement, IconUsers, IconTrash, IconCrown, IconSend, IconX, IconCheck, IconShield, IconCheckCircle } from '../components/Icons';

const ROLES = [
  { value: 'user', label: '普通用户', color: 'text-gray-400', bg: 'bg-white/8', dot: 'bg-gray-500' },
  { value: 'admin', label: '管理员', color: 'text-amber-400', bg: 'bg-amber-400/10', dot: 'bg-amber-400' },
  { value: 'super_admin', label: '超级管理员', color: 'text-red-400', bg: 'bg-red-400/10', dot: 'bg-red-400' },
] as const;

const OFFICIAL_STATUSES = [
  { value: 'none', label: '未认证', color: 'text-gray-500', bg: 'bg-white/5', dot: 'bg-gray-600' },
  { value: 'verified', label: '官方认证', color: 'text-biu-primary', bg: 'bg-biu-primary/10', dot: 'bg-biu-primary' },
] as const;

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = Object.fromEntries(
  ROLES.map(r => [r.value, { label: r.label, color: r.color, bg: r.bg, dot: r.dot }])
);

const OFFICIAL_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = Object.fromEntries(
  OFFICIAL_STATUSES.map(s => [s.value, { label: s.label, color: s.color, bg: s.bg, dot: s.dot }])
);

export default function AdminPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ userId: string; nickname: string } | null>(null);
  const [roleDropdown, setRoleDropdown] = useState<{ userId: string; x: number; y: number } | null>(null);
  const [officialDropdown, setOfficialDropdown] = useState<{ userId: string; x: number; y: number } | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      const res = await api.get('/official/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const stats = useMemo(() => {
    const online = users.filter(u => u.status === 'online').length;
    const admins = users.filter(u => u.role === 'admin' || u.role === 'super_admin').length;
    const verified = users.filter(u => u.officialStatus === 'verified').length;
    return { total: users.length, online, admins, verified };
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u =>
      u.nickname?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.biuId?.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastContent.trim()) return;
    setLoading(true);
    try {
      await api.post('/official/broadcast', {
        title: broadcastTitle,
        content: broadcastContent,
      });
      setToast({ message: '广播已发送给所有用户', type: 'success' });
      setBroadcastTitle('');
      setBroadcastContent('');
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetRole = async (userId: string, role: 'user' | 'admin' | 'super_admin') => {
    try {
      await api.put(`/official/users/${userId}/role`, { role });
      setToast({ message: '角色已更新', type: 'success' });
      await loadUsers();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const handleSetOfficialStatus = async (userId: string, officialStatus: 'none' | 'verified') => {
    try {
      await api.put(`/official/users/${userId}/official-status`, { officialStatus });
      setToast({ message: '认证状态已更新', type: 'success' });
      await loadUsers();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await api.delete(`/official/users/${userId}`);
      setToast({ message: '用户已删除', type: 'success' });
      setConfirmAction(null);
      await loadUsers();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mx-auto mb-4">
            <IconX size={28} className="text-gray-500" />
          </div>
          <p className="text-gray-400 font-body">无权访问此页面</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
        <div className="w-8 h-8 rounded-xl bg-biu-primary/15 flex items-center justify-center">
          <IconCrown size={16} className="text-biu-primary" />
        </div>
        <div>
          <h1 className="text-white font-display font-600 text-sm tracking-wide">管理面板</h1>
          <p className="text-gray-500 text-xs font-body">用户管理与系统广播</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 animate-slide-up stagger-1" style={{ opacity: 0, animationFillMode: 'forwards' }}>
          <GlassCard className="p-4">
            <p className="text-gray-500 text-[11px] font-body font-medium mb-1">总用户</p>
            <p className="text-white font-display font-700 text-2xl">{stats.total}</p>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-gray-500 text-[11px] font-body font-medium mb-1">在线</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-biu-primary font-display font-700 text-2xl">{stats.online}</p>
              <span className="w-1.5 h-1.5 rounded-full bg-biu-primary animate-pulse-subtle" />
            </div>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-gray-500 text-[11px] font-body font-medium mb-1">管理员</p>
            <p className="text-amber-400 font-display font-700 text-2xl">{stats.admins}</p>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-gray-500 text-[11px] font-body font-medium mb-1">官方认证</p>
            <p className="text-biu-primary font-display font-700 text-2xl">{stats.verified}</p>
          </GlassCard>
        </div>

        {/* Broadcast Section */}
        <div className="animate-slide-up stagger-2" style={{ opacity: 0, animationFillMode: 'forwards' }}>
          <GlassCard className="p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-7 h-7 rounded-lg bg-biu-primary/15 flex items-center justify-center">
                <IconAnnouncement size={15} className="text-biu-primary" />
              </div>
              <h2 className="text-white font-display font-600 text-[13px]">发送系统广播</h2>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body text-sm"
                placeholder="广播标题"
              />
              <div className="relative">
                <textarea
                  value={broadcastContent}
                  onChange={(e) => setBroadcastContent(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body text-sm min-h-[100px] resize-none"
                  placeholder="写下你想对所有用户说的话..."
                />
                <span className="absolute bottom-3 right-3 text-[11px] font-body text-gray-600">
                  {broadcastContent.length}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-gray-600 text-[11px] font-body">
                  {broadcastTitle && broadcastContent
                    ? `将发送给全部 ${stats.total} 位用户`
                    : '请填写标题和内容'}
                </p>
                <button
                  onClick={handleSendBroadcast}
                  disabled={loading || !broadcastTitle.trim() || !broadcastContent.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-biu-primary hover:bg-biu-primary-dim text-biu-dark font-display font-600 text-sm transition-all duration-200 hover:shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="animate-pulse-subtle">发送中...</span>
                  ) : (
                    <>
                      <IconSend size={14} />
                      发送广播
                    </>
                  )}
                </button>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* User Management Section */}
        <div className="animate-slide-up stagger-3" style={{ opacity: 0, animationFillMode: 'forwards' }}>
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center">
                  <IconUsers size={15} className="text-gray-400" />
                </div>
                <h2 className="text-white font-display font-600 text-[13px]">用户管理</h2>
                <span className="px-2 py-0.5 rounded-md bg-white/8 text-gray-500 text-[11px] font-body font-medium">
                  {filteredUsers.length}
                </span>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <IconSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索用户名、昵称或 Biu 号"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl glass-input text-white placeholder-gray-600 outline-none font-body text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>

            {/* User List */}
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {filteredUsers.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-gray-600 font-body text-sm">
                    {searchQuery ? '没有找到匹配的用户' : '暂无用户'}
                  </p>
                </div>
              ) : (
                filteredUsers.map((u, i) => {
                  const roleCfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.user;
                  const officialCfg = OFFICIAL_CONFIG[u.officialStatus || 'none'] || OFFICIAL_CONFIG.none;

                  return (
                    <div
                      key={u.id}
                      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all duration-200"
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <AvatarWithBadge
                          fallback={u.nickname?.[0] || 'B'}
                          src={u.avatar}
                          badges={u.badges}
                          size="sm"
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white text-[13px] font-medium font-display truncate">{u.nickname}</p>
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-body font-600 ${roleCfg.color} ${roleCfg.bg}`}>
                            {roleCfg.label}
                          </span>
                          {u.officialStatus === 'verified' && (
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-body font-600 ${officialCfg.color} ${officialCfg.bg}`}>
                              {officialCfg.label}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-[11px] font-body truncate">
                          {u.biuId} · @{u.username}
                        </p>
                      </div>

                      {/* Actions */}
                      {u.id !== user?.id && (
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {/* 认证状态 - admin 可操作 */}
                        <button
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            if (officialDropdown?.userId === u.id) {
                              setOfficialDropdown(null);
                            } else {
                              setOfficialDropdown({ userId: u.id, x: rect.right, y: rect.bottom + 6 });
                            }
                          }}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg ${officialCfg.bg} ${officialCfg.color} text-[10px] font-body font-600 transition-all duration-200`}
                        >
                          <IconCheckCircle size={10} />
                          {officialCfg.label}
                        </button>
                        {/* 角色 - 仅 super_admin 可操作 */}
                        {isSuperAdmin && (
                        <button
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            if (roleDropdown?.userId === u.id) {
                              setRoleDropdown(null);
                            } else {
                              setRoleDropdown({ userId: u.id, x: rect.right, y: rect.bottom + 6 });
                            }
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${roleCfg.bg} hover:bg-white/12 ${roleCfg.color} text-[11px] font-body font-600 transition-all duration-200`}
                        >
                          <IconShield size={10} />
                          {roleCfg.label}
                        </button>
                        )}
                        <button
                          onClick={() => setConfirmAction({ userId: u.id, nickname: u.nickname })}
                          className="p-1.5 rounded-lg text-gray-600 hover:text-biu-accent hover:bg-biu-accent/10 transition-all duration-200"
                          title="删除用户"
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Role Dropdown (fixed, outside scroll container) - 仅 super_admin */}
      {isSuperAdmin && roleDropdown && (() => {
        const targetUser = users.find(u => u.id === roleDropdown.userId);
        if (!targetUser) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setRoleDropdown(null)} />
            <div
              className="fixed z-50 glass-strong rounded-xl py-1 min-w-[150px] shadow-2xl animate-scale-in border border-white/[0.08]"
              style={{ left: roleDropdown.x - 150, top: roleDropdown.y }}
            >
              <div className="px-3 py-1.5 border-b border-white/5">
                <span className="text-gray-500 text-[10px] font-body">系统角色</span>
              </div>
              {ROLES.map(r => (
                <button
                  key={r.value}
                  onClick={() => {
                    handleSetRole(roleDropdown.userId, r.value as any);
                    setRoleDropdown(null);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.06] transition text-left ${r.value === targetUser.role ? 'bg-white/[0.04]' : ''}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} />
                  <span className={`text-[11px] font-body font-600 ${r.color}`}>{r.label}</span>
                  {r.value === targetUser.role && <IconCheck size={12} className={`${r.color} ml-auto`} />}
                </button>
              ))}
            </div>
          </>
        );
      })()}

      {/* Official Status Dropdown */}
      {officialDropdown && (() => {
        const targetUser = users.find(u => u.id === officialDropdown.userId);
        if (!targetUser) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOfficialDropdown(null)} />
            <div
              className="fixed z-50 glass-strong rounded-xl py-1 min-w-[130px] shadow-2xl animate-scale-in border border-white/[0.08]"
              style={{ left: officialDropdown.x - 130, top: officialDropdown.y }}
            >
              <div className="px-3 py-1.5 border-b border-white/5">
                <span className="text-gray-500 text-[10px] font-body">认证状态</span>
              </div>
              {OFFICIAL_STATUSES.map(s => (
                <button
                  key={s.value}
                  onClick={() => {
                    handleSetOfficialStatus(officialDropdown.userId, s.value as any);
                    setOfficialDropdown(null);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.06] transition text-left ${s.value === (targetUser.officialStatus || 'none') ? 'bg-white/[0.04]' : ''}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  <span className={`text-[11px] font-body font-600 ${s.color}`}>{s.label}</span>
                  {s.value === (targetUser.officialStatus || 'none') && <IconCheck size={12} className={`${s.color} ml-auto`} />}
                </button>
              ))}
            </div>
          </>
        );
      })()}

      {/* Confirm Delete Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-strong rounded-2xl p-6 w-[340px] animate-scale-in shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-biu-accent/10 flex items-center justify-center mx-auto mb-4">
              <IconTrash size={22} className="text-biu-accent" />
            </div>
            <h3 className="text-white font-display font-600 text-base text-center mb-2">确认删除</h3>
            <p className="text-gray-400 text-sm font-body text-center mb-6">
              确定要删除用户 <span className="text-white font-medium">「{confirmAction.nickname}」</span> 吗？此操作不可恢复。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 rounded-xl glass text-gray-400 hover:text-white font-display font-600 text-sm transition-all duration-200"
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteUser(confirmAction.userId)}
                className="flex-1 py-2.5 rounded-xl bg-biu-accent hover:bg-biu-accent/80 text-white font-display font-600 text-sm transition-all duration-200 hover:shadow-glow-accent"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      ` }} />
    </div>
  );
}
