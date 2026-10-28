// Честный замер кадров при отдалении: без обёрток, игра на паузе и на ходу, fps по requestAnimationFrame
// и время render() на процессоре. Для сравнения двух версий игры на разных портах.
// node tools/zoomperf-ab.js <save.json> <порт> [<порт> ...]   (порты чередуются, по 2 прохода)
const fs = require('fs');
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const SAVE = process.argv[2], PORTS = process.argv.slice(3);
async function measure(br, port) {
  const raw = fs.readFileSync(SAVE, 'utf8');
  const pg = await br.newPage({ viewport: { width: 1920, height: 1080 } });
  await pg.addInitScript(([raw]) => { try { if (!sessionStorage.getItem('zp')) { localStorage.clear(); localStorage.setItem('feod.save.manual', raw); localStorage.setItem('feod.save.manual.meta', JSON.stringify({ at: Date.now(), time: 6000, people: 34 })); localStorage.setItem('feod.eco', '0'); sessionStorage.setItem('zp', '1'); } } catch (e) { } }, [raw]);
  await pg.goto(`http://localhost:${port}/index.html`);
  await pg.waitForFunction(() => { const b = document.querySelector('#start-menu [data-sm="continue"]'); return b && b.offsetWidth > 0 && !b.disabled; }, null, { timeout: 150000 });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetWidth && b.textContent.trim() === 'Понятно'); if (b) b.click(); });
  await pg.click('#start-menu [data-sm="continue"]');
  await pg.waitForFunction(() => Game.buildings.length > 0 && !document.querySelector('#start-menu')?.offsetWidth, null, { timeout: 60000 });
  await pg.waitForTimeout(2000);
  const out = {};
  for (const z of [2, 1, 0.5]) {
    await pg.evaluate(z => { Game.speed = 1; R.cam.z = z; const b = Game.buildings.find(b => b.type === 'bonfire') || Game.buildings[0]; centerOn((b.x + 2) * TILE, (b.y + 2) * TILE); }, z);
    await pg.waitForTimeout(+(process.env.WARM || 4000));   // прогрев кэшей
    out[z] = await pg.evaluate(async () => {
      const fps = async ms => { let fr = 0, worst = 0, last = performance.now(); const t0 = last; await new Promise(res => { const f = () => { const n = performance.now(); worst = Math.max(worst, n - last); last = n; fr++; if (n - t0 < ms) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }); return [+(fr / ms * 1000).toFixed(1), Math.round(worst)]; };
      // время самой render() на процессоре (без чтения пикселей: чтение с главного холста переводит его в программный режим)
      const live = await fps(6000);
      const a = []; for (let i = 0; i < 10; i++) { const t = performance.now(); render(); a.push(performance.now() - t); await new Promise(r => requestAnimationFrame(r)); }
      a.sort((x, y) => x - y);
      return { fps: live[0], worstMs: live[1], frameMs: +a[5].toFixed(1) };
    });
  }
  await pg.close();
  return out;
}
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try { const cdp = await br.newBrowserCDPSession(); const i = await cdp.send('SystemInfo.getInfo'); console.log('2d_canvas:', i.gpu.featureStatus['2d_canvas'], '| gpu_compositing:', i.gpu.featureStatus.gpu_compositing); } catch (e) { console.log('нет SystemInfo', e.message); }
  for (let pass = 0; pass < 2; pass++) for (const p of PORTS) {
    const r = await measure(br, p);
    console.log(`порт ${p}, проход ${pass + 1}: ` + Object.entries(r).map(([z, v]) => `z=${z}: ${v.fps} к/с (худший ${v.worstMs} мс), render ${v.frameMs} мс`).join(' | '));
  }
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
