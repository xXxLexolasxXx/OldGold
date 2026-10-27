# лист выбора: 4 варианта в ряд; для каждого — ур.1 фасад, ур.3 фасад, ур.1 сбоку (обрезка по прозрачному краю, ×3)
import sys
from PIL import Image
t, out = sys.argv[1], sys.argv[2]
cols = []
for v in range(4):
    a = [Image.open(f'out12/{t}-v{2*v+1}-r0.png'), Image.open(f'out12/{t}-v{2*v+2}-r0.png'), Image.open(f'out12/{t}-v{2*v+1}-r1.png')]
    cols.append([i.crop(i.getbbox()) for i in a])
W = sum(max(i.width for i in c) for c in cols) + 3 * 14 + 20
H = max(sum(i.height for i in c) + 20 for c in cols) + 20
o = Image.new('RGBA', (W, H), (74, 93, 54, 255)); x = 10
for c in cols:
    y = 10; cw = max(i.width for i in c)
    for i in c: o.paste(i, (x + (cw - i.width) // 2, y), i); y += i.height + 10
    x += cw + 14
o = o.resize((o.width * 3, o.height * 3), Image.NEAREST); o.save(out); print(out, o.size)
