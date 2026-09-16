const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('titanDesktop', {
  platform: process.platform,
  version: '1.0.2',
});
