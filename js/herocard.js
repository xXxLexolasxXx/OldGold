'use strict';
// Карточка героя, версия 2: компактная шапка (портрет, полоски здоровья/маны/опыта), две вкладки —
// «Скиллы» (пиксельные значки 16×16: горячая клавиша, мана, перезарядка, уровень открытия, подсказка по наведению/тапу)
// и «Герой» (характеристики, команда, снаряжение, рюкзак). С 0.10.66 в «Скиллах» — только способности класса (до пяти) — и взмахи оружия вместо красного флажка.
// Подключается после heromana.js. В общей деревне (Coop) работает прежняя карточка.

// ---------- Значки умений 16×16 (контур и поля добавляет abilIcon16) ----------
const HC_ICON = {
  dash: ['Y:#f6d458 w:#fff6c0', 'YY..YY......', 'YYY.YYY.....', '.YYY.YYY....', '..YYY.YYY...', '...YYY.YYY..', '....YYY.YYY.', '....YYY.YYY.', '...YYY.YYY..', '..YYY.YYY...', '.YYY.YYY....', 'YYY.YYY.....', 'YY..YY......'],
  cry: ['O:#ff9a30 Y:#ffe070 b:#8a5a30 w:#fff6d0', '........O...', '.......OO.O.', '..bbbOOOO...', '.bbwbOOOOOO.', '.bbbbOOOOOO.', '..bbbOOOO...', '.......OO.O.', '........O...', '..b.........', '..bb........', '............'],
  tp: ['B:#5a8ae0 L:#9ec8ff W:#e8f0ff', '....LLLL....', '..LLBBBBLL..', '.LBB....BBL.', '.LB..WW..BL.', 'LB..WLLW..BL', 'LB..WLLW..BL', '.LB..WW..BL.', '.LBB....BBL.', '..LLBBBBLL..', '....LLLL....', '............'],
  heal: ['G:#5ab04a w:#f0fff0', '....GGGG....', '....GwwG....', '....GwwG....', '.GGGGwwGGGG.', '.GwwwwwwwwG.', '.GwwwwwwwwG.', '.GGGGwwGGGG.', '....GwwG....', '....GwwG....', '....GGGG....', '............'],
  fire: ['F:#c8302a O:#ff8a30 Y:#ffe070', '......F.....', '.....FF.....', '....FFF.F...', '....FOFFF...', '...FFOOFF...', '..FFOOYOFF..', '..FOOYYOOF..', '..FOYYYYOF..', '..FOYYYYOF..', '...FOYYOF...', '....FFFF....', '............'],
  ward: ['C:#9ec8ff W:#e8f0ff B:#4a6ac0', '....CCCC....', '..CCBBBBCC..', '.CB..WW..BC.', '.CB.WWWW.BC.', 'CB.WWBBWW.BC', 'CB.WWBBWW.BC', '.CB.WWWW.BC.', '.CB..WW..BC.', '..CCBBBBCC..', '....CCCC....', '............'],
  strike: ['S:#c8ccd0 W:#fff6f0 g:#c89226 b:#6a4a28', '..........SS', '.........SWS', '........SWS.', '.......SWS..', '......SWS...', '.....SWS....', '..g.SWS.....', '..ggWS......', '...gg.......', '..bg.g......', '.bb.........'],
};
const HC_ICON_URL = {};
function abilIcon16(k) {
  if (HC_ICON_URL[k]) return HC_ICON_URL[k];
  const g = HC_ICON[k] || (typeof ABIL_ICON !== 'undefined' && ABIL_ICON[k]);
  if (!g || typeof document === 'undefined' || !document.createElement) return '';
  const pal = {};
  for (const p of g[0].split(' ')) { const [ch, col] = p.split(':'); pal[ch] = col; }
  const cv = mkCanvas(16, 16), c = cv.getContext('2d');
  const at = (x, y) => (y >= 0 && y < 12 && x >= 0 && x < 12 && (g[1 + y] || '')[x] && g[1 + y][x] !== '.') ? g[1 + y][x] : '';
  c.fillStyle = '#1a1008';
  for (let y = -1; y <= 12; y++) for (let x = -1; x <= 12; x++) if (!at(x, y) && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) c.fillRect(x + 2, y + 2, 1, 1);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const ch = at(x, y); if (ch) { c.fillStyle = pal[ch] || '#fff'; c.fillRect(x + 2, y + 2, 1, 1); } }
  return (HC_ICON_URL[k] = cv.toDataURL());
}

