'use strict';
// Синтетические игроки тестового стенда: node seed-testers.js <папка данных> [кол-во=6]
// Ники tester1…testerN, пароли случайные — пишутся в <папка>/TESTERS.txt (только root), в players.json — соль и хеш
// тем же способом, что в server.js (scrypt). Боевые аккаунты сюда не копируются.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dir = process.argv[2], n = +(process.argv[3] || 6);
if (!dir) { console.error('укажи папку данных'); process.exit(1); }
const users = {}, lines = [];
for (let i = 1; i <= n; i++) {
  const nick = 'tester' + i, pass = crypto.randomBytes(6).toString('base64url');
  const salt = crypto.randomBytes(16).toString('hex');
  users[nick] = { nick, salt, hash: crypto.scryptSync(pass, salt, 32).toString('hex'), hero: null, created: Date.now(), synthetic: true };
  lines.push(nick + ' ' + pass);
}
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'players.json'), JSON.stringify(users));
const tf = path.join(dir, 'TESTERS.txt');
fs.writeFileSync(tf, '# тестовый стенд: ник пароль (tester1 — хост)\n' + lines.join('\n') + '\n', { mode: 0o600 });
fs.chmodSync(tf, 0o600);
console.log('тестовых игроков', n, '— пароли в', tf);
