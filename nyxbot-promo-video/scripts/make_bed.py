#!/usr/bin/env python3
"""make_bed.py — build the music bed + sound effects for a promo film from timeline.json.

usage:  python3 make_bed.py timeline.json out_raw.wav
then:   python3 master.py out_raw.wav out_master.wav -18      (−18 LUFS leaves room for a voice-over)

Everything is synthesised (no samples, no licences). The music is ducked under every
voice-over slot in timeline["vo"] (music −7 dB, effects −3 dB), so a VO dropped on top
at the same timecodes sits clearly. See references/audio.md for the full schema.
"""
import json, sys, os, wave
import numpy as np
from scipy import signal

cfg = json.load(open(sys.argv[1])); OUT = sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
END = float(cfg['duration']); N = int(SR * (END + .5))
BEAT = 60.0 / float(cfg.get('bpm', 120))
rng = np.random.default_rng(int(cfg.get('seed', 78)))
exec(open(os.path.join(HERE, 'audiolib.py')).read())

CH = {'Am': [57, 60, 64, 69], 'F': [57, 60, 65, 69], 'C': [55, 60, 64, 67], 'G': [55, 59, 62, 67], 'Dm': [57, 62, 65, 69],
      'Em': [55, 59, 64, 67], 'Am9': [57, 60, 64, 71], 'Fmaj7': [53, 57, 60, 64], 'Cmaj7': [55, 59, 64, 67],
      'E': [56, 59, 64, 68], 'Gsus': [55, 60, 62, 67], 'Dsus': [57, 62, 64, 69]}
ROOTN = {'Am': 33, 'F': 29, 'C': 36, 'G': 31, 'Dm': 38, 'Em': 28, 'Am9': 33, 'Fmaj7': 29, 'Cmaj7': 36, 'E': 28, 'Gsus': 31, 'Dsus': 38}

# ---------- chord timeline: [t, "Chord"] changes and {"loop": [...], "start", "end", "every"} blocks ----------
changes = []
for c in cfg['music']['chords']:
    if isinstance(c, dict):
        t = c['start']; k = 0
        while t < c['end'] - 1e-6:
            changes.append((t, c['loop'][k % len(c['loop'])])); t += c.get('every', 2.0); k += 1
    else:
        changes.append((float(c[0]), c[1]))
changes.sort()
def chord_at(t):
    cur = changes[0][1]
    for tc, ch in changes:
        if tc <= t: cur = ch
        else: break
    return cur

drums, bass, pads, arps, fx, ui = bus(), bus(), bus(), bus(), bus(), bus()

# ---------- sections ----------
# mode: groove | tension | break | build | quiet
for sec in cfg['music']['sections']:
    a, b, mode = float(sec['start']), float(sec['end']), sec['mode']
    beats = np.arange(a, b - 1e-6, BEAT)
    for bi, t in enumerate(beats):
        r = ROOTN[chord_at(t + .01)]
        if mode == 'groove':
            place(drums, kick(.95), t)
            if bi % 2 == 1: place(drums, clap(.5), t, pan=.05)
            place(drums, hat(.16), t + BEAT / 2, pan=.25)
            for k in range(4): place(drums, hat(.045), t + k * BEAT / 4, pan=-.35)
            if sec.get('open_hat'): place(drums, hat(.07, True), t + BEAT / 2, pan=-.2)
            place(bass, bass_note(r + 24, BEAT / 2) * .55, t + BEAT / 2); place(bass, bass_note(r + 12, BEAT / 2) * .35, t)
        elif mode == 'tension':
            if bi % 2 == 0: place(drums, kick(.42, .3), t)
            place(drums, tick(.35), t, pan=.3); place(drums, tick(.15), t + BEAT / 2, pan=-.3)
        elif mode == 'break':
            if bi % 2 == 0: place(drums, kick(.35, .3), t)
        elif mode == 'build':
            p = (t - a) / max(b - a, 1e-6)
            place(drums, kick(.5 + .4 * p), t); place(drums, hat(.06 + .1 * p), t + BEAT / 2, pan=.25)
            for off in (0, BEAT / 2): place(bass, bass_note(r + 24, BEAT / 2, 500 + 500 * p) * (.35 + .3 * p), t + off)
    cut = sec.get('pad_cutoff', {'groove': 2500, 'tension': 800, 'break': 1100, 'build': 1800, 'quiet': 900}[mode])
    if sec.get('pad', True):
        pad_section(a, b, cut, sec.get('pad_level', .5), pump=mode in ('groove', 'build'), step=sec.get('pad_step', 2.0))
    if sec.get('arp', mode != 'quiet'):
        arp_section(a + (0 if mode == 'groove' else BEAT), b, sec.get('arp_level', {'groove': .13, 'tension': .1, 'break': .12, 'build': .12, 'quiet': .08}[mode]),
                    sec.get('arp_bright', {'groove': 4200, 'tension': 1600, 'break': 3000, 'build': 3400, 'quiet': 1400}[mode]))
    if mode in ('tension', 'break', 'quiet') and sec.get('drone', True):
        drone(a, b + .2, ROOTN[chord_at(a + .01)], .3)
arps = pingpong(arps)