// ---------- Список умений героя ----------
let heroCardTab = 'skills', heroCardSel = null;

function heroSkills() {
  const h = Game.hero, H = h.hero, now = Game.time, L = [];
  // только способности класса (до пяти, 0.10.66); атака, еда, привал и «домой» — на панели быстрых способностей (heroabil.js)
  const as = typeof heroAbils === 'function' ? heroAbils(H) : null;
  const rk = typeof abResKind === 'function' ? abResKind(H) : null;
  if (as) as.forEach((a, i) => L.push({
    k: a.k, run: 'ab' + i, name: a.name, key: a.passive ? '' : ABIL_KEYN[i], lvl: a.lvl || 1, cd: a.passive ? 0 : a.cd, passive: !!a.passive,
    cost: a.cost || 0, res: rk, left: Math.max(0, ((H.abCd || {})[a.k] || 0) - now), on: ((H.abT || {})[a.k] || 0) > now, desc: a.desc,
  }));
  return L;
}
const hcResName = s => (s.res && typeof ABIL_RES !== 'undefined' ? ABIL_RES[s.res].name.toLowerCase() : 'мана');
const hcLack = (s, H) => s.cost > 0 && typeof abResGet === 'function' && abResGet(H) < s.cost;

function hcTile(s, H) {
  const lock = (H.level || 1) < s.lvl, lack = !lock && hcLack(s, H);
  const cl = ['hs']; if (lock) cl.push('lock'); else if (s.left > 0) cl.push('cd'); else if (lack) cl.push('lack'); if (s.on) cl.push('on'); if (s.passive) cl.push('pas'); if (heroCardSel === s.k) cl.push('sel');
  const pct = s.cd ? Math.min(100, Math.round(100 * s.left / s.cd)) : 0;
  const rc = s.res && typeof ABIL_RES !== 'undefined' ? ABIL_RES[s.res].col : '#8ab8ff';
  return `<button class="${cl.join(' ')}" data-sk="${s.k}" aria-label="${s.name}"><img src="${abilIcon16(s.k)}" alt="">`
    + (s.key ? `<i class="hs-key">${s.key}</i>` : '') + (s.cost ? `<b class="hs-mp" style="color:${rc}">${s.cost}</b>` : '') + (s.passive && !lock ? '<b class="hs-mp hs-pas">∞</b>' : '')
    + (lock ? `<em class="hs-lock">ур.${s.lvl}</em>` : s.left > 0 ? `<span class="hs-cd" style="height:${pct}%"></span><em>${Math.ceil(s.left)}</em>` : '')
    + '</button>';
}

function hcDetail(list, H, touch) {
  const s = list.find(x => x.k === heroCardSel);
  if (!s) return `<div class="hs-det muted">${!list.length ? 'Способностей пока нет: герой выучится им в гильдии — у каждого класса свои.' : touch ? 'Нажмите на значок — подсказка. Применять удобнее с панели в углу экрана.' : 'Наведите на значок — подсказка, клик — применить (или клавиши 1–5)'}</div>`;
  const lock = (H.level || 1) < s.lvl;
  const meta = s.passive ? ['пассивно, действует всегда', s.lvl > 1 ? `с ${s.lvl} уровня` : ''].filter(Boolean).join(' · ')
    : [s.cost ? `${hcResName(s)} ${s.cost}` : '', s.cd ? `перезарядка ${s.cd} с` : '', s.lvl > 1 ? `с ${s.lvl} уровня` : '', s.key ? `клавиша ${s.key}` : ''].filter(Boolean).join(' · ');
  const state = lock ? `откроется на ${s.lvl} уровне` : s.passive ? '' : s.left > 0 ? `готово через ${Math.ceil(s.left)} с` : s.on ? 'действует' : hcLack(s, H) ? `не хватает: ${hcResName(s)}` : '';
  return `<div class="hs-det"><div><b>${s.name}</b>${state ? ` <span class="hs-st">${state}</span>` : ''}</div><div>${s.desc}</div><div class="muted">${meta}</div>`
    + (touch && !lock && !s.passive && s.left <= 0 ? `<button class="hs-cast" data-run="${s.run}">Применить</button>` : '') + '</div>';
}

