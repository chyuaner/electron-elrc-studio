# LRC Maker Enhanced（Electron 桌面版）

將 [aistudio-elrc-maker](https://github.com/chyuaner/aistudio-elrc-maker)（Next.js 靜態匯出）包裝為 Electron 桌面應用程式。

## 需求

- Node.js 20+
- npm

首次 clone 後請初始化 submodule：

```bash
git submodule update --init --recursive
```

## 疑難排解

若啟動時出現 `Cannot read properties of undefined (reading 'whenReady')`，通常是環境變數 `ELECTRON_RUN_AS_NODE=1` 所致（部分 IDE / CI 會設定）。本專案腳本已透過 `cross-env` 清除該變數；手動執行時可改用：

```bash
env -u ELECTRON_RUN_AS_NODE npm start
```

## 開發（桌面視窗模式）

`npm run dev` 會先建置前端靜態檔（與正式打包相同），再以 Electron 視窗載入，等同測試桌面應用程式效果。修改 `aistudio-elrc-maker` 原始碼後會自動重新建置並重啟視窗。

```bash
npm install
npm run dev
```

若只想在瀏覽器用 Next.js 熱更新除錯前端：

```bash
npm run dev:web
```

## 正式執行

```bash
npm run build:web
npm start
```

## 打包安裝檔

```bash
npm run dist
```

產物位於 `release/`（Linux：AppImage / deb，Windows：nsis，macOS：dmg）。

## 專案結構

| 路徑 | 說明 |
|------|------|
| `main.js` | Electron 主行程：視窗、本機靜態伺服器 |
| `preload.js` | 暴露 `window.electronAPI`（全螢幕等） |
| `static-server.js` | 載入 `aistudio-elrc-maker/dist` |
| `aistudio-elrc-maker/` | Git submodule（Next.js 前端） |
