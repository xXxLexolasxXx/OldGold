'use strict';
// Содержимое панели без браузера (js/winpanel.js, css/winmgr.css):
//  · поход героя включается дальше WP_AWAY клеток и выключается только ближе WP_HOME (на границе не мигает);
//  · нажатая постройка открывает карточку, а не сразу в руку (кроме обучения); «Оборона» — так же;
//  · окна целей, заданий дня и коопа переезжают во вкладку «Задания»; на телефоне на карте только строка-значок;
//  · в походе деревенская панель скрыта, способности по центру, есть кнопка «⌂ Деревня».
// Запуск: node tests/winpanel-test.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

const P = require(path.join(ROOT, 'js/winpanel.js'));
const { wpAwayNext, WP_AWAY, WP_HOME } = P;
check(WP_AWAY > WP_HOME, 'порог похода дальше порога возвращения');
check(wpAwayNext(false, null) === false && wpAwayNext(true, null) === false, 'нет героя или деревни — не поход');
check(wpAwayNext(false, WP_HOME - 1) === false, 'у деревни — не поход');
check(wpAwayNext(false, (WP_AWAY + WP_HOME) / 2) === false, 'между порогами из деревни — ещё не поход');
check(wpAwayNext(false, WP_AWAY + 1) === true, 'далеко — поход');
check(wpAwayNext(true, (WP_AWAY + WP_HOME) / 2) === true, 'между порогами в походе — всё ещё поход (не мигает)');
check(wpAwayNext(true, WP_HOME - 1) === false, 'вернулся к деревне — не поход');

const src = read('js/winpanel.js'), ui = read('js/ui.js'), def = read('js/defenseui.js'), css = read('css/winmgr.css'), html = read('index.html');
check(/wpPick\(type\)/.test(ui) && /wpPick\('fort:' \+ f\)/.test(def), 'постройка и укрепление открывают карточку');
check(/Tut\.on\) \{ setTool/.test(src), 'во время обучения постройка сразу в руке');
check(/\['goal-hud', 'daily-hud', 'cp-vil', 'cp-qs'\]/.test(src), 'цели, задания дня и коопа — во вкладке «Задания»');
check(/#tab-build\.wp-carded > :not\(#wp-card\)\s*\{\s*display:\s*none/.test(css), 'карточка заменяет список');
check(/body\.wp-away:not\(\.mobile\) #panel > :not\(#logo\)/.test(css) && /body\.wp-away #ab-bar\s*\{[^}]*left:\s*50%/.test(css), 'поход: деревня скрыта, способности по центру');
check(/data-wp="peek"/.test(src), 'в походе есть кнопка «⌂ Деревня»');
check(/!loading && !tut && wpAwayNext/.test(src), 'во время обучения поход не включается');
check(html.indexOf('js/winpanel.js') > html.indexOf('js/winmgr.js'), 'winpanel.js после winmgr.js');

if (fails.length) { console.log('ПРОВАЛ:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('winpanel: ok');