function hcSkillsHTML(touch) {
  const H = Game.hero.hero, list = heroSkills();
  return `<div class="hs-grid">${list.map(s => hcTile(s, H)).join('')}</div>${hcDetail(list, H, touch)}`;
}

function hcHeroHTML() {
  const h = Game.hero, H = h.hero, s = heroStats(H);
  const bar = (n, c) => `<span class="hp-bar"><i style="width:${Math.min(100, n * 2.2)}%;background:${c}"></i></span>`;
  const mate = Game.units.find(u => u.teamOf === h.id);
  const lifeOn = typeof hlOn === 'function' && hlOn();
  let x = `<div class="hp-stats">
    <div>Сила ${bar(s.str, '#d0603a')}<b>${s.str}</b></div><div>Ловкость ${bar(s.agi, '#6ac04a')}<b>${s.agi}</b></div>
    <div>Смекалка ${bar(s.int, '#5a8ae0')}<b>${s.int}</b></div><div>Стойкость ${bar(s.end, '#d0a83a')}<b>${s.end}</b></div></div>
    <div class="irow small">Скорость <b>×${teamSpeedMul(h).toFixed(2)}</b> · работа <b>×${teamWorkMul(h).toFixed(2)}</b></div>
    <div class="irow small">Команда: ${mate ? `<b>${UNIT_TYPES[mate.type].name}</b> <button data-hero="leave" class="hp-sm">Отпустить</button>` : '<span class="muted">пусто — клик по гному</span>'}</div>`;
  if (lifeOn) {
    const eq = (slot, label, un) => H.equip[slot] ? `${label}: <b>${hlName(H.equip[slot])}</b> <button data-hero="${un}" class="hp-sm">снять</button>` : '';
    const eqs = [eq('weapon', 'Оружие', 'unw'), eq('armor', 'Доспех', 'una'), eq('off', 'Левая рука', 'uno')].filter(Boolean);
    x += `<div class="irow small">${eqs.length ? eqs.join(' · ') : '<span class="muted">Без оружия и доспеха</span>'}</div>`;
    if (typeof durHeroHTML === 'function') x += durHeroHTML(H);
    let inv = '<div class="hl-inv">';
    for (let i = 0; i < HL_INV; i++) {
      const it = H.inv[i];
      inv += it ? `<button class="hl-slot" data-hero="use${i}" title="${hlName(it.k)}${HL_GEAR[it.k] ? ' — надеть (шанс удачи 30%)' : HL_FOOD[it.k] ? ' — съесть' : ''}. Правый клик — выбросить"><img src="${iconURL('good', it.k, 2)}" alt="">${it.n > 1 ? `<i>${it.n}</i>` : ''}</button>` : '<span class="hl-slot empty"></span>';
    }
    x += `<div class="irow small muted">Рюкзак (${H.inv.filter(Boolean).length}/${HL_INV})</div>${inv}</div>`;
  }
  if (typeof heroGuildBlock === 'function') {
    const sq = Game.units.filter(u => { const R = typeof recOf === 'function' && recOf(u); return R && !u.dead && !(R.train > 0); });
    if (sq.length) x += `<div class="irow small">Отряд: <b>${sq.length}</b> <button class="hp-sm" data-hero="g_follow">За мной</button><button class="hp-sm" data-hero="g_guard">По гильдиям</button></div>`;
    else if (!(H.clsKey && GCLS[H.clsKey])) x += '<div class="irow small muted">Класса нет — обучитесь в гильдии</div>';
  }
  if (typeof neuPanelRow === 'function') x += neuPanelRow();
  return x;
}

