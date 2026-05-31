const { app, BrowserWindow, ipcMain, shell, nativeTheme, dialog } = require('electron');

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
const {
  getNativeThemeSource,
  getThemeInjectionScript,
} = require('./electron-app-config');

const WEB_DIST = path.join(__dirname, 'web-elrc-studio', 'dist');
/** @type {import('http').Server | null} */
let staticServer = null;
let currentAppUrl = null;
let macFilesToOpen = [];

app.on('open-file', (event, path) => {
  event.preventDefault();
  if (app.isReady() && currentAppUrl) {
    createWindow(currentAppUrl, path);
  } else {
    macFilesToOpen.push(path);
  }
});

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

function broadcastWindowState(win) {
  if (!win) return;
  const state = {
    isMaximized: win.isMaximized(),
    isFullScreen: win.isFullScreen(),
  };
  win.webContents.send('window:state-changed', state);
}

function parseCliArgs(args) {
  const files = [];
  let exportAss = false;
  let exportAssValue = null;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--export-ass') {
      exportAss = true;
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        exportAssValue = args[i + 1];
        i++;
      }
    } else if (arg.startsWith('--export-ass=')) {
      exportAss = true;
      exportAssValue = arg.substring('--export-ass='.length);
    } else if (arg.toLowerCase().endsWith('.lrc')) {
      files.push(arg);
    }
  }

  return { files, exportAss, exportAssValue, help };
}

let cliHiddenWindow = null;

let pendingCliExportArgs = null;

