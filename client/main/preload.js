"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    autoLoginToken: process.env.BIU_TOKEN || '',
    setTitle: (title) => electron_1.ipcRenderer.send('set-title', title),
    minimize: () => electron_1.ipcRenderer.send('window-minimize'),
    maximize: () => electron_1.ipcRenderer.send('window-maximize'),
    close: () => electron_1.ipcRenderer.send('window-close'),
    isMaximized: () => electron_1.ipcRenderer.invoke('window-is-maximized'),
    onMaximizedChanged: (callback) => {
        electron_1.ipcRenderer.on('window-maximized-changed', (_event, maximized) => callback(maximized));
    },
});