function hcHeader(H, h, mobile) {
  const lifeOn = typeof hlOn === 'function' && hlOn() && H.maxhp;
  const hp = lifeOn ? Math.max(0, Math.round(H.hp)) : 0;
  const hpc = lifeOn ? (hp / H.maxhp > 0.5 ? '#5ac04a' : hp / H.maxhp > 0.25 ? '#e0b030' : '#e04a3a') : '';
  // полоска ресурса класса: мана, ярость, энергия или вера
  const rk = typeof abResKind === 'function' ? abResKind(H) : null, mm = rk ? abResMax(H) : 0, rv = rk ? Math.round(abResGet(H)) : 0, RS = rk ? ABIL_RES[rk] : null;
  const score = heroTownScore(), lo = H.level > 1 ? heroNeedFor(H.level - 1) : 0, hi = heroNeedFor(H.level);
  const xp = H.level >= HERO_LVL_MAX ? 100 : Math.max(0, Math.min(100, ((score - lo) / (hi - lo)) * 100));
  const bars = (lifeOn ? `<div class="hc-bar" title="Здоровье ${hp}/${H.maxhp}"><i style="width:${Math.round(100 * hp / H.maxhp)}%;background:${hpc}"></i><span>${hp}/${H.maxhp}</span></div>` : '')
    + (mm ? `<div class="hc-bar mp" title="${RS.name} ${rv}/${mm}"><i style="width:${Math.round(100 * rv / mm)}%;background:${RS.col}"></i><span>${RS.name.toLowerCase()} ${rv}/${mm}</span></div>` : '')
    + `<div class="hc-bar xp" title="${H.level >= HERO_LVL_MAX ? 'Высший, 15-й уровень' : `Опыт растёт вместе с городом и боями: ${Math.floor(score)} из ${Math.ceil(hi)}`}"><i style="width:${xp}%"></i></div>`;
  return `<div class="hc-head"><img src="${portraitURL('hero', h.look)}" alt=""><div class="hc-id"><b>${H.name}</b><small>${H.clsKey && GCLS[H.clsKey] ? GCLS[H.clsKey].name : H.cls || 'Гном-универсал'} · ур. ${H.level}</small></div>`
    + `<div class="hc-btns"><button class="hc-c" data-hero="center" title="Камера к герою">◎</button>${mobile ? `<button class="hc-t" title="${heroCardOpen ? 'Свернуть' : 'Подробнее'}">${heroCardOpen ? '▴' : '▾'}</button><button class="hc-m" title="Спрятать в иконку">–</button>` : ''}<button class="hc-x" title="Снять выбор (Esc)">×</button></div></div><div class="hc-bars">${bars}</div>`;
}

