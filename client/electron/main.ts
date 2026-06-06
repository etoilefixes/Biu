import { app, BrowserWindow, ipcMain, Notification, nativeImage } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

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

  mainWindow = win;

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

  win.on('closed', () => {
    mainWindow = null;
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

// --- 通知系统 IPC ---

// 显示桌面通知
ipcMain.on('show-notification', (_event, data: { title: string; body: string; icon?: string; conversationId?: string }) => {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: data.title,
    body: data.body,
    icon: data.icon ? nativeImage.createFromDataURL(data.icon) : undefined,
    silent: false,
  });

  notification.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.send('notification-clicked', { conversationId: data.conversationId });
    }
  });

  notification.show();
});

// 设置任务栏角标（Windows overlay icon）
ipcMain.on('set-badge', (_event, data: { count: number }) => {
  if (!mainWindow) return;

  const count = data.count;

  // 更新标题栏未读数
  const title = count > 0 ? `[${count}] Biu` : 'Biu';
  mainWindow.setTitle(title);

  // Windows: overlay icon
  if (process.platform === 'win32') {
    if (count > 0) {
      // 创建角标图标
      const size = 16;
      const canvas = `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
          <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ef4444"/>
          <text x="${size / 2}" y="${size / 2 + 1}" text-anchor="middle" dominant-baseline="central"
            fill="white" font-size="10" font-weight="bold" font-family="Arial">${count > 99 ? '99' : count}</text>
        </svg>`
      )}`;
      const image = nativeImage.createFromDataURL(canvas);
      mainWindow.setOverlayIcon(image, `${count} 条未读消息`);
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
  }

  // macOS: dock badge
  if (process.platform === 'darwin') {
    app.dock.setBadge(count > 0 ? String(count) : '');
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
