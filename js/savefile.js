'use strict';
// Окно «Файл сохранения»: скачать сохранение файлом, загрузить из файла, вернуть копию «до обновления».
// Нужно, чтобы прогресс не зависел от одного браузера: перенос на другой телефон/компьютер, страховка перед обновлением,
// отправка файла разработчику вместе с отчётом. Вся работа с данными — в save.js (saveExport / saveImportText / savePreBackup).

function saveFileOpen() {
  if (typeof document === 'undefined' || !document.body || !document.createElement) return;
  const old = document.getElementById('save-file-win');
  if (old) { old.remove(); return; }
  const win = document.createElement('div');
  win.id = 'save-file-win';
  win.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:100002;width:min(460px,92vw);max-height:88vh;overflow:auto;padding:16px 18px;background:#2a1e14;color:#f3e6c8;border:2px solid #a8743a;border-radius:8px;font:14px/1.45 sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.6)';
  const msg = document.createElement('div');
  msg.style.cssText = 'margin-top:10px;min-height:20px;color:#ffd98a';
  const btnCss = 'padding:8px 12px;margin:2px 4px 2px 0;font-size:14px';
  const mk = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = btnCss; b.onclick = fn; return b; };
  const describe = slot => {
    const m = saveMeta(slot);
    if (!m) return null;
    return `${Math.floor((m.time || 0) / 60)} мин игры, ${m.people || 0} жителей${m.gv ? ', версия ' + m.gv : ''}${m.at ? ', ' + new Date(m.at).toLocaleString('ru-RU') : ''}`;
  };
  const render = () => {
    win.textContent = '';
    const h = document.createElement('div');
    h.textContent = 'Файл сохранения';
    h.style.cssText = 'font-weight:bold;font-size:16px;margin-bottom:6px';
    win.appendChild(h);
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;opacity:.8;margin-bottom:8px';
    hint.textContent = 'Игра хранит сохранения в браузере. Файл — страховка на случай очистки данных браузера и способ перенести игру на другое устройство.';
    win.appendChild(hint);
    for (const [slot, name] of [['auto', 'Автосохранение'], ['manual', 'Ручное сохранение'], ['auto.pre', 'Копия до обновления игры (автосохранение)'], ['manual.pre', 'Копия до обновления игры (ручное)']]) {
      const d = describe(slot);
      if (!d) continue;
      const row = document.createElement('div');
      row.style.cssText = 'margin:6px 0;padding:6px 8px;background:rgba(255,255,255,.06);border-radius:6px';
      const t = document.createElement('div');
      t.innerHTML = '<b></b><br><span style="opacity:.8;font-size:12px"></span>';
      t.firstChild.textContent = name; t.lastChild.textContent = d;
      row.appendChild(t);
      row.appendChild(mk('Скачать файл', () => { msg.textContent = saveExport(slot) ? 'Файл сохранён (на телефоне — через «Поделиться»).' : 'Не удалось скачать'; }));
      if (/\.pre$/.test(slot)) row.appendChild(mk('Вернуть как ручное', () => {
        const raw = localStorage.getItem(SAVE_KEY + slot), r = saveImportText(raw, 'manual');
        msg.textContent = r.ok ? 'Копия возвращена в «Ручное сохранение». Нажмите «Загрузить».' : 'Не удалось: ' + r.msg;
        render(); win.appendChild(msg);
      }));
      win.appendChild(row);
    }
    if (!win.querySelector('b')) { const e = document.createElement('div'); e.textContent = 'Сохранений в этом браузере пока нет.'; win.appendChild(e); }
    const file = document.createElement('input');
    file.type = 'file'; file.accept = '.json,application/json'; file.style.display = 'none';
    file.onchange = () => {
      const f = file.files && file.files[0];
      if (!f) return;
      if (f.size > SAVE_MAX.bytes) { msg.textContent = 'Файл слишком большой — это не сохранение игры'; return; }
      const rd = new FileReader();
      rd.onload = () => {
        const r = saveImportText(String(rd.result), 'manual');
        render(); win.appendChild(msg);
        msg.textContent = r.ok ? r.msg + '. Теперь нажмите «Продолжить» или «Загрузить».' : 'Файл не принят: ' + r.msg;
      };
      rd.onerror = () => { msg.textContent = 'Файл не прочитался'; };
      rd.readAsText(f);
    };
    win.appendChild(file);
    const bar = document.createElement('div');
    bar.style.cssText = 'margin-top:8px';
    bar.appendChild(mk('Загрузить из файла…', () => file.click()));
    bar.appendChild(mk('Закрыть', () => win.remove()));
    win.appendChild(bar);
    win.appendChild(msg);
  };
  render();
  document.body.appendChild(win);
}

// Кнопка на стартовом экране (в игровом меню — своя, в index.html)
if (typeof initStartMenu === 'function') {
  const _initSM = initStartMenu;
  initStartMenu = function () {
    _initSM();
    const main = document.querySelector('#start-menu [data-panel="main"]');
    if (!main || main.querySelector('[data-save-file]')) return;
    const b = document.createElement('button');
    b.className = 'sm-btn ghost'; b.dataset.saveFile = '1';
    b.innerHTML = '<b>Файл сохранения</b><small>скачать или загрузить</small>';
    b.onclick = e => { e.stopPropagation(); saveFileOpen(); };
    main.appendChild(b);
  };
}

// Кнопка «Файл сохранения» в игровом меню
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('[data-savefile]')) saveFileOpen(); });