let hcStyled = false;
{
  const _prev = heroCardUpdate;
  heroCardUpdate = function () {
    if (typeof Coop !== 'undefined' && Coop.on) return _prev();
    let card = document.getElementById('hero-card');
    if (!card) {
      card = document.createElement('div'); card.id = 'hero-card';
      document.getElementById('view').appendChild(card);
    }
    if (!card.dataset.v2) {
      card.dataset.v2 = '1';
      const touch = () => Mobile.on || (window.matchMedia && matchMedia('(hover: none)').matches);
      const cast = run => { heroAbility(run); updateUI(true); };
      card.addEventListener('click', e => {
        if (e.target.closest('.hc-x')) { Game.selUnit = null; updateUI(true); return; }
        if (e.target.closest('.hc-t')) { heroCardOpen = !heroCardOpen; heroCardUpdate(); return; }
        if (e.target.closest('.hc-m')) { heroCardMini = true; heroCardUpdate(); return; }
        const tb = e.target.closest('[data-tab]');
        if (tb) { heroCardTab = tb.dataset.tab; heroCardUpdate(); return; }
        const cb = e.target.closest('.hs-cast');
        if (cb) { cast(cb.dataset.run); return; }
        const sk = e.target.closest('.hs');
        if (sk) {
          const s = Game.hero && heroSkills().find(x => x.k === sk.dataset.sk);
          if (!s) return;
          if (touch() && heroCardSel !== s.k) { heroCardSel = s.k; heroCardUpdate(); return; }
          heroCardSel = s.k;
          if (s.passive) { heroCardUpdate(); return; }
          if ((Game.hero.hero.level || 1) < s.lvl) { toast(`${s.name} — с ${s.lvl} уровня героя`); heroCardUpdate(); return; }
          if (s.left > 0) { heroCardUpdate(); return; }
          cast(s.run); return;
        }
        const el = e.target.closest('[data-hero]');
        if (!el || !Game.hero) return;
        if (el.dataset.hero === 'leave') { for (const m of Game.units.filter(u => u.teamOf === Game.hero.id)) leaveTeam(m); updateUI(true); }
        else if (el.dataset.hero === 'center') centerOn(Game.hero.x * TILE, Game.hero.y * TILE);
        else heroAbility(el.dataset.hero);
      });
      card.addEventListener('mouseover', e => {
        if (Mobile.on) return;
        const sk = e.target.closest && e.target.closest('.hs');
        if (sk && heroCardSel !== sk.dataset.sk) { heroCardSel = sk.dataset.sk; heroCardUpdate(); }
      });
    }
    if (!hcStyled) {
      hcStyled = true;
      const st = document.createElement('style');
      st.textContent = `#hero-card{position:absolute;top:58px;right:10px;width:244px;z-index:6;padding:6px 8px 8px;font-size:12px;display:none;box-sizing:border-box}
      #hero-card .hc-head{display:flex;align-items:center;gap:6px}
      #hero-card .hc-head>img{width:34px;height:34px;image-rendering:pixelated;border-radius:4px;flex:none;border:1px solid #5a4620}
      #hero-card .hc-id{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.2}
      #hero-card .hc-id b{font-size:14px;color:#f0d27a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#hero-card .hc-id small{opacity:.8;font-size:11px}
      #hero-card .hc-btns{display:flex;gap:2px;flex:none}
      #hero-card .hc-btns button{padding:0 6px;font-size:13px;line-height:20px;min-height:22px}
      #hero-card .hc-bars{display:flex;flex-direction:column;gap:3px;margin:5px 0 4px}
      #hero-card .hc-bar{position:relative;height:9px;background:#15100a;border:1px solid #0a0705;border-radius:3px;overflow:hidden}
      #hero-card .hc-bar i{display:block;height:100%}#hero-card .hc-bar.mp i{background:linear-gradient(#6aa6ff,#3a68c8)}
      #hero-card .hc-bar span{position:absolute;inset:0;text-align:center;font-size:8px;line-height:9px;color:#fff;text-shadow:0 1px 0 #000}
      #hero-card .hc-bar.xp{height:4px}#hero-card .hc-bar.xp i{background:#f6d458}
      #hero-card .hc-tabs{display:flex;gap:3px;margin:2px 0 5px}
      #hero-card .hc-tabs button{flex:1;padding:2px 4px;font-size:12px;min-height:24px;background:#2a2014;color:#c8b890;border:1px solid #5a4620;border-radius:4px;cursor:pointer}
      #hero-card .hc-tabs button.on{background:#5a4418;color:#ffe9a8;border-color:#d8b04a}
      #hero-card .hs-grid{display:flex;flex-wrap:wrap;gap:4px}
      #hero-card .hs{position:relative;width:42px;height:42px;padding:0;background:linear-gradient(#3a2c14,#241a0e);border:1px solid #8a6a28;border-radius:5px;cursor:pointer;overflow:hidden;flex:none}
      #hero-card .hs img{width:32px;height:32px;image-rendering:pixelated;display:block;margin:4px auto 0}
      #hero-card .hs.sel{border-color:#f6d458;box-shadow:0 0 0 1px #f6d458}
      #hero-card .hs.on{border-color:#7fe0ff;box-shadow:0 0 6px rgba(127,224,255,.7)}
      #hero-card .hs.lock img,#hero-card .hs.lack img{filter:grayscale(1) brightness(.6)}#hero-card .hs.cd img{filter:brightness(.55)}
      #hero-card .hs.lack{border-color:#4a68a8}
      #hero-card .hs.pas{border-style:dashed;border-color:#b8a060}#hero-card .hs .hs-pas{color:#f0d880;font-size:11px}
      #hero-card .hs i,#hero-card .hs b,#hero-card .hs em{position:absolute;font-style:normal;font-size:9px;line-height:10px;text-shadow:0 1px 0 #000;pointer-events:none}
      #hero-card .hs .hs-key{left:2px;top:1px;color:#ffe9a8;font-weight:bold}#hero-card .hs .hs-mp{right:2px;bottom:1px;color:#8ab8ff}
      #hero-card .hs em{inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;color:#fff}
      #hero-card .hs em.hs-lock{align-items:flex-end;font-size:9px;color:#d8c8a0;background:rgba(0,0,0,.45)}
      #hero-card .hs .hs-cd{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.62);pointer-events:none}
      #hero-card .hs-det{margin-top:6px;padding:4px 6px;min-height:46px;background:rgba(0,0,0,.28);border:1px solid #4a3a1c;border-radius:4px;font-size:11px;line-height:1.35}
      #hero-card .hs-det b{color:#f6e8c0;font-size:12px}#hero-card .hs-st{color:#9ec8ff;font-size:10px}#hero-card .hs-det.muted{display:flex;align-items:center}
      #hero-card .hs-cast{display:block;width:100%;margin-top:4px;padding:3px;font-size:12px;min-height:28px}
      #hero-card .hc-body .irow{margin:3px 0}#hero-card .hp-stats{margin-bottom:4px;font-size:11px}
      #hero-card .hc-body .hl-inv{grid-template-columns:repeat(5,1fr);margin:2px 0 4px}
      #hero-card .hc-body .hl-slot{height:30px}#hero-card .hc-body .hl-slot img{width:22px;height:22px}
      body.mobile #hero-card{top:auto;bottom:calc(116px + env(safe-area-inset-bottom));right:auto;left:6px;width:min(300px,calc(100vw - 12px));max-height:min(46vh,calc(100dvh - 200px));overflow-y:auto;font-size:11px;animation:hc-up .22s ease-out}
      @keyframes hc-up{from{opacity:0;transform:translateY(24px) scale(.94)}to{opacity:1;transform:none}}
      body.mobile #hero-card .hs{width:40px;height:40px}body.mobile #hero-card .hs img{width:30px;height:30px;margin-top:3px}
      body.mobile #hero-card .hc-head>img{width:30px;height:30px}
      body.mobile.sheet-tab #hero-card,body.mobile.sheet-info #hero-card{display:none!important}`;
      document.head.appendChild(st);
    }
    const on = !!(Game.hero && Game.selUnit && Game.selUnit === Game.hero);
    if (on && !heroCardWasOn) { heroCardMini = true; heroCardOpen = false; heroCardSel = null; }
    heroCardWasOn = on;
    if (!on || (Mobile.on && heroCardMini)) { card.style.display = 'none'; delete card.dataset.h; return; }
    const h = Game.hero, H = h.hero, touch = Mobile.on || (window.matchMedia && matchMedia('(hover: none)').matches);
    const full = !Mobile.on || heroCardOpen;
    const tabs = full ? `<div class="hc-tabs"><button data-tab="skills" class="${heroCardTab === 'skills' ? 'on' : ''}">Скиллы</button><button data-tab="hero" class="${heroCardTab === 'hero' ? 'on' : ''}">Герой</button>${typeof oathTabHTML === 'function' ? `<button data-tab="oath" class="${heroCardTab === 'oath' ? 'on' : ''}">Клятва</button>` : ''}</div>` : '';
    const body = !full || heroCardTab === 'skills' ? hcSkillsHTML(touch) : heroCardTab === 'oath' && typeof oathTabHTML === 'function' ? `<div class="hc-body">${oathTabHTML(H)}</div>` : `<div class="hc-body">${hcHeroHTML()}</div>`;
    const html = hcHeader(H, h, Mobile.on) + tabs + body;
    if (card.dataset.h !== html) {
      const sc = card.scrollTop;
      card.dataset.h = html; card.innerHTML = html; card.scrollTop = sc;
    }
    card.style.display = 'block';
  };
}

