'use strict';
// Мост к оболочке приложения. В браузере ничего не делает.
//  • Electron/Steam: window.OldGoldNative (desktop/preload.js) — ачивки в Steamworks, сохранения дублируются в «облачную» папку.
//  • Capacitor (iOS/Android): window.Capacitor — полноэкранный режим без строки состояния.
(function () {
  const N = window.OldGoldNative, C = window.Capacitor;
  if (C && C.isNativePlatform && C.isNativePlatform()) {
    document.documentElement.classList.add('native-app', 'native-' + C.getPlatform());
    try { C.Plugins.StatusBar.hide(); } catch (e) { /* плагин не подключён */ }
    try { C.Plugins.App.addListener('backButton', () => { /* назад не закрывает игру: закрывает верхнее окно или шторку (js/winmgr.js) */ if (typeof window.wmBack === 'function') window.wmBack(); }); } catch (e) { /* без App */ }
  }
  if (!N) return;
  document.documentElement.classList.add('native-app');
  if (typeof saveGame === 'function') {
    const orig = saveGame;
    saveGame = function (slot) {
      const r = orig.apply(this, arguments);
      try {
        const k = SAVE_KEY + (slot || 'manual'), d = localStorage.getItem(k), m = localStorage.getItem(k + '.meta');
        if (d) { N.cloudPut(k, d); if (m) N.cloudPut(k + '.meta', m); }
      } catch (e) { /* облако недоступно */ }
      return r;
    };
  }
})();
