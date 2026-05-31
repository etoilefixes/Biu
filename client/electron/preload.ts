import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  setTitle: (title: string) => ipcRenderer.send('set-title', title),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizedChanged: (callback: (maximized: boolean) => void) => {
    ipcRenderer.on('window-maximized-changed', (_event, maximized) => callback(maximized));
  },
});
