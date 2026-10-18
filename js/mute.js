'use strict';
// Тихий режим для разработки и тестов: на localhost, в управляемом браузере (navigator.webdriver) и с ?mute=1
// музыка и звуки по умолчанию выключены, чтобы тестовые вкладки не шумели. У игроков на сайте всё как раньше.
// Явный выбор в игре (кнопки ♪ и 🔊) запоминается и сильнее этого правила.
(function () {
  try {
    const q = new URLSearchParams(location.search);
    const dev = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || navigator.webdriver === true || q.get('mute') === '1';
    if (!dev) return;
    for (const k of ['feod.music', 'feod.sfx']) if (localStorage.getItem(k) === null) localStorage.setItem(k, '0');
  } catch (e) { /* нет доступа к хранилищу */ }
})();
