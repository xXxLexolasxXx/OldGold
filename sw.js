'use strict';
// Офлайн-кэш OldGold. Сеть в приоритете (чтобы не залипали старые js после обновления), при обрыве — кэш.
// Предзагрузка: index.html + все его скрипты/стили + шрифты + иконки. Кооп (/coop, /e, ws) и чужие домены не кэшируются.
const CACHE = 'oldgold-v1';
const EXTRA = ['favicon.svg', 'manifest.webmanifest', 'privacy.html', 'fonts/Kurale-Regular.ttf', 'fonts/RuslanDisplay-Regular.ttf',
  'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const html = await (await fetch('index.html', { cache: 'reload' })).text();
    const urls = new Set(['./', 'index.html', ...EXTRA]);
    for (const m of html.matchAll(/(?:src|href)="((?:js|css)\/[^"?#]+)"/g)) urls.add(m[1]);
    // отдельные файлы не должны ломать установку целиком
    await Promise.all([...urls].map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (/\/(e|coop-info|coop)$/.test(u.pathname)) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 6000);
      const res = await fetch(r, { signal: ac.signal }); clearTimeout(t);
      if (res.ok) c.put(r, res.clone()).catch(() => {});
      return res;
    } catch (err) {
      return (await c.match(r, { ignoreSearch: true })) || (r.mode === 'navigate' ? await c.match('index.html') : Response.error());
    }
  })());
});
