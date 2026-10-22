'use strict';
// Мост «игра ↔ Electron». Перед запуском игры подтягивает «облачные» сохранения в localStorage, если там их нет или они старше.
const { contextBridge, ipcRenderer, webFrame } = require('electron');

try {
  const cloud = ipcRenderer.sendSync('og:cloudAll') || {};
  const atOf = s => { try { return JSON.parse(s).at || 0; } catch (e) { return 0; } };
  for (const [k, v] of Object.entries(cloud)) {
    if (k.endsWith('.meta')) continue;
    const metaKey = k + '.meta', meta = cloud[metaKey];
    const localMeta = localStorage.getItem(metaKey);
    if (!localStorage.getItem(k) || (meta && atOf(meta) > atOf(localMeta))) {
      localStorage.setItem(k, v); if (meta) localStorage.setItem(metaKey, meta);
    }
  }
} catch (e) { /* первый запуск или нет места */ }

contextBridge.exposeInMainWorld('OldGoldNative', {
  platform: 'desktop',
  achievement: id => ipcRenderer.send('og:achievement', String(id)),
  cloudPut: (k, d) => ipcRenderer.sendSync('og:cloudPut', String(k), String(d)),
  setZoom: f => { const z = Math.max(0.8, Math.min(1.5, +f || 1)); webFrame.setZoomFactor(z); return z; },   // масштаб интерфейса 80–150%
  fullscreen: () => ipcRenderer.sendSync('og:fullscreen'),                                                // полный экран / окно, вернёт новое состояние
});
