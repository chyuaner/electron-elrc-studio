const path = require('path');
const fs = require('fs');
const {
  getWindowOptions,
  getShellConfig,
  TITLEBAR_COLORS,
} = require('./electron-shell-config');
const { getRoundedWindowCSS } = require('./electron-app-config');

let cachedShellCss = null;
let cachedBootstrapJs = null;

function readShellAssets() {
  if (!cachedShellCss) {
    cachedShellCss = fs.readFileSync(
      path.join(__dirname, 'electron-shell.css'),
      'utf8'
    );
  }
  if (!cachedBootstrapJs) {
    cachedBootstrapJs = fs.readFileSync(
      path.join(__dirname, 'electron-bootstrap.js'),
      'utf8'
    );
  }
  return { css: cachedShellCss, bootstrap: cachedBootstrapJs };
}

/**
 * @param {import('electron').BrowserWindow} win
 */
async function applyShellToWebContents(win) {
  const { css, bootstrap } = readShellAssets();
  await win.webContents.insertCSS(css);
  // 圓角視窗 CSS（透過 insertCSS 注入，最可靠，不受 JS 執行時序影響）
  const roundedCss = getRoundedWindowCSS();
  if (roundedCss) {
    await win.webContents.insertCSS(roundedCss);
  }
  await win.webContents.executeJavaScript(bootstrap, true);
}

/**
 * @param {import('electron').BrowserWindow} win
 */
function updateTitleBarOverlayTheme(win, isDark) {
  if (process.platform !== 'win32' || !win.setTitleBarOverlay) return;
  win.setTitleBarOverlay({
    color: isDark ? TITLEBAR_COLORS.background : '#f0f2f5',
    symbolColor: isDark ? TITLEBAR_COLORS.symbol : '#374151',
    height: TITLEBAR_COLORS.height,
  });
}

module.exports = {
  getWindowOptions,
  getShellConfig,
  applyShellToWebContents,
  updateTitleBarOverlayTheme,
  TITLEBAR_COLORS,
};
