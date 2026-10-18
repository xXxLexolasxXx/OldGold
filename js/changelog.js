'use strict';
// «Что нового»: при каждом обновлении версии при заходе в игру всплывает окно со списком нововведений и исправлений.
// Правило: выкладываешь обновление — добавь запись В НАЧАЛО CHANGELOG и подними GAME_VERSION (он берётся из первой записи).
// Окно показывается один раз на версию на каждом устройстве (запоминается в localStorage); ?whatsnew=1 — показать принудительно.

const CHANGELOG = [
  {
    v: '0.9.2', date: '2026-10-18', title: 'Рогатые жнецы и когти-серпы',
    news: [
      'Жнец теперь в чёрном рогатом шлеме; рога демонические, трёх форм: завитые бараньи, высокие бычьи, корона из шипов (у каждого жнеца своя)',
      'Пальцы призраков и жнеца: фаланги с суставами и когти-серпы, изогнутые и острые',
    ],
    fixes: [],
  },
  {
    v: '0.9.2', date: '2026-10-18', title: 'Праздник!',
    news: [
      'Новое событие — «Праздник»: раз в несколько дней (или кнопкой в трактире, или после победы над нечистью) все жители бросают работу, идут к трактиру, пьют эль, пляшут и кричат «ура». Длится день-два',
      'Гирлянды с флажками между фонарями и на трактире, бочки у входа, конфетти; звон кружек и общий гул',
      'Эль и еда уходят быстрее, а после праздника гномы мучаются похмельем и ходят вяло',
      'Нечисть и наступление вечера прерывают гулянку',
    ],
    fixes: [],
  },
  {
    v: '0.9.1', date: '2026-10-18', title: 'Облик нежити',
    news: [
      'Жнец теперь выглядит как Смерть: просторный чёрный капюшон с черепом в тени и длинная коса с серповидным лезвием',
      'У призраков кисти стали меньше, а когти длиннее и тоньше',
    ],
    fixes: [],
  },
  {
    v: '0.9.0', date: '2026-10-18', title: 'Призраки и жнец',
    news: [
      'Призраки перерисованы целиком: бестелесные лапы с когтями, зловещий капюшон с костяными рогами, зернистый хвост, могильные глаза (красные — только когда пугают)',
      'Новая нежить 2-го уровня — призрак-жнец: с 3-й ночи, на окраине, по одному. Не берёт хлеб, молитвой не изгоняется, гасит фонари, пугает всю округу и косит героя косой',
      'У призраков по 9 кадров парения и 8 кадров удара: если герой изгоняет призрака, тот огрызается когтями',
    ],
    fixes: [
      'Призраки больше не уплывают за край карты',
      'Успокоенный хлебом призрак перестал пугать гномов',
      'Призраки растворяются с началом рассвета, а не в самом конце; загрузка на рассвете не вызывает новой нечисти',
    ],
  },
];
const GAME_VERSION = CHANGELOG[0].v;

function whatsNewShow(force) {
  let seen = null;
  try { seen = localStorage.getItem('oldgold.seenVersion'); } catch (e) { /* приватный режим */ }
  if (!force && seen === GAME_VERSION) return;
  // что пропустил игрок: записи новее виденной (не больше трёх); новичку и при ?whatsnew=1 — только последняя
  const at = force || !seen ? -1 : CHANGELOG.findIndex(e => e.v === seen);
  const list = CHANGELOG.slice(0, at > 0 ? Math.min(3, at) : 1);
  if (!document.getElementById('whatsnew-css')) {
    const st = document.createElement('style'); st.id = 'whatsnew-css';
    st.textContent = `#whatsnew{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:12px;font-family:Kurale,Georgia,serif}
#whatsnew .wn-box{max-width:520px;width:100%;max-height:86vh;overflow:auto;padding:16px 20px;color:#e9dcc0;background:linear-gradient(rgba(0,0,0,.3),rgba(0,0,0,.5)),var(--wood-tex,none),#2a1e14;border:2px solid #0a0705;box-shadow:inset 0 0 0 1px var(--gold,#c9a24a),0 6px 24px rgba(0,0,0,.8)}
#whatsnew h2{margin:0 0 2px;color:var(--gold-hi,#ffd877);font-size:22px}#whatsnew h3{margin:12px 0 4px;font-size:14px;color:var(--gold,#c9a24a);text-transform:uppercase;letter-spacing:.06em}
#whatsnew .wn-v{font-size:12px;opacity:.7;margin-bottom:6px}#whatsnew ul{margin:0;padding-left:20px;font-size:14px;line-height:1.4}#whatsnew li{margin:3px 0}
#whatsnew button{display:block;margin:16px auto 2px;padding:7px 28px;font:inherit;font-size:15px;color:#2a1e14;background:linear-gradient(#ffd877,#c9a24a);border:2px solid #0a0705;cursor:pointer}`;
    document.head.appendChild(st);
  }
  const old = document.getElementById('whatsnew'); if (old) old.remove();
  const el = document.createElement('div'); el.id = 'whatsnew';
  const esc = s => String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  el.innerHTML = `<div class="wn-box"><h2>Что нового</h2>` + list.map((e, n) =>
    `<div class="wn-v">${n ? '' : 'Версия '}${esc(e.v)} · ${esc(e.date)} — ${esc(e.title)}</div>` +
    (e.news && e.news.length ? `<h3>Новое</h3><ul>${e.news.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '') +
    (e.fixes && e.fixes.length ? `<h3>Исправлено</h3><ul>${e.fixes.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '')).join('') +
    `<button type="button">Понятно</button></div>`;
  const close = () => { el.remove(); try { localStorage.setItem('oldgold.seenVersion', GAME_VERSION); } catch (e) { /* ничего */ } };
  el.querySelector('button').onclick = close;
  el.addEventListener('click', ev => { if (ev.target === el) close(); });
  document.body.appendChild(el);
}

window.addEventListener('load', () => setTimeout(() => whatsNewShow(/[?&]whatsnew=1/.test(location.search)), 400));
