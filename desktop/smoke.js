// Запуск Electron с проверкой «игра загрузилась без ошибок в консоли»
const r = require('child_process').spawnSync(require('electron'), ['.'], { cwd: __dirname, env: { ...process.env, OG_SMOKE: '1' }, encoding: 'utf8', timeout: 60000 });
console.log((r.stdout || '').split('\n').filter(l => l.includes('SMOKE')).join('\n') || r.stderr);
process.exit(r.status || 0);
