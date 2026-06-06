interface Window {
  electronAPI?: {
    platform: string;
    autoLoginToken: string;
    setTitle: (title: string) => void;
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
    onMaximizedChanged: (callback: (maximized: boolean) => void) => void;
    // 通知系统
    showNotification: (data: { title: string; body: string; icon?: string; conversationId?: string }) => void;
    setBadge: (count: number) => void;
    onNotificationClicked: (callback: (data: { conversationId?: string }) => void) => void;
  };
}
