const { app, BrowserWindow, ipcMain, shell } = require('electron');

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
}
const path = require('path');
const fs = require('fs');
const { startStaticServer } = require('./static-server');
const {
  getWindowOptions,
  applyShellToWebContents,
} = require('./electron-window');

const WEB_DIST = path.join(__dirname, 'aistudio-elrc-maker', 'dist');
/** @type {import('http').Server | null} */
let staticServer = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;

/** @type {WeakMap<import('electron').BrowserWindow, { offsetX: number, offsetY: number }>} */
const windowDragState = new WeakMap();

function distExists() {
  return fs.existsSync(path.join(WEB_DIST, 'index.html'));
}

async function ensureAppUrl() {
  if (!distExists()) {
    throw new Error(
      '找不到前端建置產物。請先執行：npm run build:web\n' +
        `預期路徑：${WEB_DIST}/index.html`
    );
  }

  const { server, url } = await startStaticServer(WEB_DIST);
  staticServer = server;
  return url;
}

function broadcastWindowState() {
  if (!mainWindow) return;
  const state = {
    isMaximized: mainWindow.isMaximized(),
    isFullScreen: mainWindow.isFullScreen(),
  };
  mainWindow.webContents.send('window:state-changed', state);
}

function createWindow(appUrl) {
  mainWindow = new BrowserWindow({
    ...getWindowOptions(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('maximize', broadcastWindowState);
  mainWindow.on('unmaximize', broadcastWindowState);
  mainWindow.on('enter-full-screen', broadcastWindowState);
  mainWindow.on('leave-full-screen', broadcastWindowState);

  const applyShell = () => {
    applyShellToWebContents(mainWindow).catch((err) => {
      console.warn('Failed to apply Electron shell:', err);
    });
  };
  mainWindow.webContents.on('dom-ready', applyShell);
  mainWindow.webContents.on('did-finish-load', applyShell);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(appUrl);
}

async function bootstrap() {
  const appUrl = await ensureAppUrl();
  createWindow(appUrl);
}

app.whenReady().then(() => {
  ipcMain.handle('window:toggle-fullscreen', () => {
    if (!mainWindow) return false;
    const next = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    broadcastWindowState();
    return next;
  });

  ipcMain.handle('window:get-state', () => {
    if (!mainWindow) return { isMaximized: false, isFullScreen: false };
    return {
      isMaximized: mainWindow.isMaximized(),
      isFullScreen: mainWindow.isFullScreen(),
    };
  });

  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window:toggle-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    broadcastWindowState();
  });

  ipcMain.on('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.on('window:drag-start', (event, { x, y }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const [wx, wy] = win.getPosition();
    windowDragState.set(win, { offsetX: x - wx, offsetY: y - wy });
  });

  ipcMain.on('window:drag-move', (event, { x, y }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const state = win ? windowDragState.get(win) : null;
    if (!win || !state) return;
    win.setPosition(Math.round(x - state.offsetX), Math.round(y - state.offsetY));
  });

  ipcMain.on('window:drag-end', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) windowDragState.delete(win);
  });

  bootstrap().catch((err) => {
    console.error(err);
    app.exit(1);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bootstrap().catch((err) => {
        console.error(err);
        app.exit(1);
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
});
