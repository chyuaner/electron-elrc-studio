# Enhanced LRC Studio（Electron 桌面版）

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

## 自動建置與下載（GitHub Actions）

推送至 `main` / `master` 時會自動在三平台建置，產物可在 GitHub **Actions** 分頁 → 該次 workflow → **Artifacts** 下載：

| Artifact | 內容 |
|----------|------|
| **Linux** | `.AppImage`、`.deb` |
| **Windows** | NSIS 安裝程式 `.exe` |
| **macOS** | `.dmg`（`macos-latest` runner，Apple Silicon） |

若要發佈正式版本並出現在 **Releases** 頁面供使用者下載：

```bash
git tag v1.0.0
git push origin v1.0.0
```

推送 `v*` tag 時會額外建立 [GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) 並附上各平台安裝檔。

> **Submodule**：CI 會執行 `submodules: recursive`，請確認 `aistudio-elrc-maker` 已提交至遠端且可被 Actions 存取。

## 自訂標題列（TopToolbar）

桌面版以 `TopToolbar` 作為標題列，依平台採用混合策略（邏輯在 repo 根目錄，不修改 `aistudio-elrc-maker`）：

| 平台 | 視窗外框 | 視窗按鈕 | 預留空間 |
|------|----------|----------|----------|
| **macOS** | `titleBarStyle: hiddenInset` | 系統紅綠燈（左側） | `--titlebar-left-padding: 70px` |
| **Windows** | `titleBarStyle: hidden` + `titleBarOverlay` | 系統覆蓋按鈕（右側） | `--titlebar-right-padding: 138px` |
| **Linux** | `frame: false` | 注入 HTML 三顆按鈕 | `--titlebar-right-padding: 138px` |

標題列拖曳：`globals.css` 內 `html.electron-shell header` 規則；Linux 另備 IPC 手動拖曳（Wayland 相容）。雙擊 `header` 可最大化／還原。

Linux 自訂三顆按鈕由 `ElectronWindowControls` 繪製於 `TopToolbar` 右側（需 `npm run build:web` 後才會出現在 dist）。

## 專案結構

| 路徑 | 說明 |
|------|------|
| `main.js` | Electron 主行程：視窗、本機靜態伺服器 |
| `preload.js` | 暴露 `window.electronAPI`（全螢幕、視窗控制等） |
| `electron-window.js` | 各平台無邊框／標題列覆蓋設定 |
| `electron-shell.css` | 拖曳區 `-webkit-app-region`、自訂視窗按鈕樣式 |
| `electron-bootstrap.js` | 注入標題列 padding、Linux 自訂三顆按鈕 |
| `static-server.js` | 載入 `aistudio-elrc-maker/dist` |
| `aistudio-elrc-maker/` | Git submodule（Next.js 前端） |