// ---------- Взмахи оружия (вместо красного флажка): у каждого класса свой след ----------
// палитры: [ядро, середина, край]
const SWING = {
  warrior:   { kind: 'slash', R: 21, arc: 2.5, w: 6, dur: 0.34, col: ['#ffffff', '#cfeaff', '#7aa8d8'] },
  barbarian: { kind: 'slash', R: 23, arc: 3.1, w: 9, dur: 0.42, col: ['#fff2c0', '#ffa040', '#c8401a'] },
  rogue:     { kind: 'cross', R: 15, arc: 1.7, w: 4, dur: 0.26, col: ['#ffffff', '#d8e0e8', '#8a94a8'] },
  monk:      { kind: 'fist',  R: 16, dur: 0.3, col: ['#ffffff', '#ffd8b0', '#e49860'] },
  priest:    { kind: 'slash', R: 20, arc: 2.2, w: 6, dur: 0.38, col: ['#ffffff', '#ffe890', '#e0a830'], sparks: true },
  paladin:   { kind: 'slash', R: 22, arc: 2.6, w: 7, dur: 0.38, col: ['#ffffff', '#fff0a0', '#f0b040'], sparks: true },
  bard:      { kind: 'cross', R: 16, arc: 1.8, w: 4, dur: 0.28, col: ['#ffffff', '#ffd0ec', '#c060a0'] },
  mage:      { kind: 'bolt',  dur: 0.5, col: ['#ffffff', '#d8b8ff', '#8a50e8'] },
  druid:     { kind: 'bolt',  dur: 0.5, col: ['#f4ffd0', '#8ae060', '#3a8a30'], leaf: true },
  archer:    { kind: 'arrow', dur: 0.42, col: ['#ffffff', '#ffeea0', '#c8a040'] },
};
const SWING_DEF = SWING.warrior;
const heroSwings = [];

