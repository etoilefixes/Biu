import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  autoLoginToken: process.env.BIU_TOKEN || '',
  setTitle: (title: string) => ipcRenderer.send('set-title', title),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizedChanged: (callback: (maximized: boolean) => void) => {
    ipcRenderer.on('window-maximized-changed', (_event, maximized) => callback(maximized));
  },
  // 通知系统
  showNotification: (data: { title: string; body: string; icon?: string; conversationId?: string }) =>
    ipcRenderer.send('show-notification', data),
  setBadge: (count: number) => ipcRenderer.send('set-badge', { count }),
  onNotificationClicked: (callback: (data: { conversationId?: string }) => void) => {
    ipcRenderer.on('notification-clicked', (_event, data) => callback(data));
  },
});
