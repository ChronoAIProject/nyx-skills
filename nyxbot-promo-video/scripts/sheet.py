#!/usr/bin/env python3
"""sheet.py — tile screenshots into one contact sheet (2 columns, 960x540 each).  usage: python3 sheet.py out.jpg img1 img2 ..."""
import sys
from PIL import Image, ImageDraw
out = sys.argv[1]; fs = sys.argv[2:]
ims = [Image.open(f).convert('RGB').resize((960, 540)) for f in fs]
cols = 2; rows = (len(ims) + 1) // 2
s = Image.new('RGB', (960 * cols, 540 * rows), 'black'); d = ImageDraw.Draw(s)
for i, (im, f) in enumerate(zip(ims, fs)):
    x, y = (i % cols) * 960, (i // cols) * 540
    s.paste(im, (x, y)); d.rectangle([x, y, x + 130, y + 30], fill='black'); d.text((x + 6, y + 6), f.split('/')[-1], fill='yellow')
s.save(out, quality=86)
