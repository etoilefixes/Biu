import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    title: 'Biu',
    backgroundColor: '#070B14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged || process.env.ELECTRON_DEV === '1';

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.on('maximize', () => {
    win.webContents.send('window-maximized-changed', true);
  });

  win.on('unmaximize', () => {
    win.webContents.send('window-maximized-changed', false);
  });
}

function getSenderWindow(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) {
  return BrowserWindow.fromWebContents(event.sender);
}

ipcMain.on('set-title', (event, title: string) => {
  getSenderWindow(event)?.setTitle(title);
});

ipcMain.on('window-minimize', (event) => {
  getSenderWindow(event)?.minimize();
});

ipcMain.on('window-maximize', (event) => {
  const win = getSenderWindow(event);
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on('window-close', (event) => {
  getSenderWindow(event)?.close();
});

ipcMain.handle('window-is-maximized', (event) => {
  return getSenderWindow(event)?.isMaximized() ?? false;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