function hcDot(c, x, y, s, col, a) { c.globalAlpha = Math.max(0, Math.min(1, a)); c.fillStyle = col; c.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); }

function hcFace(u) {
  const v = u.vdir;
  if (v === 'N') return { dx: 0, dy: -1, a: -Math.PI / 2 };
  if (v === 'S') return { dx: 0, dy: 1, a: Math.PI / 2 };
  const f = u.face === -1 ? -1 : 1;
  return { dx: f, dy: 0, a: f === 1 ? 0 : Math.PI };
}

function hcDrawSwing(c, s, now) {
  const P = s.def, p = (now - s.t0) / P.dur;
  if (p < 0 || p >= 1) return p >= 1 ? false : true;
  const fa = s.fa, cx = s.x + fa.dx * 3, cy = s.y - 14;
  const fade = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
  const [c0, c1, c2] = P.col;
  if (P.kind === 'slash' || P.kind === 'cross') {
    const legs = P.kind === 'cross' ? [{ dir: 1, off: 0, d: 0 }, { dir: -1, off: 0.5, d: 0.28 }] : [{ dir: s.n % 2 ? -1 : 1, off: 0, d: 0 }];
    for (const lg of legs) {
      const q = (p - lg.d) / (1 - lg.d);
      if (q < 0 || q >= 1) continue;
      const e = 1 - Math.pow(1 - Math.min(1, q * 1.7), 2.2);
      const start = fa.a - lg.dir * P.arc / 2 + lg.off * lg.dir * 0.35, head = start + lg.dir * P.arc * e;
      const N = 16, step = P.arc / 22;
      for (let i = 0; i < N; i++) {
        const ang = head - lg.dir * i * step;
        if ((ang - start) * lg.dir < 0) break;
        const k = 1 - i / N, al = k * fade;
        const thick = Math.max(2, Math.round(P.w * k));
        for (let r = 0; r < thick; r += 2) {
          const rr = P.R - r + (thick >> 1);
          hcDot(c, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.85, 2, r === 0 ? (i < 3 ? c0 : c1) : r < thick - 2 ? c1 : c2, al * (r === 0 ? 1 : 0.8));
        }
      }
      const hx = cx + Math.cos(head) * P.R, hy = cy + Math.sin(head) * P.R * 0.85;
      hcDot(c, hx, hy, 3, c0, fade);
      if (P.sparks && q > 0.3) for (let j = 0; j < 4; j++) {
        const t = (q * 3 + j * 0.25) % 1, an = head - lg.dir * (0.2 + j * 0.45);
        hcDot(c, cx + Math.cos(an) * (P.R + 4 + t * 8), cy + Math.sin(an) * (P.R + 4 + t * 8) * 0.85, 2, j % 2 ? c0 : c1, (1 - t) * fade);
      }
    }
  } else if (P.kind === 'fist') {
    const px = cx + fa.dx * P.R, py = cy + fa.dy * P.R, e = Math.min(1, p * 2.2);
    for (let r = 0; r < 8; r++) {
      const an = r * Math.PI / 4 + (s.n % 2) * 0.4;
      for (let d = 3; d < 5 + 11 * e; d += 3) hcDot(c, px + Math.cos(an) * d, py + Math.sin(an) * d * 0.85, 2, d < 8 ? c0 : d < 12 ? c1 : c2, (1 - p) * 0.95);
    }
    for (let i = 0; i < 3; i++) hcDot(c, cx + fa.dx * (4 + i * 3 + e * 8), cy + fa.dy * (4 + i * 3 + e * 8) + (i - 1) * 3, 2, c1, (1 - p) * 0.8);
    hcDot(c, px, py, 4, c0, 1 - p);
  } else if (P.kind === 'bolt') {
    const tipx = s.x + fa.dx * 10, tipy = s.y - 26 + fa.dy * 6;
    const e = Math.min(1, p * 1.5), dist = 6 + e * 34;
    for (let i = 0; i < 9; i++) {
      const d = dist - i * 4; if (d < 0) break;
      hcDot(c, tipx + fa.dx * d, tipy + fa.dy * d + (P.leaf ? Math.sin(now * 20 + i) * 3 : 0), i < 2 ? 4 : 2, i < 2 ? c0 : i < 5 ? c1 : c2, (1 - i / 9) * fade);
    }
    const r = 3 + p * 10;
    for (let a = 0; a < 8; a++) hcDot(c, tipx + Math.cos(a * Math.PI / 4 + p * 3) * r, tipy + Math.sin(a * Math.PI / 4 + p * 3) * r, 2, a % 2 ? c1 : c2, (1 - p) * 0.9);
    if (P.leaf) for (let a = 0; a < 3; a++) hcDot(c, tipx + fa.dx * dist * 0.7 + Math.cos(now * 9 + a * 2.1) * 6, tipy + fa.dy * dist * 0.7 + Math.sin(now * 9 + a * 2.1) * 6, 3, c1, fade);
  } else if (P.kind === 'arrow') {
    const bx = s.x + fa.dx * 8, by = s.y - 14 + fa.dy * 4, e = Math.min(1, p * 1.4), d0 = 6 + e * 46;
    for (let i = 0; i < 10; i++) { const d = d0 - i * 3; if (d < 4) break; hcDot(c, bx + fa.dx * d, by + fa.dy * d, i === 0 ? 4 : 2, i === 0 ? c0 : i < 4 ? c1 : c2, (1 - i / 10) * fade); }
    if (p < 0.4) for (let a = -2; a <= 2; a++) hcDot(c, bx + fa.dx * 2 - fa.dy * a * 4, by + fa.dy * 2 + fa.dx * a * 4 - Math.abs(a), 2, c1, (0.4 - p) * 2);
  }
  c.globalAlpha = 1;
  return true;
}

