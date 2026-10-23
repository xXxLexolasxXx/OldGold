'use strict';
// Проверка входа на стенде: node check-login.js [ws://127.0.0.1:8788] [файл TESTERS.txt]
// Берёт первого тестера из TESTERS.txt, входит по паролю и ждёт welcome от сервера (нужен Node 22: встроенный WebSocket).
const fs = require('fs');
const url = process.argv[2] || 'ws://127.0.0.1:8788', tf = process.argv[3] || '/var/lib/oldgold-test/TESTERS.txt';
const [nick, pass] = fs.readFileSync(tf, 'utf8').split('\n').find(l => l && l[0] !== '#').trim().split(' ');
const ws = new WebSocket(url);
const fail = m => { console.log('ОШИБКА:', m); process.exit(1); };
const timer = setTimeout(() => fail('нет ответа за 10 с'), 10000);
ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', nick, pass, mode: 'login', ver: 'stand-check' }));
ws.onerror = e => fail(e.message || 'сокет');
ws.onmessage = async e => {
  const text = typeof e.data === 'string' ? e.data : null;
  if (!text) return;
  const m = JSON.parse(text);
  if (m.t === 'err') fail(m.msg);
  if (m.t === 'welcome') {
    clearTimeout(timer);
    console.log('вход ок:', m.nick, m.host ? '(хост)' : '', m.needClass ? '— класс ещё не выбран' : '');
    ws.close(); process.exit(0);
  }
};
