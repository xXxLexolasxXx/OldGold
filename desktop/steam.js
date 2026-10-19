'use strict';
// Steamworks-слой. Сейчас — ЗАГЛУШКА: ачивки пишутся в файл, «облако» — папка в userData.
// Когда появится Steam App ID: npm i steamworks.js, положить steam_appid.txt рядом с exe, выставить STEAM_APP_ID — тогда
// ачивки и Steam Cloud пойдут через настоящий API (код подключения ниже уже написан, но не проверен без App ID).
const fs = require('fs');
const path = require('path');

const APP_ID = Number(process.env.STEAM_APP_ID || 0);
let steam = null;
if (APP_ID) {
  try { steam = require('steamworks.js').init(APP_ID); } catch (e) { console.warn('[steam] не удалось подключить steamworks.js:', e.message); }
}

// Соответствие id ачивок игры (js/profile.js, ACHS) → API-имена в Steamworks. Пока совпадают с id; уточнить при заведении ачивок в партнёрском кабинете.
const apiName = id => 'ACH_' + String(id).toUpperCase().replace(/[^A-Z0-9]+/g, '_');

function createSteam(userData) {
  const dir = path.join(userData, 'cloud');
  fs.mkdirSync(dir, { recursive: true });
  const achFile = path.join(userData, 'achievements.json');
  const readAch = () => { try { return JSON.parse(fs.readFileSync(achFile, 'utf8')); } catch (e) { return {}; } };
  const safe = k => String(k).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return {
    available: !!steam,
    achievement(id) {
      const a = readAch(); if (a[id]) return; a[id] = Date.now();
      try { fs.writeFileSync(achFile, JSON.stringify(a)); } catch (e) { /* диск */ }
      if (steam) { try { steam.achievement.activate(apiName(id)); } catch (e) { console.warn('[steam] ачивка', e.message); } }
    },
    cloudPut(key, data) {
      const name = safe(key);
      try { fs.writeFileSync(path.join(dir, name), data); } catch (e) { return false; }
      if (steam) { try { steam.cloud.writeFile(name, Buffer.from(data)); } catch (e) { /* облако выключено */ } }
      return true;
    },
    cloudAll() {
      const o = {};
      for (const f of fs.readdirSync(dir)) { try { o[f] = fs.readFileSync(path.join(dir, f), 'utf8'); } catch (e) { /* файл занят */ } }
      return o;
    },
  };
}
module.exports = { createSteam };
