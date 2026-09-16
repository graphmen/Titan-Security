const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const DEFAULT_APP_URL = 'https://titanprotection.org';
const APP_URL = (process.env.TITAN_APP_URL || DEFAULT_APP_URL).replace(/\/$/, '');

let mainWindow;

function logMessage(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.map((p) => String(p)).join(' ')}\n`;
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'titan-desktop.log'), line);
  } catch {
    // ignore logging failures during early startup
  }
}

function resolveAsset(relativePath) {
  const candidates = [
    path.join(__dirname, '..', relativePath),
    path.join(process.resourcesPath, relativePath),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function createWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  const iconPath = resolveAsset(path.join('assets', 'icon.png'));

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    title: 'Titan Protection — Command Centre',
    backgroundColor: '#1b4332',
    show: false,
    autoHideMenuBar: false,
    icon: iconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logMessage('did-fail-load', errorCode, errorDescription, validatedURL);
    dialog.showErrorBox(
      'Titan Protection — connection error',
      `Could not load the Command Centre.\n\n${errorDescription}\n\nCheck your internet connection and try again from the File menu → Reload.`
    );
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const target = new URL(url);
      const base = new URL(APP_URL);
      if (target.origin !== base.origin) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(APP_URL).catch((err) => {
    logMessage('loadURL failed', err?.message || err);
    dialog.showErrorBox(
      'Titan Protection — startup error',
      `Could not open ${APP_URL}.\n\n${err?.message || err}`
    );
  });
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.reload(),
        },
        {
          label: 'Home',
          click: () => mainWindow?.loadURL(APP_URL),
        },
        { type: 'separator' },
        {
          label: 'Open in Browser',
          click: () => shell.openExternal(APP_URL),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Titan Protection Desktop',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Titan Protection Desktop',
              message: 'Titan Protection Command Centre',
              detail: `Version ${app.getVersion()}\nConnects to: ${APP_URL}\n\nUse Master Admin or Supervisor sign-in on the web dashboard.`,
            });
          },
        },
      ],
    },
  ];

  if (!app.isPackaged) {
    template.push({
      label: 'Developer',
      submenu: [{ role: 'toggleDevTools' }],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

process.on('uncaughtException', (err) => {
  logMessage('uncaughtException', err?.stack || err);
});

process.on('unhandledRejection', (err) => {
  logMessage('unhandledRejection', err?.stack || err);
});

if (process.platform === 'win32') {
  app.setAppUserModelId('org.titanprotection.commandcentre');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });

  app.whenReady().then(() => {
    logMessage('app ready', `version=${app.getVersion()}`, `url=${APP_URL}`);
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else mainWindow?.show();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
