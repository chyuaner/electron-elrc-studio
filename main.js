const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { startStaticServer } = require('./static-server');

const WEB_DIST = path.join(__dirname, 'aistudio-elrc-maker', 'dist');
/** @type {import('http').Server | null} */
let staticServer = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;

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

function createWindow(appUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'LRC Maker Enhanced',
    autoHideMenuBar: true,
    show: false,
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
    return next;
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
