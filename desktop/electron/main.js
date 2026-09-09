const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const path = require('path');

const DEFAULT_APP_URL = 'https://titanprotection.org';
const APP_URL = (process.env.TITAN_APP_URL || DEFAULT_APP_URL).replace(/\/$/, '');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    title: 'Titan Protection — Command Centre',
    backgroundColor: '#f4faf6',
    autoHideMenuBar: false,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(APP_URL);

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

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
