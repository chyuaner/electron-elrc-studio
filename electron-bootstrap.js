/**
 * 備援：在 React 掛載前設定標題列 CSS 變數（主要邏輯已移至 layout.tsx / TopToolbar）。
 */
(function electronShellBootstrap() {
  if (window.__electronShellBootstrapped) return;
  const api = window.electronAPI;
  if (!api?.isElectron || !api.shell) return;
  window.__electronShellBootstrapped = true;

  const { shell } = api;
  const root = document.documentElement;

  root.classList.add("electron-shell");

  if (shell.titlebarLeftPadding) {
    root.style.setProperty("--titlebar-left-padding", shell.titlebarLeftPadding);
  }
  if (shell.useCustomWindowControls) {
    root.style.setProperty("--titlebar-right-padding", "0px");
  } else if (shell.titlebarRightPadding) {
    root.style.setProperty("--titlebar-right-padding", shell.titlebarRightPadding);
  }
})();
