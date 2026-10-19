'use strict';
// Вкладка «Совет деревни»: общий дом для «глубинных» систем (законы, а дальше — здоровье, семьи, открытия).
// Каждая система регистрирует свою часть: councilAdd({ id, order, html(), click(btn, e), badge() }).
// Вкладка рисуется только в браузере; на кооп-сервере файл просто ничего не делает.

const COUNCIL = { parts: [], open: {} };

function councilAdd(p) {
  COUNCIL.parts = COUNCIL.parts.filter(q => q.id !== p.id);
  COUNCIL.parts.push(p);
  COUNCIL.parts.sort((a, b) => (a.order || 0) - (b.order || 0));
}

function councilHTML() {
  let h = '<div class="cn-intro">Порядки, здоровье и судьбы деревни. Решения здесь медленные, но их чувствует каждый гном.</div>';
  for (const p of COUNCIL.parts) {
    const fold = COUNCIL.open[p.id] === false;
    const body = fold ? '' : p.html();
    if (typeof COUNCIL_LAST !== 'undefined') COUNCIL_LAST.parts[p.id] = body;
    h += `<div class="cn-part" data-part="${p.id}"><h4 class="cn-h" data-cn="fold:${p.id}">${p.title} ${fold ? '▸' : '▾'}</h4><div class="cn-body">${body}</div></div>`;
  }
  return h;
}

// Перерисовка без мельтешения: каркас (заголовки разделов) — только при сворачивании, а внутри — только тот раздел,
// в котором что-то поменялось. Так на телефоне не прыгает прокрутка и не моргают кнопки соседних разделов.
const COUNCIL_LAST = { skel: '', parts: {} };
function councilRender() {
  const sec = document.getElementById('council-list');
  if (!sec) return;
  const skel = COUNCIL.parts.map(p => p.id + (COUNCIL.open[p.id] === false ? '-' : '+')).join();
  if (skel !== COUNCIL_LAST.skel || !sec.querySelector('.cn-part')) {
    COUNCIL_LAST.skel = skel; COUNCIL_LAST.parts = {};
    sec.innerHTML = councilHTML();
    return;
  }
  for (const p of COUNCIL.parts) {
    if (COUNCIL.open[p.id] === false) continue;
    const h = p.html();
    if (COUNCIL_LAST.parts[p.id] === h) continue;
    COUNCIL_LAST.parts[p.id] = h;
    const b = sec.querySelector(`.cn-part[data-part="${p.id}"] .cn-body`);
    if (b) b.innerHTML = h;
  }
}

function councilClick(e) {
  const b = e.target.closest('[data-cn]');
  if (!b || b.disabled) return;
  const v = b.dataset.cn;
  if (v.startsWith('fold:')) { const id = v.slice(5); COUNCIL.open[id] = COUNCIL.open[id] === false; updateUI(true); return; }
  const id = v.split(':')[0];
  const p = COUNCIL.parts.find(q => q.id === id);
  if (p && p.click) p.click(v.slice(id.length + 1), b, e);
}

if (typeof document !== 'undefined' && typeof navigator !== 'undefined' && navigator.userAgent !== 'node' && typeof updateUI === 'function' && document.getElementById && document.getElementById('tab-council')) {
  const _uu = updateUI;
  updateUI = function (force) {
    _uu(force);
    if (UI.tab === 'council') councilRender();
    const bd = document.getElementById('council-badge');
    if (bd) { let on = false; for (const p of COUNCIL.parts) if (p.badge && p.badge()) on = true; bd.classList.toggle('hidden', !on); }
  };
  const sec = document.getElementById('council-list');
  if (sec) sec.addEventListener('click', councilClick);
  if (typeof ICON_GRIDS !== 'undefined') {
    // свиток указа с красной печатью
    ICON_GRIDS.ui.council = { pal: { o: '#3a2410', p: '#efe0b8', P: '#c8b07a', l: '#8a7048', r: '#c8302a', R: '#7a1a14', y: '#ffd24a' }, rows: [
      '................',
      '..oooooooooooo..',
      '.oPPPPPPPPPPPPo.',
      '..oppppppppppo..',
      '..opllllllllpo..',
      '..oppppppppppo..',
      '..opllllllpppo..',
      '..oppppppppppo..',
      '..opllllllllpo..',
      '..oppppppppppo..',
      '..oplllppRRRpo..',
      '..opppppRrrrRo..',
      '.oPPPPPPRryrRo..',
      '..ooooooRrrrR...',
      '.........RRR....',
      '................'] };
  }
}
