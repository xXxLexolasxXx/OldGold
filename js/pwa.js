'use strict';
// Офлайн-режим: service worker только в браузере по http(s). В Electron/Capacitor игра и так лежит локально.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* без офлайна */ }); });
}