{
  const _ov = drawOverlay;
  drawOverlay = function (c) {
    _ov(c);
    const h = Game.hero;
    if (!h || h.dead || h.inside || !h.hero) return;
    const now = Game.time, key = h.hero.clsKey, def = SWING[key] || SWING_DEF;
    const fr = typeof fightFrameRaw === 'function' ? fightFrameRaw(h) : null, hx = h.hfx;
    // новый удар или заклинание — запускаем след
    if (fr === 'strike' && h._swFr !== 'strike') heroSwings.push({ t0: now, x: h.x * TILE, y: h.y * TILE, fa: hcFace(h), n: (h._swN = (h._swN || 0) + 1), def });
    else if (hx && hx.k === 'win0' && hx !== h._swHfx && hx.t > now) heroSwings.push({ t0: now, x: h.x * TILE, y: h.y * TILE, fa: hcFace(h), n: (h._swN = (h._swN || 0) + 1), def: def.kind === 'bolt' || def.kind === 'arrow' ? def : SWING.mage });
    h._swFr = fr; h._swHfx = hx;
    // замах: свечение на оружии (посох светится, лук натянут, лезвие поблёскивает)
    if (fr === 'windup') {
      const fa = hcFace(h), px = h.x * TILE, py = h.y * TILE, pu = 0.6 + 0.4 * Math.sin(now * 24), col = def.col;
      if (def.kind === 'bolt') { const r = 3 + 3 * pu; hcDot(c, px + fa.dx * 10, py - 26, r, col[1], 0.55); hcDot(c, px + fa.dx * 10, py - 26, 3, col[0], 0.95); }
      else if (def.kind === 'arrow') { for (let i = 0; i < 4; i++) hcDot(c, px + fa.dx * (8 + i * 3), py - 14, 2, col[i ? 1 : 0], 0.5 + 0.2 * i); }
      else { const an = fa.a - 1.3, rr = def.R || 16; hcDot(c, px + Math.cos(an) * rr, py - 14 + Math.sin(an) * rr * 0.85, 3, col[0], pu); hcDot(c, px + Math.cos(an) * (rr - 4), py - 14 + Math.sin(an) * (rr - 4) * 0.85, 2, col[1], pu * 0.7); }
      c.globalAlpha = 1;
    }
    for (let i = heroSwings.length - 1; i >= 0; i--) if (!hcDrawSwing(c, heroSwings[i], now)) heroSwings.splice(i, 1);
    if (heroSwings.length > 8) heroSwings.length = 0;
  };
  const _rs = resetGameState;
  resetGameState = function () { _rs(); heroSwings.length = 0; };
}
