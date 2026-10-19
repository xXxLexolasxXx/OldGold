'use strict';
// Растеризует favicon.svg (пиксель-арт гном 18×17) в иконки всех размеров → ../icons/. Фон — цвет игры, углы не скругляем (скругляют сами магазины).
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BG = '#1a130d';
const svg = fs.readFileSync(path.join(ROOT, 'favicon.svg'));
const OUT = path.join(ROOT, 'icons');
fs.mkdirSync(OUT, { recursive: true });

// гном без фона, пиксели крупные и резкие
async function gnome(size) {
  const k = Math.max(1, Math.floor(size / 18));       // целый масштаб, чтобы не было смазывания
  const buf = await sharp(svg, { density: 72 * k }).resize(18 * k, 17 * k, { kernel: 'nearest' }).png().toBuffer();
  return sharp(buf).resize(size, Math.round(size * 17 / 18), { kernel: 'nearest' }).png().toBuffer();
}
async function icon(size, name, pad = 0.14, bg = BG) {
  const inner = Math.round(size * (1 - pad * 2));
  const g = await gnome(inner);
  const meta = await sharp(g).metadata();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: g, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2) }])
    .png().toFile(path.join(OUT, name));
}
(async () => {
  for (const s of [1024, 512, 256, 192, 180, 167, 152, 120, 76, 48, 32, 16]) await icon(s, `icon-${s}.png`);
  // Android adaptive: передний план на прозрачном фоне с запасом 66% (безопасная зона)
  const fg = 432, g = await gnome(Math.round(fg * 0.6)), m = await sharp(g).metadata();
  await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: g, left: Math.round((fg - m.width) / 2), top: Math.round((fg - m.height) / 2) }]).png().toFile(path.join(OUT, 'android-adaptive-fg-432.png'));
  // Мaskable для PWA (больше запас)
  await icon(512, 'icon-maskable-512.png', 0.22);
  console.log(fs.readdirSync(OUT).join(' '));
})();
