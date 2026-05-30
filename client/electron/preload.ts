import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  setTitle: (title: string) => ipcRenderer.send('set-title', title),
});
