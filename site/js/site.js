'use strict';
// Общее для всех страниц сайта: меню, лайтбокс, журнал обновлений (читается прямо из ../js/changelog.js), форма багрепорта.
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const REPO = 'xXxLexolasxXx/OldGold';

  // меню на телефоне
  const nav = $('nav'), burger = $('#burger');
  if (burger) burger.onclick = () => { const o = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', o); };

  // лайтбокс для скриншотов
  const lb = $('#lb');
  if (lb) {
    document.addEventListener('click', e => {
      const im = e.target.closest && e.target.closest('.shots img');
      if (im) { $('img', lb).src = im.src; $('img', lb).alt = im.alt; lb.classList.add('on'); }
      else if (lb.classList.contains('on')) lb.classList.remove('on');
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('on'); });
  }

  // журнал обновлений: берём CHANGELOG из js/changelog.js игры (без побочных эффектов окна «Что нового»)
  let clPromise = null;
  function changelog() {
    if (!clPromise) clPromise = fetch('../js/changelog.js').then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }).then(t => {
      t = t.replace(/^window\.addEventListener\('load'.*$/m, '');
      return new Function(t + '\n;return CHANGELOG;')();
    });
    return clPromise;
  }
  const relHtml = e =>
    `<article class="rel panel"><h3>Версия ${esc(e.v)} — ${esc(e.title)}</h3><div class="meta">${esc(e.date)}</div>` +
    (e.news && e.news.length ? `<h4>Новое</h4><ul>${e.news.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '') +
    (e.fixes && e.fixes.length ? `<h4 class="fx">Исправлено</h4><ul>${e.fixes.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '') + '</article>';

  const list = $('#changelog');
  if (list) {
    changelog().then(cl => {
      const lim = +list.dataset.limit || cl.length;
      list.innerHTML = cl.slice(0, lim).map(relHtml).join('');
      if (lim < cl.length) list.insertAdjacentHTML('beforeend', `<p><a href="changelog.html">Все обновления (${cl.length}) →</a></p>`);
    }).catch(() => { list.innerHTML = '<p class="dim">Журнал не загрузился. Откройте <a href="https://github.com/' + REPO + '/commits/main">историю на GitHub</a>.</p>'; });
  }
  const latest = $('#latest');
  if (latest) changelog().then(cl => {
    const e = cl[0];
    latest.innerHTML = `Свежее обновление: <b>${esc(e.v)}</b> — ${esc(e.title)} <small>(${esc(e.date)})</small> · <a href="changelog.html">журнал</a>`;
  }).catch(() => {});

  // форма багрепорта: ничего не отправляем сами — открываем заранее заполненную заявку на GitHub
  const form = $('#bugform');
  if (form) {
    const f = form.elements;
    const text = (ver) => {
      const kind = f.kind.value;
      let b = `**Что случилось**\n${f.what.value.trim() || '—'}\n\n**Как повторить**\n${f.steps.value.trim() || '—'}\n`;
      if (f.env.checked) {
        const s = window.screen || {};
        b += `\n**Устройство** (добавлено по желанию)\n${navigator.userAgent}; экран ${s.width}×${s.height}; игра ${ver || '?'}\n`;
      }
      return { title: `[${kind}] ${f.title.value.trim() || 'без названия'}`, body: b };
    };
    let ver = '';
    changelog().then(cl => { ver = cl[0].v; render(); }).catch(() => {});
    const render = () => { const t = text(ver); $('#preview').textContent = t.title + '\n\n' + t.body; };
    form.addEventListener('input', render); render();
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!f.what.value.trim()) { f.what.focus(); return; }
      const t = text(ver);
      const url = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(t.title)}&body=${encodeURIComponent(t.body)}`;
      window.open(url, '_blank', 'noopener');
    });
    $('#copy').onclick = () => {
      const t = text(ver), s = t.title + '\n\n' + t.body, b = $('#copy');
      const done = () => { b.textContent = 'Скопировано'; setTimeout(() => { b.textContent = 'Скопировать текст'; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(s).then(done, () => {}); else { $('#preview').focus(); }
    };
  }
})();
