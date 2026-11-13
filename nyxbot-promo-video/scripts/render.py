#!/usr/bin/env python3
"""render.py — render frames [start, end) of film.html to JPEGs.  usage: python3 render.py film.html frames_dir start end [fps]
The film must expose window.readyPromise and window.seek(seconds). Frame f is captured at t = f / fps."""
import sys, asyncio, os, time
from playwright.async_api import async_playwright
film, out, a, b = os.path.abspath(sys.argv[1]), sys.argv[2], int(sys.argv[3]), int(sys.argv[4]); fps = float(sys.argv[5]) if len(sys.argv) > 5 else 30.0
os.makedirs(out, exist_ok=True)
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(args=['--allow-file-access-from-files', '--disable-web-security', '--force-device-scale-factor=1'])
        pg = await br.new_page(viewport={'width': 1920, 'height': 1080}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + film); await pg.evaluate('window.readyPromise'); t0 = time.time()
        for f in range(a, b):
            await pg.evaluate(f'window.seek({f / fps:.5f})')
            await pg.screenshot(path=f'{out}/f{f:05d}.jpg', type='jpeg', quality=94, clip={'x': 0, 'y': 0, 'width': 1920, 'height': 1080})
            if (f - a) % 200 == 0: print(f'frame {f} {time.time() - t0:.1f}s', flush=True)
        if errs: print('PAGE ERRORS', errs[:5])
        await br.close()
asyncio.run(main())