function handleCliExport(files, exportAssValue) {
  pendingCliExportArgs = { files, exportAssValue };
  if (cliHiddenWindow) return;
  
  cliHiddenWindow = new BrowserWindow({
    ...getWindowOptions(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: false,
    },
  });

  cliHiddenWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[CLI] ${message}`);
  });

  cliHiddenWindow.loadURL(currentAppUrl);
}

const initialFiles = new Map();

function createWindow(appUrl, initialFilePath = null) {
  const win = new BrowserWindow({
    ...getWindowOptions(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  const webContentsId = win.webContents.id;
  if (initialFilePath) {
    initialFiles.set(webContentsId, initialFilePath);
  }

  win.on('closed', () => {
    initialFiles.delete(webContentsId);
  });

  win.on('maximize', () => broadcastWindowState(win));
  win.on('unmaximize', () => broadcastWindowState(win));
  win.on('enter-full-screen', () => broadcastWindowState(win));
  win.on('leave-full-screen', () => broadcastWindowState(win));
  win.on('focus', () => win.webContents.send('window:focus-changed', true));
  win.on('blur', () => win.webContents.send('window:focus-changed', false));

  win.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['確定離開', '取消'],
      title: '確認離開',
      message: '您有目前可能未儲存的歌詞變更。確定要離開嗎？',
      defaultId: 0,
      cancelId: 1
    });
    if (choice === 0) {
      event.preventDefault();
    }
  });

  const applyShell = () => {
    applyShellToWebContents(win).catch((err) => {
      console.warn('Failed to apply Electron shell:', err);
    });
    // 注入主題初始化 script（在 React hydration 之前執行）
    const themeScript = getThemeInjectionScript();
    win.webContents.executeJavaScript(themeScript).catch(() => {});
  };
  win.webContents.on('dom-ready', applyShell);
  win.webContents.on('did-finish-load', () => {
    applyShell();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL(appUrl);
  return win;
}

async function bootstrap() {
  // 套用主題設定（在建立視窗前設定，確保 nativeTheme 已就緒）
  nativeTheme.themeSource = getNativeThemeSource();
  currentAppUrl = await ensureAppUrl();
  
  const args = process.defaultApp ? process.argv.slice(2) : process.argv.slice(1);
  const parsedArgs = parseCliArgs(args);

  const allFiles = [...new Set([...parsedArgs.files, ...macFilesToOpen])];
  macFilesToOpen = []; // clear

  if (parsedArgs.exportAss && allFiles.length > 0) {
    handleCliExport(allFiles, parsedArgs.exportAssValue);
  } else if (allFiles.length > 0) {
    allFiles.forEach(filePath => createWindow(currentAppUrl, filePath));
  } else {
    createWindow(currentAppUrl);
  }
}

const earlyArgs = process.defaultApp ? process.argv.slice(2) : process.argv.slice(1);
const earlyParsed = parseCliArgs(earlyArgs);
if (earlyParsed.help) {
  console.log(`
Enhanced LRC Studio CLI 說明：

  用法:
    npx electron . [歌詞檔案.lrc] [選項]

  選項:
    -h, --help               顯示此說明訊息
    --export-ass             將指定的一個或多個 .lrc 歌詞檔匯出為 KTV .ass 字幕檔。
                             匯出樣式將自動採用您在 UI 中調整並儲存的設定（從 localStorage 讀取）。
                             可選附加參數以指定特定輸出路徑，例如：
                             --export-ass="輸出路徑.ass" 或 --export-ass "輸出路徑.ass"（僅適用於單一檔案匯出）

  範例:
    # 預設匯出（自動搜尋同資料夾同名影片大小並自動命名為 .ass）
    npx electron . "水星.lrc" --export-ass

    # 指定匯出檔名
    npx electron . "水星.lrc" --export-ass="自訂輸出.ass"
`);
  process.exit(0);
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (!currentAppUrl) return;
    const args = process.defaultApp ? commandLine.slice(2) : commandLine.slice(1);
    const parsedArgs = parseCliArgs(args);

    if (parsedArgs.exportAss && parsedArgs.files.length > 0) {
      handleCliExport(parsedArgs.files, parsedArgs.exportAssValue);
    } else if (parsedArgs.files.length > 0) {
      parsedArgs.files.forEach(filePath => createWindow(currentAppUrl, filePath));
    } else {
      createWindow(currentAppUrl);
    }
  });

  app.whenReady().then(() => {
    ipcMain.handle('window:toggle-fullscreen', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return false;
      const next = !win.isFullScreen();
      win.setFullScreen(next);
      broadcastWindowState(win);
      return next;
    });

    ipcMain.handle('window:get-state', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return { isMaximized: false, isFullScreen: false };
      return {
        isMaximized: win.isMaximized(),
        isFullScreen: win.isFullScreen(),
      };
    });

    ipcMain.on('window:minimize', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      win?.minimize();
    });

    ipcMain.on('window:toggle-maximize', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return;
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
      broadcastWindowState(win);
    });

    ipcMain.on('window:close', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      win?.close();
    });

    ipcMain.on('window:set-theme', (event, theme) => {
      nativeTheme.themeSource = theme;
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

  ipcMain.handle('fs:exists', (event, filePath) => {
    try {
      return fs.existsSync(filePath);
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('fs:read-file-binary', (event, filePath) => {
    try {
      return fs.readFileSync(filePath);
    } catch (e) {
      console.error('Error reading binary file:', e);
      throw e;
    }
  });

  ipcMain.handle('fs:read-file-text', (event, filePath) => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      console.error('Error reading text file:', e);
      throw e;
    }
  });

  ipcMain.handle('fs:read-dir', (event, dirPath) => {
    try {
      return fs.readdirSync(dirPath);
    } catch (e) {
      console.error('Error reading dir:', e);
      return [];
    }
  });

  ipcMain.handle('fs:write-file-text', (event, filePath, text) => {
    try {
      fs.writeFileSync(filePath, text, 'utf-8');
      return true;
    } catch (e) {
      console.error('Error writing text file:', e);
      throw e;
    }
  });

  ipcMain.on('cli-export-ass-done', () => {
    if (cliHiddenWindow) {
      cliHiddenWindow.close();
      cliHiddenWindow = null;
    }
  });

  ipcMain.handle('path:parse', (event, filePath) => {
    return path.parse(filePath);
  });

  ipcMain.handle('path:join', (event, ...paths) => {
    return path.join(...paths);
  });

  ipcMain.handle('cli:get-export-args', (event) => {
    const args = pendingCliExportArgs;
    pendingCliExportArgs = null; // Clear it so it's only retrieved once
    return args;
  });

  ipcMain.handle('cli:get-initial-file', (event) => {
    const filePath = initialFiles.get(event.sender.id);
    initialFiles.delete(event.sender.id); // Clear after retrieved
    return filePath || null;
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
}

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
