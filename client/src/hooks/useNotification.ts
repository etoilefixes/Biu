import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { Message } from '@biu/shared';

/**
 * 通知 hook：监听新消息，触发桌面通知
 * 角标更新由 TitleBar 组件负责
 */
export function useNotification() {
  const user = useAuthStore((s) => s.user);
  const conversations = useChatStore((s) => s.conversations);
  const globalEnabled = useNotificationStore((s) => s.globalEnabled);
  const soundEnabled = useNotificationStore((s) => s.soundEnabled);
  const isConversationMuted = useNotificationStore((s) => s.isConversationMuted);
  const isConversationShowPreview = useNotificationStore((s) => s.isConversationShowPreview);
  const loadConversationSettings = useNotificationStore((s) => s.loadConversationSettings);

  // 加载会话级通知设置
  useEffect(() => {
    if (user) {
      loadConversationSettings();
    }
  }, [user]);

  // 监听通知点击事件
  useEffect(() => {
    if (!window.electronAPI?.onNotificationClicked) return;

    window.electronAPI.onNotificationClicked((data) => {
      if (data.conversationId) {
        const conversation = conversations.find((c) => c.id === data.conversationId);
        if (conversation) {
          useChatStore.getState().selectConversation(conversation);
        }
      }
    });
  }, [conversations]);

  // 通知音效
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
  }, []);

  const playSound = useRef(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  });

  // 通知触发函数（供 chatStore 调用）
  const notifyRef = useRef((message: Message) => {
    if (!globalEnabled) return;
    if (!user) return;
    // 不通知自己的消息
    if (message.senderId === user.id) return;

    const conversationId = message.conversationId;

    // 检查会话是否免打扰
    if (isConversationMuted(conversationId)) return;

    // 检查窗口是否聚焦
    if (document.hasFocus()) return;

    const conversation = conversations.find((c) => c.id === conversationId);
    const convName = conversation?.name || '私聊';
    const showPreview = isConversationShowPreview(conversationId);

    const body = showPreview
      ? message.content.slice(0, 100)
      : '收到一条新消息';

    // 播放提示音
    playSound.current();

    // 发送桌面通知
    if (window.electronAPI?.showNotification) {
      window.electronAPI.showNotification({
        title: convName,
        body,
        conversationId,
      });
    }
  });

  return notifyRef;
}
