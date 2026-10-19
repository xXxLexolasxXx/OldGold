'use strict';
// Electron-обёртка OldGold: окно с локальной игрой (www/), полный экран по F11, мост к Steam-заглушкам.
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const { createSteam } = require('./steam');

if (!app.requestSingleInstanceLock()) app.quit();
Menu.setApplicationMenu(null);

let steam;
function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 500, backgroundColor: '#1a130d', title: 'OldGold', show: false,
    icon: path.join(__dirname, '..', 'icons', 'icon-512.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false, nodeIntegration: false, spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'www', 'index.html'));
  // внешние ссылки — в системный браузер, внутри окна только игра
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    if (i.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (i.key === 'F12' && !app.isPackaged) win.webContents.toggleDevTools();
  });
  if (process.env.OG_SMOKE) {   // npm run smoke: игра загрузилась без ошибок?
    const errs = [];
    win.webContents.on('console-message', (e, level, msg) => { if (level >= 3) errs.push(msg); });
    win.webContents.once('did-finish-load', () => setTimeout(async () => {
      const r = await win.webContents.executeJavaScript("({ game: typeof Game, canvas: !!document.querySelector('canvas'), native: !!window.OldGoldNative, ver: typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : null })");
      console.log('SMOKE', JSON.stringify(r), 'errors:', errs.length, errs.slice(0, 3).join(' | '));
      app.exit(errs.length || r.game === 'undefined' ? 1 : 0);
    }, 4000));
  }
  return win;
}

app.whenReady().then(() => {
  steam = createSteam(app.getPath('userData'));
  ipcMain.on('og:cloudAll', e => { e.returnValue = steam.cloudAll(); });
  ipcMain.on('og:cloudPut', (e, k, d) => { e.returnValue = steam.cloudPut(k, d); });
  ipcMain.on('og:achievement', (e, id) => { steam.achievement(id); });
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
