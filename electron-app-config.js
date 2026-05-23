/**
 * ============================================================
 * electron-app-config.js — Electron 應用程式固定參數設定
 * ============================================================
 *
 * 此檔案集中管理本 Electron 殼層的可調整參數。
 * 修改後重新啟動應用程式生效。
 *
 * 注意：此檔案僅影響 Electron 殼層層面的設定（視窗外框、主題注入等），
 * 不影響 aistudio-elrc-maker 子模組本身的程式碼。
 */

// ─── 主題模式 ────────────────────────────────────────────────
// 控制應用程式的深淺色主題：
//   'dark'   → 強制深色（Dark Mode）
//   'light'  → 強制淺色（Light Mode）
//   'system' → 跟隨系統設定（prefers-color-scheme）
const THEME_MODE = 'system';

// ─── 視窗圓角 ─────────────────────────────────────────────────
// 無框視窗（Linux / frameless）是否套用圓角效果。
// 實現方式：純 CSS（html.rounded-window body { border-radius: 10px }），
// 由 main.js 在 dom-ready 後注入 class，不使用 Electron roundedCorners 選項
//（該選項僅 macOS 支援，在 Linux 上設定會造成崩潰）。
const ROUNDED_WINDOW = false;

// ─── 失焦淡化 ─────────────────────────────────────────────────
// 視窗失去焦點時，TopToolbar 是否淡化（目前由 TopToolbar.tsx 控制，
// 此處預留給未來可能的殼層層 CSS 覆寫）
const UNFOCUSED_TOOLBAR_DIM = true;

// ============================================================
// 以下為讀取函式，供 electron-window.js / main.js 引用
// ============================================================

/**
 * 取得主題模式設定。
 * @returns {'dark' | 'light' | 'system'}
 */
function getThemeMode() {
  const valid = ['dark', 'light', 'system'];
  return valid.includes(THEME_MODE) ? THEME_MODE : 'system';
}

/**
 * 產生注入到頁面 <html> 的主題初始化 script（inline JS 字串）。
 * 此 script 在 React hydration 之前執行，避免閃白。
 * @returns {string}
 */
function getThemeInjectionScript() {
  const mode = getThemeMode();

  if (mode === 'dark') {
    return `
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    `;
  }

  if (mode === 'light') {
    return `
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    `;
  }

  // 'system': 讀取 OS 設定
  return `
    (function() {
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    })();
  `;
}

/**
 * 取得要套用到 nativeTheme 的設定（供 main process 傳給 Electron）。
 * @returns {'dark' | 'light' | 'system'}
 */
function getNativeThemeSource() {
  return getThemeMode();
}

/**
 * 取得要注入的圓角視窗 CSS（透過 insertCSS 注入，不依賴 JS class）。
 * 若 ROUNDED_WINDOW 為 false，回傳空字串。
 * @returns {string}
 */
function getRoundedWindowCSS() {
  if (!ROUNDED_WINDOW) return '';
  return `
    html {
      background: transparent !important;
    }
    html, body {
      border-radius: 10px !important;
      overflow: hidden !important;
    }
  `;
}

module.exports = {
  THEME_MODE,
  ROUNDED_WINDOW,
  UNFOCUSED_TOOLBAR_DIM,
  getThemeMode,
  getThemeInjectionScript,
  getNativeThemeSource,
  getRoundedWindowCSS,
};
