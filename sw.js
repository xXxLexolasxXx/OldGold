'use strict';
// Офлайн-кэш OldGold. Сеть в приоритете (чтобы не залипали старые js после обновления), при обрыве — кэш.
// Предзагрузка: index.html + все его скрипты/стили + шрифты + иконки. Кооп (/coop, /e, ws) и чужие домены не кэшируются.
const CACHE = 'oldgold-painted-marsh-01221';
const EXTRA = ['favicon.svg', 'manifest.webmanifest', 'privacy.html', 'fonts/Kurale-Regular.ttf', 'fonts/RuslanDisplay-Regular.ttf',
  ...['newt','snail','moth'].flatMap(kind=>['webp','json'].map(ext=>'assets/approved-marsh/'+kind+'-directions.'+ext)),
  'icons/icon-192.png', 'icons/icon-512.png', 'assets/fantasy/menu-village.png', 'assets/fantasy/frog-village-v2.png',
  'js/fantasy-frog-frequent-frames.bin.gz', 'js/fantasy-frog-rare-frames.bin.gz', 'assets/fantasy/goblin-family-frame-bank.json',
  'assets/fantasy/goblin-family-goblin.png', 'assets/fantasy/goblin-family-goblinB.png', 'assets/fantasy/goblin-family-goblinKing.png',
  'assets/fantasy/school-inn-bank.json', 'assets/fantasy/school-inn-bank.png', 'assets/fantasy/fairy-ring.png', 'assets/fantasy/leshy-stump.png',
  'js/gnomtaurs/camp-atlas.png', 'js/gnomtaurs/spear-atlas.png', 'js/gnomtaurs/archer-atlas.png',
  'assets/fantasy/forest-troll-combat/forest-troll.png', 'assets/fantasy/forest-troll-combat/frames.json',
  'assets/fantasy/magicbeasts/salamander-frames.png',
  'assets/fantasy-birds/gold-goose-runtime-v1.png',
  'assets/fantasy/bog-troll-combat/atlas.png', 'assets/fantasy/bog-troll-combat/frames.json',
  'js/elemental-land-art/land-parts.json', 'js/elemental-land-art/land-parts.png',
  'js/elemental-rock-art/rock-parts.json', 'js/elemental-rock-art/rock-parts.png',
  'assets/fantasy/forest-neutrals-v4/brownie-peek-v1.png',
  'assets/fantasy/golem-first-idle.png', 'assets/fantasy/dwarf-mask-bank-v1.bin.gz', 'js/fantasy-pixel-read-worker.js',
  ...['S','SE','E','NE','N'].map(view=>'assets/fantasy/boar-guard/boar-guard-'+view+'-i0-2x.png'),
  ...['0','1','d'].map(phase=>'assets/fantasy/boar-guard/boar-bed-v7-'+phase+'-transparent-2x.png')];

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
    for (const k of await caches.keys()) if (k.startsWith('oldgold-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (/\/(e|coop-info|coop)$/.test(u.pathname)) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 6000);
    let res;
    try {
      res = await fetch(r, { signal: ac.signal });
    } catch (err) {
      // При недоступной сети ищем тот же ресурс или оболочку игры.
    } finally {
      clearTimeout(t);
    }
    if (res?.ok) c.put(r, res.clone()).catch(() => {});
    if (res && res.status < 500) return res;
    const cached = await c.match(r, { ignoreSearch: true });
    const shell = !cached && r.mode === 'navigate' ? await c.match('index.html') : undefined;
    return cached || shell || res || Response.error();
  })());
});
