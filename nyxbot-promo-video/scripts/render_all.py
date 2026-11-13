#!/usr/bin/env python3
"""render_all.py — render every frame in parallel, encode H.264 + AAC, and write a 1-fps contact sheet.

usage: python3 render_all.py film.html duration_seconds audio.wav out.mp4 [workers=2]
Frames go to <out>_frames/. Re-running re-renders everything (stale frames are the #1 bug source)."""
import sys, os, subprocess, math, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
film, dur, audio, out = sys.argv[1], float(sys.argv[2]), sys.argv[3], sys.argv[4]; W = int(sys.argv[5]) if len(sys.argv) > 5 else 2
fps = 30; total = int(round(dur * fps)); fr = os.path.splitext(out)[0] + '_frames'
shutil.rmtree(fr, ignore_errors=True); os.makedirs(fr)
step = math.ceil(total / W)
ps = [subprocess.Popen([sys.executable, f'{HERE}/render.py', film, fr, str(i * step), str(min(total, (i + 1) * step))]) for i in range(W)]
codes = [p.wait() for p in ps]
assert all(c == 0 for c in codes), codes
n = len([f for f in os.listdir(fr) if f.endswith('.jpg')]); assert n == total, f'{n} of {total} frames rendered'
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(fps), '-i', f'{fr}/f%05d.jpg', '-i', audio, '-map', '0:v', '-map', '1:a',
                '-vf', 'noise=alls=2:allf=t+u', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
                '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', out], check=True)
rows = math.ceil(dur / 8)
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', out, '-vf', f'fps=1,scale=480:270,tile=8x{rows}', '-frames:v', '1',
                os.path.splitext(out)[0] + '_sheet.jpg'], check=True)
print('done', out, f'{total} frames', os.path.splitext(out)[0] + '_sheet.jpg')