# ---------- hits ----------
# drop: riser + reverse cymbal into t, impact + crash on t. hit: impact + light crash. end: impact + crash + held end chord.
for h in cfg['music'].get('hits', []):
    t, kind = float(h['t']), h['kind']; lead = h.get('lead', 1.6)
    if kind == 'drop':
        place(fx, riser(lead, .45, 260, 8000), t - lead); place(fx, rev_cymbal(min(lead, 1.4), .5), t - min(lead, 1.4))
        place(fx, impact(h.get('level', 1.0)), t); place(fx, crash(.55), t)
    elif kind == 'hit':
        place(fx, impact(h.get('level', .8)), t); place(fx, crash(h.get('crash', .4)), t)
    elif kind == 'end':
        place(fx, impact(.8), t); place(fx, crash(.45), t)
        ch = h.get('chord', 'C'); x = supersaw_chord(CH[ch] + [CH[ch][1] + 12], END - t + .4, .64, 2200)
        place(pads, x * np.exp(-np.arange(len(x)) / SR * 1.0)[:, None], t)
        place(bass, bass_note(ROOTN[ch], 2.4, 380, .9) * .75, t)
for r0 in cfg['music'].get('rolls', []):  # [t0, t1, level0, level1] clap roll in 16ths
    t0, t1, l0, l1 = r0
    for t in np.arange(t0, t1 - .01, BEAT / 4): place(drums, clap(l0 + (l1 - l0) * (t - t0) / (t1 - t0)), t, pan=.05)

# ---------- sound effects ----------
# {"t": 1.0, "kind": "blip", "f": 880, "f2": 1100, "level": .12, "repeat": 8, "every": .25, "pan": .3, "alt_pan": true, "step_f": 60}
def sfx_one(e, t, i):
    k = e['kind']; lv = e.get('level', .3)
    f = e.get('f', 990) + e.get('step_f', 0) * i; f2 = e.get('f2', None); f2 = f2 + e.get('step_f', 0) * i if f2 else None
    pan = e.get('pan', 0) * ((-1) ** i if e.get('alt_pan') else 1)
    bus_ = fx if k in ('impact', 'whoosh_up', 'whoosh_down', 'riser') else ui
    x = {'blip': lambda: blip(f, e.get('dur', .07), lv, f2), 'tick': lambda: tick(lv), 'ding': lambda: ding(lv), 'clink': lambda: clink(lv),
         'stamp': lambda: stamp_sfx(lv), 'impact': lambda: impact(lv), 'whoosh_up': lambda: whoosh(e.get('dur', .45), lv, True),
         'whoosh_down': lambda: whoosh(e.get('dur', .5), lv, False), 'ring': lambda: ring_tone(level=lv),
         'riser': lambda: riser(e.get('dur', 1.2), lv, 300, 8000)}[k]()
    place(bus_, x, t, pan=pan)
for e in cfg.get('sfx', []):
    if e['kind'] == 'typing':  # {"kind":"typing","t":35.1,"end":36.6,"every":.06}
        for t in np.arange(e['t'], e['end'], e.get('every', .06)): place(ui, tick(rng.uniform(.04, .08) * e.get('level', 1)), t, pan=rng.uniform(-.3, .3))
    elif e['kind'] == 'hangup':
        for i in range(2): place(ui, blip(425, .12, e.get('level', .2)), e['t'] + i * .22)
    else:
        for i in range(int(e.get('repeat', 1))): sfx_one(e, e['t'] + i * e.get('every', .25), i)

# ---------- mix: duck music under every VO slot ----------
def rms(x): return float(np.sqrt(np.mean(x ** 2)) + 1e-12)
music = reverb(drums * .85 + bass * .9 + pads * .55 + arps * .7, IR_HALL, .12)
grooves = [s for s in cfg['music']['sections'] if s['mode'] == 'groove'] or cfg['music']['sections']
ref = np.mean([rms(music[int(s['start'] * SR):int(s['end'] * SR)]) for s in grooves])
gu = ref * 10 ** (cfg.get('ui_db', -4) / 20) / rms(ui[ui.any(1)]) if ui.any() else 0
gf = ref * 10 ** (cfg.get('fx_db', 0) / 20) / max(rms(fx[fx.any(1)]), 1e-9) * .6 if fx.any() else 0
cn = np.arange(N) / SR; duck = np.ones(N)
for v in cfg.get('vo', []):
    s0, e0 = float(v['start']), float(v['end'])
    duck = np.minimum(duck, np.interp(cn, [s0 - .25, s0 - .05, e0 + .05, e0 + .4], [1, 0, 0, 1], left=1, right=1))
dm = 10 ** (cfg.get('duck_music_db', -7) / 20); df = 10 ** (cfg.get('duck_fx_db', -3) / 20)
gm = (dm + (1 - dm) * duck)[:, None]; gfx = (df + (1 - df) * duck)[:, None]
mix = music * gm + fx * gf * gfx + ui * gu * gm
mix = compress(mix, -12, 1.8, .005, .2)[:int(END * SR)]
fo = np.ones(len(mix)); n0 = int((END - .8) * SR); fo[n0:] = np.linspace(1, 0, len(mix) - n0) ** 1.5; mix *= fo[:, None]
fi = np.minimum(1, np.arange(len(mix)) / (SR * .02)); mix *= fi[:, None]
mix = mix / np.abs(mix).max() * .89
write_wav(OUT, mix)
print(f'wrote {OUT}  {END:.1f}s  ui gain {gu:.2f}  fx gain {gf:.2f}  vo slots {len(cfg.get("vo", []))}')
