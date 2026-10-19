'use strict';
// Кладёт иконки OldGold и сплэш в нативные проекты Capacitor (вместо стандартных). Запуск: node apply-icons.js (после cap add / перед сборкой).
const sharp = require('../desktop/node_modules/sharp');
const fs = require('fs');
const path = require('path');
const ICONS = path.resolve(__dirname, '..', 'icons');
const BG = '#1a130d';
const walk = (d, f, o = []) => { if (!fs.existsSync(d)) return o; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p, f, o) : f(p) && o.push(p); } return o; };

(async () => {
  const gnome = path.join(ICONS, 'icon-1024.png');
  // Android: квадратные иконки по плотностям + адаптивный передний план
  const res = path.join(__dirname, 'android/app/src/main/res');
  const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, s] of Object.entries(sizes)) {
    for (const n of ['ic_launcher.png', 'ic_launcher_round.png']) if (fs.existsSync(path.join(res, `mipmap-${d}`, n))) await sharp(gnome).resize(s, s, { kernel: 'nearest' }).toFile(path.join(res, `mipmap-${d}`, n));
    const fg = path.join(res, `mipmap-${d}`, 'ic_launcher_foreground.png');
    if (fs.existsSync(fg)) await sharp(path.join(ICONS, 'android-adaptive-fg-432.png')).resize(Math.round(s * 108 / 48), Math.round(s * 108 / 48), { kernel: 'nearest' }).toFile(fg);
  }
  // фон адаптивной иконки — цвет игры
  const bgXml = path.join(res, 'values/ic_launcher_background.xml');
  if (fs.existsSync(bgXml)) fs.writeFileSync(bgXml, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);
  // iOS: одна иконка 1024 без прозрачности
  const ios = path.join(__dirname, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
  if (fs.existsSync(ios)) await sharp(gnome).flatten({ background: BG }).removeAlpha().toFile(ios);
  // сплэш: тот же размер, что у стандартных файлов
  const splashes = walk(path.join(__dirname, 'android'), p => /splash\.png$/.test(p)).concat(walk(path.join(__dirname, 'ios'), p => /splash-2732x2732.*\.png$/.test(p)));
  const g = await sharp(gnome).resize(512, 512, { kernel: 'nearest' }).toBuffer();
  for (const p of splashes) {
    const m = await sharp(p).metadata(), sz = Math.round(Math.min(m.width, m.height) * 0.3);
    const tile = await sharp(g).resize(sz, sz, { kernel: 'nearest' }).toBuffer();
    const buf = await sharp({ create: { width: m.width, height: m.height, channels: 3, background: BG } })
      .composite([{ input: tile, left: Math.round((m.width - sz) / 2), top: Math.round((m.height - sz) / 2) }]).png().toBuffer();
    fs.writeFileSync(p, buf);
  }
  console.log('иконки и сплэш обновлены; сплэшей:', splashes.length);
})();
