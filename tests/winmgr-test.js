'use strict';
// Менеджер окон без браузера (js/winmgr.js, css/winmgr.css, «⋯» в js/heroabil.js):
//  · «Деревня» показывает только открытые игроку вкладки (reveal.js), «Показать всё» — все шесть;
//  · из нескольких окон поверх видно одно — самое новое; окно прав хоста не прячется никогда;
//  · «⋯»: еда и привал — раненому (привал — не при врагах), «Домой» — далеко от базы и не в общей деревне,
//    капкан/колья/фонарь — при врагах или ночью; в спокойной ситуации «⋯» пуст (кнопки нет);
//  · ПК: в колонке одно окно (вкладка или здание);
//  · подключение: скрипт после reveal.js, стили после uilayers.css; кооп-панель над способностями; поля — в «Еде».
// Запуск: node tests/winmgr-test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const W = require(path.join(ROOT, 'js/winmgr.js'));

// ---- вкладки «Деревни»
check(eq(W.wmVillageTabs({ rvOn: false, all: false, open: new Set() }), ['store', 'overview', 'log', 'trade', 'prio', 'council']), 'вне игры (без reveal) — все шесть вкладок');
check(eq(W.wmVillageTabs({ rvOn: true, all: false, open: new Set() }), []), 'новичок: ничего не открыто — «Деревни» нет');
check(eq(W.wmVillageTabs({ rvOn: true, all: false, open: new Set(['trade', 'store']) }), ['store', 'trade']), 'открытые вкладки — в порядке «Деревни»');
check(eq(W.wmVillageTabs({ rvOn: true, all: true, open: new Set() }).length, 6), '«Показать всё» — все шесть');

// ---- стопка окон
check(eq(W.wmStackHide([]), []) && eq(W.wmStackHide([{ id: 'a', seq: 1 }]), []), 'одно окно — ничего не прячем');
check(eq(W.wmStackHide([{ id: 'a', seq: 1 }, { id: 'b', seq: 3 }, { id: 'c', seq: 2 }]), ['a', 'c']), 'видно только самое новое окно');
check(eq(W.wmStackHide([{ id: 'adm', seq: 1, pinned: true }, { id: 'b', seq: 2 }]), []), 'окно прав хоста не прячется под новым');
check(eq(W.wmStackHide([{ id: 'adm', seq: 5, pinned: true }, { id: 'b', seq: 2 }]), ['b']), 'открыли права поверх — прежнее окно ждёт');

// ---- «⋯» (abMoreList из heroabil.js, без остального файла)
{
  const src = read('js/heroabil.js');
  const a = src.indexOf('const AB_MORE = ['), b = src.indexOf('if (typeof ABIL_ICON', a);
  check(a > 0 && b > a, 'heroabil.js: нет AB_MORE / abMoreList');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src.slice(a, b) + '\nthis.abMoreList = abMoreList;', ctx);
  const L = c => ctx.abMoreList(Object.assign({ eat: false, hurt: false, foes: false, night: false, far: false, mir: false }, c));
  check(eq(L({}), []), 'спокойно, здоров, у базы — «⋯» пуст');
  check(eq(L({ hurt: true, eat: true }), ['u_eat', 'u_camp']), 'ранен и есть еда — еда и привал');
  check(eq(L({ hurt: true, eat: false }), ['u_camp']), 'ранен без еды — только привал');
  check(!L({ hurt: true, eat: true, foes: true }).includes('u_camp'), 'при врагах привала нет');
  check(eq(L({ foes: true }), ['cf_trap', 'cf_stakes', 'cf_lamp']), 'враги рядом — капкан, колья, фонарь');
  check(eq(L({ night: true }), ['cf_trap', 'cf_stakes', 'cf_lamp']), 'ночью — капкан, колья, фонарь');
  check(eq(L({ far: true }), ['u_home']), 'далеко от базы — «Домой»');
  check(eq(L({ far: true, mir: true }), []), 'в общей деревне «Домой» нет');
  check(/data-abu="\$\{atk\.k\}"/.test(src) && /data-abmore/.test(src), 'на панели: «Атака» и кнопка «⋯»');
}

// ---- подключение и стили
{
  const html = read('index.html');
  const iR = html.indexOf('js/reveal.js'), iW = html.indexOf('js/winmgr.js'), iM = html.indexOf('js/main.js');
  check(iW > iR && iW > iM, 'winmgr.js подключён после main.js и reveal.js');
  check(html.indexOf('css/winmgr.css') > html.indexOf('css/uilayers.css'), 'winmgr.css после uilayers.css');
  const css = read('css/winmgr.css');
  check(/\.wm-wait\s*\{[^}]*visibility:\s*hidden/.test(css), 'ждущее окно скрыто');
  check(/body\.ui-ab #coop-hud\s*\{[^}]*--ui-ab-top/.test(css), 'панель коопа — над панелью способностей');
  check(/#tool-wheat, #tool-hops\s*\{\s*display:\s*none/.test(css), 'поля убраны из верхнего ряда');
  check(/body\.wm-pc-tab:not\(\.mobile\) :is\(#info-wrap, #split\)\s*\{\s*display:\s*none/.test(css) && /body\.wm-pc-info:not\(\.mobile\) :is\(#tab-area, #split\)\s*\{\s*display:\s*none/.test(css), 'ПК: в колонке одно окно — либо вкладка, либо здание');
  const ui = read('js/ui.js');
  check(/FIELD_TOOLS/.test(ui) && /BUILD_CATS\[UI\.cat\] === 'Еда'/.test(ui), 'поля пшеницы и хмеля — в разделе «Еда»');
  check(/backButton[^\n]*wmBack/.test(read('js/native.js')), '«Назад» на Android закрывает верхнее окно');
  check(/\[data-wm="admin"\]/.test(read('js/menugroups.js')), 'пункт «Права игроков» — на виду в меню');
}

// ---- оповещения не копятся: плашки уходят сами и по ✕, на телефоне одна плашка и один тост, тост не дольше 10 с
{
  const pins = read('js/pins.js'), nq = read('js/notify.js'), ui = read('js/ui.js');
  check(/PIN_MAX = \(\) => \(document\.body\.classList\.contains\('mobile'\) \? 1 : 3\)/.test(pins), 'телефон: одна закреплённая плашка');
  check(/PIN_SHOW_MS = 20000/.test(pins) && /data-pinx/.test(pins) && /pinSnooze\(p\.id\)/.test(pins), 'плашка уходит сама через 20 с и по ✕');
  check(/contains\('mobile'\) \? 1 : 2/.test(nq), 'телефон: один тост за раз');
  check(/Math\.min\(mob \? 10000 : 9000/.test(ui), 'тост не висит дольше 10 с');
}

if (fails.length) { console.log('ПРОВАЛ:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('winmgr: ok');
