# лист: один вариант по уровням 1→2→3 (фасад) + вид сбоку ур.1; либо 4 варианта × (ур.1, ур.3, бок) — как compose.py
import sys
from PIL import Image
t, out, mode = sys.argv[1], sys.argv[2], sys.argv[3]
NV = int(sys.argv[5]) if len(sys.argv) > 5 else 4
OD = sys.argv[4] if len(sys.argv) > 4 else 'out13'
crop = lambda i: i.crop(i.getbbox())
if mode == 'lv':
    row = [crop(Image.open(f'{OD}/{t}-v{n}-r0.png')) for n in (1, 2, 3)] + [crop(Image.open(f'{OD}/{t}-v1-r1.png'))]
    W = sum(i.width for i in row) + 50; H = max(i.height for i in row) + 20
    o = Image.new('RGBA', (W, H), (74, 93, 54, 255)); x = 10
    for i in row: o.paste(i, (x, H - 10 - i.height), i); x += i.width + 10
else:
    cols = [[crop(Image.open(f'{OD}/{t}-v{2*v+1}-r0.png')), crop(Image.open(f'{OD}/{t}-v{2*v+2}-r0.png')), crop(Image.open(f'{OD}/{t}-v{2*v+1}-r1.png'))] for v in range(NV)]
    W = sum(max(i.width for i in c) for c in cols) + (NV - 1) * 14 + 20; H = max(sum(i.height for i in c) + 20 for c in cols) + 20
    o = Image.new('RGBA', (W, H), (74, 93, 54, 255)); x = 10
    for c in cols:
        y = 10; cw = max(i.width for i in c)
        for i in c: o.paste(i, (x + (cw - i.width) // 2, y), i); y += i.height + 10
        x += cw + 14
o = o.resize((o.width * 3, o.height * 3), Image.NEAREST); o.save(out); print(out, o.size)
