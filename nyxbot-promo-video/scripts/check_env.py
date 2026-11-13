#!/usr/bin/env python3
"""check_env.py — what can this sandbox do?  Prints which pipeline steps will work."""
import shutil, importlib, subprocess, sys
ok = {}
for m in ['numpy', 'scipy', 'PIL', 'playwright']:
    try: importlib.import_module(m); ok[m] = True
    except Exception: ok[m] = False
ok['ffmpeg'] = bool(shutil.which('ffmpeg'))
ok['chromium'] = False
if ok['playwright']:
    try:
        r = subprocess.run([sys.executable, '-c', 'from playwright.sync_api import sync_playwright\nwith sync_playwright() as p: p.chromium.launch().close()'], capture_output=True, timeout=60)
        ok['chromium'] = r.returncode == 0
    except Exception: pass
for k, v in ok.items(): print(f"{'✓' if v else '✗'} {k}")
print()
print('配音稿 / 字幕 (make_vo_script.py):', '可以' if True else '')
print('配乐音效 (make_bed.py):', '可以' if ok['numpy'] and ok['scipy'] else '不行：缺 numpy/scipy')
print('响度母带 (master.py):', '可以' if ok['ffmpeg'] and ok['scipy'] else '不行：缺 ffmpeg —— 交付 bed_raw.wav 即可')
print('截图检查 / 渲染视频 (shot.py, render_all.py):', '可以' if ok['chromium'] and ok['ffmpeg'] else '不行：缺 Chromium/Playwright 或 ffmpeg —— 交付 film.html + 一键渲染命令，让用户本机跑')
