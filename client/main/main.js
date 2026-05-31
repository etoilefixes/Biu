"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        frame: false,
        title: 'Biu',
        backgroundColor: '#070B14',
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    const isDev = !electron_1.app.isPackaged || process.env.ELECTRON_DEV === '1';
    if (isDev) {
        win.loadURL('http://localhost:5173');
    }
    else {
        win.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    win.on('maximize', () => {
        win.webContents.send('window-maximized-changed', true);
    });
    win.on('unmaximize', () => {
        win.webContents.send('window-maximized-changed', false);
    });
}
function getSenderWindow(event) {
    return electron_1.BrowserWindow.fromWebContents(event.sender);
}
electron_1.ipcMain.on('set-title', (event, title) => {
    getSenderWindow(event)?.setTitle(title);
});
electron_1.ipcMain.on('window-minimize', (event) => {
    getSenderWindow(event)?.minimize();
});
electron_1.ipcMain.on('window-maximize', (event) => {
    const win = getSenderWindow(event);
    if (!win)
        return;
    if (win.isMaximized()) {
        win.unmaximize();
    }
    else {
        win.maximize();
    }
});
electron_1.ipcMain.on('window-close', (event) => {
    getSenderWindow(event)?.close();
});
electron_1.ipcMain.handle('window-is-maximized', (event) => {
    return getSenderWindow(event)?.isMaximized() ?? false;
});
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0)
        createWindow();
});
