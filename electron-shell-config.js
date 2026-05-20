/** 深色主題標題列（對齊 globals.css / TopToolbar） */
const TITLEBAR_COLORS = {
  background: '#16191E',
  symbol: '#E0E0E0',
  height: 32,
};

/**
 * @returns {import('electron').BrowserWindowConstructorOptions}
 */
function getWindowOptions() {
  const platform = process.platform;
  const base = {
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'LRC Maker Enhanced',
    autoHideMenuBar: true,
    show: false,
    backgroundColor: TITLEBAR_COLORS.background,
  };

  if (platform === 'darwin') {
    return {
      ...base,
      frame: true,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 14, y: 14 },
    };
  }

  if (platform === 'win32') {
    return {
      ...base,
      frame: true,
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: TITLEBAR_COLORS.background,
        symbolColor: TITLEBAR_COLORS.symbol,
        height: TITLEBAR_COLORS.height,
      },
    };
  }

  return {
    ...base,
    frame: false,
  };
}

/**
 * @returns {{
 *   titlebarLeftPadding: string;
 *   titlebarRightPadding: string;
 *   useCustomWindowControls: boolean;
 *   useNativeWindowControls: boolean;
 * }}
 */
function getShellConfig() {
  const platform = process.platform;

  if (platform === 'darwin') {
    return {
      titlebarLeftPadding: '70px',
      titlebarRightPadding: '0px',
      useCustomWindowControls: false,
      useNativeWindowControls: true,
    };
  }

  if (platform === 'win32') {
    return {
      titlebarLeftPadding: '0px',
      titlebarRightPadding: '138px',
      useCustomWindowControls: false,
      useNativeWindowControls: true,
    };
  }

  return {
    titlebarLeftPadding: '0px',
    titlebarRightPadding: '138px',
    useCustomWindowControls: true,
    useNativeWindowControls: false,
  };
}

module.exports = {
  getWindowOptions,
  getShellConfig,
  TITLEBAR_COLORS,
};
