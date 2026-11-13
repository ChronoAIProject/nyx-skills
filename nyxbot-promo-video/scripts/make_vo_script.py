#!/usr/bin/env python3
"""make_vo_script.py — turn timeline.json["vo"] into a voice-over script (.md), subtitles (.srt) and one plain paragraph.

usage: python3 make_vo_script.py timeline.json out_dir [name]
Checks each line's speaking rate: Chinese VO reads comfortably at ~4 characters/second; >4.6 is flagged.
"""
import json, sys, os, re
cfg = json.load(open(sys.argv[1])); out = sys.argv[2]; name = sys.argv[3] if len(sys.argv) > 3 else 'VO'
os.makedirs(out, exist_ok=True); vo = cfg['vo']
def tc(s):
    ms = int(round(s * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s_, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s_:02d},{ms:03d}'
def n_chars(t): return len(re.sub(r'[，。？！、：；—…“”「」\s]', '', re.sub(r'[A-Za-z]+', 'AA', t)))  # an English word ≈ 2 syllables
srt = '\n'.join(f"{i + 1}\n{tc(v['start'])} --> {tc(v['end'])}\n{v['text']}\n" for i, v in enumerate(vo))
open(f'{out}/{name}-配音稿.srt', 'w').write(srt)
rows = [f"# {cfg.get('title', name)} · 配音稿（{cfg['duration']:.0f} 秒）", '',
        cfg.get('vo_direction', '语气像自己人当面跟老板说话：亲切、实在、有劲，不要播音腔。语速约每秒 4 个字。'),
        f'每句单独生成一个音频，按编号命名 01.wav … {len(vo):02d}.wav。', '',
        '| # | 开始 | 最长 | 台词 | 提示 |', '|---|---|---|---|---|']
warn = []
for i, v in enumerate(vo):
    d = v['end'] - v['start']; r = n_chars(v['text']) / d
    if r > 4.6: warn.append(f"{v.get('id', i + 1)} 语速 {r:.1f} 字/秒，偏快：缩短台词或放宽时段")
    rows.append(f"| {v.get('id', f'{i + 1:02d}')} | {v['start']:.1f}s | {d:.1f}s | {v['text']} | {v.get('note', '')} |")
rows += ['', '整段连读版：', '', ''.join(v['text'] for v in vo)]
open(f'{out}/{name}-配音稿.md', 'w').write('\n'.join(rows) + '\n')
for i in range(1, len(vo)):
    if vo[i]['start'] < vo[i - 1]['end'] + .2: warn.append(f"{vo[i].get('id')} 和上一句间隔不足 0.2 秒")
print('\n'.join(rows[5:5 + len(vo) + 2])); print('\n'.join('⚠ ' + w for w in warn) or '✓ 语速和间隔都在范围内')
