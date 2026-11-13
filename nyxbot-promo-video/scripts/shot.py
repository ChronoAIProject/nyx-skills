#!/usr/bin/env python3
"""shot.py — screenshot the film at given times (for checking layout).  usage: python3 shot.py film.html out_dir t1 t2 ..."""
import sys, asyncio, os
from playwright.async_api import async_playwright
async def main():
    film, out = os.path.abspath(sys.argv[1]), sys.argv[2]; ts = [float(x) for x in sys.argv[3:]]; os.makedirs(out, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--disable-web-security'])
        pg = await b.new_page(viewport={'width': 1920, 'height': 1080}); msgs = []
        pg.on('console', lambda m: msgs.append(m.text)); pg.on('pageerror', lambda e: msgs.append('ERR ' + str(e)))
        await pg.goto('file://' + film); await pg.evaluate('window.readyPromise')
        for t in ts:
            await pg.evaluate(f'window.seek({t})'); await pg.screenshot(path=f'{out}/t{t:06.2f}.png', clip={'x': 0, 'y': 0, 'width': 1920, 'height': 1080})
        for m in msgs[:20]: print(m)
        await b.close()
asyncio.run(main())
