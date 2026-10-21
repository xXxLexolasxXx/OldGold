'use strict';
// Локализация. Ключ словаря = русский исходник (как в gettext): игровой код и сейвы хранят id и русский текст
// как раньше, перевод подставляется на выходе (HUD, DOM, canvas, confirm). Язык — только локальный:
// в коопе сервер шлёт те же русские строки-ключи, каждый клиент переводит их у себя.
//
//   t('Построено: {0} зданий', n)  — явный вызов (параметры {0} {1} … переводятся тоже);
//   всё остальное, что игра выводит по-русски, переводится автоматически на «стоках» (ниже).
// Словари: js/i18n/en*.js → I18N.add('en', { 'ключ': 'перевод', 'Дней: {0}': 'Days: {0}' }).
// Проверка полноты: node tools/i18n-extract.js --missing ; в игре: I18N.missing() (в en-режиме).
(function (g) {
  const LS = 'og_lang';
  const CYR = /[А-Яа-яЁё]/;
  const EN_FILES = ['en-ui', 'en-world', 'en-hero', 'en-misc', 'en-manual', 'en-systems', 'en-oaths', 'en-abil', 'en-lore', 'en-manifest', 'en-n1', 'en-n2', 'en-n3', 'en-n4', 'en-n5', 'en-n6', 'en-n7', 'en-n8', 'en-n9', 'en-n10', 'en-traitor', 'en-sea'];   // js/i18n/<имя>.js (отсутствующие молча пропускаются)
  const LANGS = { ru: 'Русский', en: 'English' };

  function pick() {
    let q = null;
    try { q = new URLSearchParams(location.search).get('lang'); } catch (e) {}
    if (q && LANGS[q]) { try { localStorage.setItem(LS, q); } catch (e) {} return q; }
    try { const s = localStorage.getItem(LS); if (s && LANGS[s]) return s; } catch (e) {}
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return /^ru\b/i.test(nav) ? 'ru' : 'en';
  }

  const I = g.I18N = {
    lang: pick(), LANGS, dict: { en: {} }, seen: new Set(),
    add(lang, o) { Object.assign(this.dict[lang] || (this.dict[lang] = {}), o); this._built = false; },
    locale() { return this.lang === 'ru' ? 'ru-RU' : 'en-GB'; },
    setLang(l) {
      if (!LANGS[l]) return;
      try { localStorage.setItem(LS, l); } catch (e) {}
      I.lang = l;
    },
    missing() { return [...I.seen]; },
  };
  try { document.documentElement.lang = I.lang; } catch (e) {}

  // ---------- t(): явный перевод ----------
  function fill(tpl, args) {
    if (!args || !args.length) return tpl;
    return tpl.replace(/\{(\d+)\}/g, (m, i) => (i < args.length ? String(args[i]) : m));
  }
  g.t = function (key) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (I.lang === 'ru') return fill(key, args);
    const a = args.map(x => (typeof x === 'string' ? tr(x) : x)), v = I.dict.en[key];
    return fill(v != null ? v : tr(key), a);
  };

  // переключатель: сохраняем выбор, автосохраняем идущую игру и перезагружаем страницу
  I.toggle = function () {
    const next = I.lang === 'ru' ? 'en' : 'ru';
    try {
      if (typeof Game !== 'undefined' && Game.units && Game.units.length && typeof saveGame === 'function' && !(typeof StartMenu !== 'undefined' && StartMenu.open)) saveGame('auto');
    } catch (e) {}
    I.setLang(next);
    try { const u = new URL(location.href); u.searchParams.delete('lang'); history.replaceState(null, '', u); } catch (e) {}   // ?lang= иначе перебьёт выбор
    location.reload();
  };
  // подпись кнопки — всегда название ДРУГОГО языка на нём самом
  const other = I.lang === 'ru' ? 'English' : 'Русский';
  const fixLabels = () => document.querySelectorAll('.lang-name').forEach(e => { e.textContent = other; });
  I.other = other;
  document.addEventListener('DOMContentLoaded', fixLabels);

  if (I.lang === 'ru') return;   // русский: стоки не ставим, нулевая стоимость

  // ---------- словари en ----------
  for (const f of EN_FILES) document.write('<script src="js/i18n/' + f + '.js"><\/script>');

  // ---------- перевод строки ----------
  const cache = new Map();
  let pats = null, wild = null, buckets = null, alias = {};
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function build() {
    pats = []; wild = []; buckets = new Map();
    const d = I.dict.en;
    for (const k in d) {
      if (!/\{\d+\}/.test(k)) continue;
      const parts = k.split(/\{(\d+)\}/);   // чёт — литерал, нечёт — номер
      let re = '^', lit = 0; const idx = [];
      const short = parts[0] === '' && parts.filter((x, i) => i % 2 === 0).join('').trim().length <= 3;   // «{0}с» не должно съедать «каменотёс»
      const short2 = !short && parts.filter((x, i) => i % 2 === 0).join('').trim().length <= 4;   // «за {0}» не должно съедать целые фразы
      for (let i = 0; i < parts.length; i++) {
        if (i % 2) { re += short ? '([0-9.,:]+)' : short2 ? '([^.!?]{0,30}?)' : '(.*?)'; idx.push(+parts[i]); } else { re += esc(parts[i]); lit += parts[i].length; }
      }
      const p = { re: new RegExp(re + '$', 's'), idx, to: d[k], lit };
      const first = parts[0];
      if (first.length === 0) wild.push(p);
      else { const b = first.slice(0, Math.min(3, first.length)); p.bl = b.length; (buckets.get(b) || buckets.set(b, []).get(b)).push(p); }
    }
    // «Достроить до уровня 2: {0}» в DOM приходит кусками: текст и (отдельно) разметка — заводим псевдоним без плейсхолдера
    alias = {};
    for (const k in d) {
      const m = /^(.*?)\s*\{0\}$/.exec(k), e = /^(.*?)\s*\{0\}$/.exec(d[k]);
      if (m && e && m[1].length > 3 && !/\{\d+\}/.test(m[1]) && !/\{\d+\}/.test(e[1]) && d[m[1]] == null) alias[m[1]] = e[1];
    }
    wild.sort((a, b) => b.lit - a.lit);
    for (const l of buckets.values()) l.sort((a, b) => b.lit - a.lit);
    I._built = true; I._alias = alias;
  }
  function dec(s) { return s.replace(/&nbsp;/g, ' '); }

  function matchPat(s) {
    if (!I._built) build();
    let cand = wild;
    for (let L = 1; L <= 3; L++) { const l = buckets.get(s.slice(0, L)); if (l) cand = cand === wild ? l.concat(wild) : cand.concat(l); }
    if (cand.length > 1) cand = cand.slice().sort((a, b) => b.lit - a.lit);
    for (const p of cand) {
      const m = p.re.exec(s);
      if (!m) continue;
      const args = [];
      for (let i = 0; i < p.idx.length; i++) args[p.idx[i]] = tr(m[i + 1]);
      return fill(p.to, args);
    }
    return null;
  }
  // цельная нормализованная строка без \n
  function core(s) {
    const d = I.dict.en;
    let v = d[s];
    if (v != null) return v;
    if (!I._built) build();
    if (alias[s] != null) return alias[s];
    v = matchPat(s);
    if (v != null) return v;
    // игра часто вставляет названия в нижнем регистре («трудяга») — ищем с заглавной и опускаем первую букву
    const c0 = s.charAt(0);
    if (c0 !== c0.toUpperCase()) {
      const up = c0.toUpperCase() + s.slice(1);
      v = d[up] != null ? d[up] : matchPat(up);
      if (v != null) return v.charAt(0).toLowerCase() + v.slice(1);
    }
    return null;
  }
  // запасной путь: переводим по кускам между числами и знаками, чтобы «5 зданий» не оставалось русским
  const NUMS = /(\d[\d.,:]*)/;
  const SPLIT = /(\d[\d.,:]*|[«»"“”()\[\]|/×·•→←↑↓+=%!?,.;:—–-]+)/;
  const EDGE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;   // значки и знаки по краям: «✔ жители», «(носит по 1)»
  // склейка из нескольких известных кусков: «испёк хлеб в» + «пекарне»
  function segment(s) {
    const w = s.split(' ');
    if (w.length < 2 || w.length > 60) return null;
    const d = I.dict.en, best = [0], from = [];
    for (let i = 1; i <= w.length; i++) {
      best[i] = Infinity;
      for (let j = Math.max(0, i - 40); j < i; j++) {
        if (best[j] === Infinity) continue;
        const piece = w.slice(j, i).join(' ');
        if (d[piece] != null && best[j] + 1 < best[i]) { best[i] = best[j] + 1; from[i] = j; }
      }
    }
    if (best[w.length] === Infinity) return null;
    const out = []; for (let i = w.length; i > 0; i = from[i]) out.unshift(d[w.slice(from[i], i).join(' ')]);
    return out.join(' ');
  }
  // кусок без чисел: целиком → без краевых знаков → из известных частей → по знакам внутри
  function chunk(raw, deep) {
    const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0], mid = raw.trim();
    if (!mid) return null;
    let v = core(mid);
    if (v != null) return lead + v + trail;
    const m2 = mid.replace(EDGE, '');
    if (m2 && m2 !== mid) {
      v = core(m2) || segment(m2);
      if (v != null) { const i0 = mid.indexOf(m2); return lead + mid.slice(0, i0) + v + mid.slice(i0 + m2.length) + trail; }
    }
    v = segment(mid);
    if (v != null) return lead + v + trail;
    if (deep) return null;
    const parts = mid.split(SPLIT); let ch = false;
    for (let i = 0; i < parts.length; i += 2) { if (!CYR.test(parts[i])) continue; const r = chunk(parts[i], true); if (r != null) { parts[i] = r; ch = true; } }
    return ch ? lead + parts.join('') + trail : null;
  }
  function pieces(s) {
    const out = s.split(NUMS);
    let changed = false;
    for (let i = 0; i < out.length; i += 2) {
      if (!CYR.test(out[i])) continue;
      const r = chunk(out[i], false);
      if (r != null) { out[i] = r; changed = true; }
    }
    return changed ? out.join('') : null;
  }
  function tr(s) {
    if (typeof s !== 'string' || !CYR.test(s)) return s;
    let r = cache.get(s);
    if (r !== undefined) return r;
    r = trUncached(s);
    if (cache.size > 6000) cache.clear();
    cache.set(s, r);
    return r;
  }
  function trUncached(s) {
    s = dec(s);
    if (s.indexOf('\n') >= 0) return s.split('\n').map(tr).join('\n');
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
    const mid = s.trim().replace(/\s+/g, ' ');
    let v = core(mid);
    if (v == null) {   // «(носит по 1)»: знаки по краям снимаем и возвращаем
      for (const re of [/^[^\p{L}\p{N}]+/u, /[^\p{L}\p{N}]+$/u, EDGE]) {   // только слева, только справа, с обеих сторон
        const m2 = mid.replace(re, '');
        if (m2 && m2 !== mid && CYR.test(m2)) { const c2 = core(m2); if (c2 != null) { const i0 = mid.indexOf(m2); v = mid.slice(0, i0) + c2 + mid.slice(i0 + m2.length); break; } }
      }
    }
    if (v == null && (mid.indexOf(' · ') > 0 || mid.indexOf(' | ') > 0)) {   // склейка из значений через разделитель
      const sep = mid.indexOf(' · ') > 0 ? ' · ' : ' | ';
      const ps = mid.split(sep).map((x, i) => {
        if (i > 0 && CYR.test(x)) { const r = tr(sep.trim() + ' ' + x); if (r.indexOf(sep.trim() + ' ') === 0 && !CYR.test(r)) return r.slice(2); }   // ключ мог начинаться с «· »
        return tr(x);
      });
      if (ps.some((x, i) => x !== mid.split(sep)[i])) v = ps.join(sep);
    }
    if (v == null) v = segment(mid);   // «Трудяга» + «дорос до 2-го уровня: …»
    if (v == null) {
      v = pieces(mid);
      if (v == null || CYR.test(v)) {
        // часть кусков не нашлась: отметим для отладки
        const rest = (v == null ? mid : v);
        if (CYR.test(rest)) I.seen.add(mid);
      }
    }
    return v == null ? s : lead + v + trail;
  }
  I.tr = tr;

  // ---------- HTML-строки: переводим только текст между тегами и title/alt/placeholder ----------
  const ATTR = /\b(title|alt|placeholder|aria-label|value)=("([^"]*)"|'([^']*)')/g;
  function unent(s) { return s.replace(/&(nbsp|amp|lt|gt|quot|mdash|ndash|times|laquo|raquo|hellip|middot|minus|rarr|larr);|&#(\d+);/g, (m, n, c) => c ? String.fromCharCode(+c) : ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', mdash: '—', ndash: '–', times: '×', laquo: '«', raquo: '»', hellip: '…', middot: '·', minus: '−', rarr: '→', larr: '←' })[n]); }
  function reent(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function trText(seg) {
    if (!CYR.test(seg)) return seg;
    const r = tr(seg.indexOf('&') >= 0 ? unent(seg) : seg);
    return r === seg ? seg : (seg.indexOf('&') >= 0 || /[<>&]/.test(r) ? reent(r) : r);
  }
  function trHtml(h) {
    if (typeof h !== 'string' || !CYR.test(h)) return h;
    return h.split(/(<[^>]*>)/).map(p => {
      if (p.charAt(0) === '<' && p.length > 1) return CYR.test(p) ? p.replace(ATTR, (m, a, q, v1, v2) => { const v = v1 != null ? v1 : v2; return a + '="' + trText(v).replace(/"/g, '&quot;') + '"'; }) : p;
      return trText(p);
    }).join('');
  }
  I.trHtml = trHtml;

  // ---------- стоки ----------
  if (typeof Node === 'undefined' || typeof MutationObserver === 'undefined') return;   // без DOM (сервер коопа, simhost) — только словарь и t()
  const def = (proto, prop, wrap) => {
    const dsc = Object.getOwnPropertyDescriptor(proto, prop);
    if (!dsc) return;
    if (dsc.set) Object.defineProperty(proto, prop, { configurable: true, enumerable: dsc.enumerable, get: dsc.get, set: wrap(dsc.set) });
    else if (typeof dsc.value === 'function') proto[prop] = wrap(dsc.value);
  };
  const setStr = fn => function (v) { return fn.call(this, typeof v === 'string' ? tr(v) : v); };
  const setHtml = fn => function (v) { return fn.call(this, typeof v === 'string' ? trHtml(v) : v); };
  def(Node.prototype, 'textContent', setStr);
  def(Node.prototype, 'nodeValue', setStr);
  def(CharacterData.prototype, 'data', setStr);
  def(HTMLElement.prototype, 'innerText', setStr);
  def(HTMLElement.prototype, 'title', setStr);
  def(HTMLInputElement.prototype, 'placeholder', setStr);
  def(HTMLInputElement.prototype, 'value', setStr);   // имя героя по умолчанию («Харальд» → Harald)
  def(HTMLImageElement.prototype, 'alt', setStr);
  def(Element.prototype, 'innerHTML', setHtml);
  def(Element.prototype, 'outerHTML', setHtml);
  def(Element.prototype, 'insertAdjacentHTML', fn => function (pos, h) { return fn.call(this, pos, trHtml(h)); });
  def(Element.prototype, 'setAttribute', fn => function (n, v) { return fn.call(this, n, (typeof v === 'string' && /^(title|alt|placeholder|aria-label)$/.test(n)) ? tr(v) : v); });
  def(Document.prototype, 'createTextNode', fn => function (s) { return fn.call(this, tr(String(s))); });
  def(Document.prototype, 'write', fn => function () { return fn.apply(this, Array.prototype.map.call(arguments, trHtml)); });
  const origTitle = Object.getOwnPropertyDescriptor(Document.prototype, 'title');
  if (origTitle && origTitle.set) Object.defineProperty(document, 'title', { configurable: true, get() { return origTitle.get.call(document); }, set(v) { origTitle.set.call(document, tr(v)); } });
  for (const n of ['alert', 'confirm', 'prompt']) { const f = g[n]; if (f) g[n] = function (m, d) { return f.call(g, tr(m), d); }; }

  const C2 = g.CanvasRenderingContext2D && g.CanvasRenderingContext2D.prototype;
  if (C2) for (const n of ['fillText', 'strokeText', 'measureText']) {
    const f = C2[n];
    C2[n] = function (s) { if (typeof s === 'string' && CYR.test(s)) arguments[0] = tr(s); return f.apply(this, arguments); };
  }

  // ---------- статический HTML и всё, что просочилось мимо сеттеров ----------
  // меняем только если перевод отличается — иначе наблюдатель зациклится на непереведённом
  function fixText(n) { const d = n.data; if (CYR.test(d)) { const r = tr(d); if (r !== d) n.data = r; } }
  function fixAttr(e, a) { const v = e.getAttribute(a); if (v && CYR.test(v)) { const r = tr(v); if (r !== v) e.setAttribute(a, r); } }
  function walk(root) {
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) for (const a of ['title', 'alt', 'placeholder', 'aria-label']) { fixAttr(root, a); }
    for (let c = root.firstChild; c; c = c.nextSibling) walk(c);
  }
  I.walk = walk;
  function boot() {
    walk(document.documentElement);
    document.title = document.title;
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') fixText(m.target);
        else if (m.type === 'attributes') fixAttr(m.target, m.attributeName);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'alt', 'placeholder', 'aria-label'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
