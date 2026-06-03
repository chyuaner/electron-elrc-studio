const { contextBridge, ipcRenderer, webUtils } = require("electron");

/** 內嵌設定，避免 sandbox preload require 失敗導致 electronAPI 未暴露 */
function getShellConfig() {
  const platform = process.platform;

  if (platform === "darwin") {
    return {
      titlebarLeftPadding: "70px",
      titlebarRightPadding: "0px",
      useCustomWindowControls: false,
      useNativeWindowControls: true,
    };
  }

  if (platform === "win32") {
    return {
      titlebarLeftPadding: "0px",
      titlebarRightPadding: "138px",
      useCustomWindowControls: false,
      useNativeWindowControls: true,
    };
  }

  return {
    titlebarLeftPadding: "0px",
    titlebarRightPadding: "138px",
    useCustomWindowControls: true,
    useNativeWindowControls: false,
  };
}

const shell = getShellConfig();

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  shell,
  toggleFullscreen: () => ipcRenderer.invoke("window:toggle-fullscreen"),
  windowMinimize: () => ipcRenderer.send("window:minimize"),
  windowToggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
  windowClose: () => ipcRenderer.send("window:close"),
  windowSetTheme: (theme) => ipcRenderer.send("window:set-theme", theme),
  getWindowState: () => ipcRenderer.invoke("window:get-state"),
  onWindowStateChange: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("window:state-changed", handler);
    return () => ipcRenderer.removeListener("window:state-changed", handler);
  },
  /** Linux 無邊框視窗拖曳備援（Wayland 上 -webkit-app-region 可能無效） */
  windowDragStart: (pos) => ipcRenderer.send("window:drag-start", pos),
  windowDragMove: (pos) => ipcRenderer.send("window:drag-move", pos),
  windowDragEnd: () => ipcRenderer.send("window:drag-end"),
  needsManualWindowDrag: process.platform === "linux",
  /** 視窗焦點/失焦點通知 */
  onFocusChanged: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, focused) => callback(focused);
    ipcRenderer.on("window:focus-changed", handler);
    return () => ipcRenderer.removeListener("window:focus-changed", handler);
  },
  /** File System APIs for auto-loading matching files */
  fsExists: (filePath) => ipcRenderer.invoke("fs:exists", filePath),
  fsReadFileBinary: (filePath) => ipcRenderer.invoke("fs:read-file-binary", filePath),
  fsReadFileText: (filePath) => ipcRenderer.invoke("fs:read-file-text", filePath),
  fsWriteFileText: (filePath, text) => ipcRenderer.invoke("fs:write-file-text", filePath, text),
  fsWriteFileBinary: (filePath, buffer) =>
    ipcRenderer.invoke("fs:write-file-binary", filePath, buffer),
  fsReadDir: (dirPath) => ipcRenderer.invoke("fs:read-dir", dirPath),
  pathParse: (filePath) => ipcRenderer.invoke("path:parse", filePath),
  pathJoin: (...paths) => ipcRenderer.invoke("path:join", ...paths),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  showSaveDialog: (options) => ipcRenderer.invoke("dialog:show-save-dialog", options),
  getCliExportArgs: () => ipcRenderer.invoke("cli:get-export-args"),
  cliExportAssDone: () => ipcRenderer.send("cli-export-ass-done"),
  getInitialFile: () => ipcRenderer.invoke("cli:get-initial-file"),
});
