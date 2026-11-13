# audiolib.py — synth / SFX / mixing helpers. NOT imported: make_bed.py exec()s this file into its own
# namespace, which must already define: np, signal, wave, SR (sample rate), N (total samples), rng (numpy Generator).
# ---------------- helpers ----------------
def read_wav(fn):
    w = wave.open(fn); sr = w.getframerate(); ch = w.getnchannels()
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768
    if ch == 2: x = x.reshape(-1, 2).mean(1)
    if sr != SR:
        g = np.gcd(SR, sr); x = signal.resample_poly(x, SR // g, sr // g)
    return x

def write_wav(fn, x):
    x = np.clip(x, -1, 1)
    if x.ndim == 1: x = np.stack([x, x], 1)
    y = (x * 32767).astype(np.int16)
    w = wave.open(fn, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(y.tobytes()); w.close()

def bus(): return np.zeros((N, 2))

def place(buf, x, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N: return
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2), np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
        x = np.stack([x * l, x * r], 1)
    if i < 0: x = x[-i:]; i = 0
    n = min(len(x), N - i)
    buf[i:i + n] += x[:n] * gain

def biquad(kind, f0, q=0.707, g=0.0):
    f0 = min(max(f0, 10), SR * 0.45)
    w0 = 2 * np.pi * f0 / SR; cw, sw = np.cos(w0), np.sin(w0); al = sw / (2 * q); A = 10 ** (g / 40)
    if kind == 'lp': b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == 'hp': b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == 'bp': b = [al, 0, -al]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == 'pk': b = [1 + al * A, -2 * cw, 1 - al * A]; a = [1 + al / A, -2 * cw, 1 - al / A]
    elif kind == 'ls':
        sa = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) - (A - 1) * cw + sa), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sa)]
        a = [(A + 1) + (A - 1) * cw + sa, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sa]
    elif kind == 'hs':
        sa = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * cw + sa), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sa)]
        a = [(A + 1) - (A - 1) * cw + sa, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sa]
    b, a = np.array(b) / a[0], np.array(a) / a[0]
    return b, a

def filt(x, kind, f0, q=0.707, g=0.0):
    b, a = biquad(kind, f0, q, g); return signal.lfilter(b, a, x, axis=0)

def sweep(x, kind, ffun, q=0.707, block=256):
    y = np.zeros_like(x); zi = np.zeros(2) if x.ndim == 1 else np.zeros((2, x.shape[1]))
    for s in range(0, len(x), block):
        b, a = biquad(kind, ffun(s / SR), q)
        if x.ndim == 1: y[s:s + block], zi = signal.lfilter(b, a, x[s:s + block], zi=zi)
        else:
            out = np.zeros_like(x[s:s + block])
            for c in range(x.shape[1]):
                out[:, c], zi[:, c] = signal.lfilter(b, a, x[s:s + block, c], zi=zi[:, c])
            y[s:s + block] = out
    return y

def polyblep(ph, dt):
    out = np.zeros_like(ph)
    m = ph < dt; t = ph[m] / (dt[m] if np.ndim(dt) else dt); out[m] = t + t - t * t - 1
    m2 = ph > 1 - dt; t = (ph[m2] - 1) / (dt[m2] if np.ndim(dt) else dt); out[m2] = t * t + t + t + 1
    return out

def saw(f, n, ph0=None):
    ph0 = rng.random() if ph0 is None else ph0
    dt = np.broadcast_to(np.asarray(f, float) / SR, (n,))
    ph = (ph0 + np.cumsum(dt)) % 1.0
    return 2 * ph - 1 - polyblep(ph, dt)

def sine(f, n, ph0=0.0):
    dt = np.broadcast_to(np.asarray(f, float) / SR, (n,))
    return np.sin(2 * np.pi * (ph0 + np.cumsum(dt)))

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR
def adsr(n, a=0.01, d=0.1, s=0.7, r=0.2):
    e = np.ones(n) * s; A, D, R = int(a * SR), int(d * SR), int(r * SR)
    A = min(A, n); e[:A] = np.linspace(0, 1, A, endpoint=False)
    D2 = min(D, max(0, n - A)); e[A:A + D2] = np.linspace(1, s, D2, endpoint=False)
    R = min(R, n); e[n - R:] *= np.linspace(1, 0, R)
    return e

def make_ir(dur=2.4, pre=0.02, damp=6000, decay=2.8, seed=3):
    r = np.random.default_rng(seed); n = int(dur * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal((n, 2)) * np.exp(-t * decay)[:, None]
    ir = filt(ir, 'lp', damp); ir = filt(ir, 'hp', 180)
    ir = np.concatenate([np.zeros((int(pre * SR), 2)), ir]); ir /= np.sqrt((ir ** 2).sum(0)).max()
    return ir

IR_HALL = make_ir(2.6, 0.03, 5500, 2.4, 3)
IR_ROOM = make_ir(0.9, 0.008, 7000, 7.0, 5)
def reverb(x, ir, wet):
    if x.ndim == 1: x = np.stack([x, x], 1)
    y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)
    return x * (1 - wet * 0.3) + y * wet

def env_follow(x, att=0.005, rel=0.12):
    a = np.abs(x) if x.ndim == 1 else np.abs(x).max(1)
    # one-pole smoothing (peak-ish): fast attack via max of two filters
    ka = np.exp(-1 / (att * SR)); kr = np.exp(-1 / (rel * SR))
    y = signal.lfilter([1 - kr], [1, -kr], a)
    y2 = signal.lfilter([1 - ka], [1, -ka], a)
    return np.maximum(y, y2)

def compress(x, thr_db=-18, ratio=3.0, att=0.004, rel=0.12, makeup_db=0.0):
    e = env_follow(x, att, rel) + 1e-9
    lvl = 20 * np.log10(e)
    over = np.maximum(0, lvl - thr_db)
    gr = -over * (1 - 1 / ratio)
    g = 10 ** ((gr + makeup_db) / 20)
    return x * (g[:, None] if x.ndim == 2 else g)

# ---------------- sound design ----------------
def kick(level=1.0, tail=0.42):
    t = tt(tail); f = 46 + 120 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    click = filt(rng.standard_normal(len(t)) * np.exp(-t * 400), 'hp', 2500) * 0.35
    return (np.tanh(body * 1.6) * 0.9 + click) * level

def clap(level=1.0):
    t = tt(0.32); n = rng.standard_normal(len(t))
    e = np.zeros(len(t))
    for k, d in enumerate([0, .011, .022]):
        i = int(d * SR); e[i:] += np.exp(-(t[:len(t) - i]) * 140) * (1 - .2 * k)
    e += np.exp(-np.maximum(0, t - .03) * 18) * .5 * (t > .03)
    x = filt(n * e, 'bp', 1500, 0.9) * 2.2
    return x * level

def hat(level=1.0, open_=False):
    t = tt(0.35 if open_ else 0.08); n = rng.standard_normal(len(t))
    x = filt(filt(n, 'hp', 7200), 'pk', 10000, 1.2, 4) * np.exp(-t * (11 if open_ else 70))
    return x * level

def crash(level=1.0, dur=2.6):
    t = tt(dur); n = rng.standard_normal((len(t), 2))
    x = filt(n, 'hp', 3800) * np.exp(-t * 1.5)[:, None]
    x += filt(n, 'bp', 6500, 2) * np.exp(-t * 3)[:, None] * .6
    return x * level * .55

def impact(level=1.0):
    t = tt(2.4); f = 62 * np.exp(-t * 0.55) + 26
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.9)
    nz = filt(rng.standard_normal(len(t)), 'lp', 900) * np.exp(-t * 6) * .6
    hit = np.tanh((sub * 1.4 + nz) * 1.3)
    x = np.stack([hit, hit], 1) + crash(.55, 2.4)
    return reverb(x, IR_HALL, .35) * level

def riser(dur=2.0, level=1.0, f0=300, f1=9000):
    n = int(dur * SR); t = np.arange(n) / SR; p = t / dur
    nz = rng.standard_normal(n)
    x = sweep(nz, 'bp', lambda s: f0 * (f1 / f0) ** min(1, s / dur), q=2.2) * (p ** 2.2) * 1.4
    tone = sine(220 * 2 ** (p * 2.5), n) * (p ** 3) * .18
    y = np.stack([x + tone, x * .9 + tone], 1)
    return reverb(y, IR_HALL, .25) * level

def rev_cymbal(dur=1.4, level=1.0):
    c = crash(1, dur)[::-1]; return c * level

def whoosh(dur=0.45, level=1.0, up=True):
    n = int(dur * SR); t = np.arange(n) / SR; p = t / dur
    nz = rng.standard_normal(n)
    f = (lambda s: 400 * 18 ** (s / dur)) if up else (lambda s: 7200 / 18 ** (s / dur))
    x = sweep(nz, 'bp', f, q=1.4) * np.sin(np.pi * p) ** 1.5
    pan = np.linspace(-.7, .7, n)
    y = np.stack([x * np.cos((pan + 1) * np.pi / 4), x * np.sin((pan + 1) * np.pi / 4)], 1) * 1.6
    return y * level

def blip(f=880, dur=0.09, level=1.0, f2=None):
    t = tt(dur); fr = f if f2 is None else np.linspace(f, f2, len(t))
    x = sine(fr, len(t)) * np.exp(-t * 38) * (1 - np.exp(-t * 900))
    return x * level

def tick(level=1.0):
    t = tt(0.03); x = filt(rng.standard_normal(len(t)), 'bp', 2600, 3) * np.exp(-t * 260)
    return x * level

def ding(level=1.0):
    t = tt(1.0)
    x = (sine(1318.5, len(t)) * .7 + sine(1975.5, len(t)) * .35 + sine(2637, len(t)) * .12) * np.exp(-t * 5.5) * (1 - np.exp(-t * 700))
    return reverb(x, IR_ROOM, .2) * level

def pluck(m, dur=0.35, level=1.0, bright=4000):
    t = tt(dur); f = mtof(m)
    x = saw(f, len(t)) * .6 + saw(f * 1.004, len(t)) * .4
    x = sweep(x, 'lp', lambda s: 300 + bright * np.exp(-s * 18), q=1.1)
    return x * np.exp(-t * 7) * (1 - np.exp(-t * 600)) * level

def ring_tone(dur_on=(0.4, 0.4), gap=0.2, level=1.0):
    seg = []
    for k, d in enumerate(dur_on):
        t = tt(d); x = (sine(440, len(t)) + sine(480, len(t))) * .5
        e = np.minimum(1, np.minimum(t / .012, (d - t) / .015)); seg.append(x * e)
        if k < len(dur_on) - 1: seg.append(np.zeros(int(gap * SR)))
    x = np.concatenate(seg)
    x = filt(filt(x, 'hp', 300), 'lp', 3400)
    x = np.tanh(x * 1.4) * .8
    return reverb(x, IR_ROOM, .35) * level

def clink(level=1.0):
    t = tt(0.7); parts = rng.uniform(2200, 2600) * np.array([1, 1.62, 2.41, 3.37])
    x = sum(sine(f, len(t), rng.random()) * a * np.exp(-t * d) for f, a, d in zip(parts, [1, .6, .4, .25], [9, 13, 18, 26]))
    return x * (1 - np.exp(-t * 3000)) * level

def sizzle(dur, level=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    nz = filt(filt(rng.standard_normal(n), 'hp', 2500), 'lp', 9000)
    crack = (rng.random(n) < 0.0016).astype(float); crack = filt(crack, 'bp', 4000, 1.5) * 6
    env = np.minimum(1, t / .25) * np.minimum(1, (dur - t) / .4)
    return (nz * .3 + crack) * env * level


# ---------------- music helpers (need globals: BEAT, CH, chord_at, bass, pads, arps) ----------------
def stamp_sfx(level=1.0):
    t = tt(0.6); f = 62 + 110 * np.exp(-t * 38)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)
    nz = filt(rng.standard_normal(len(t)), 'lp', 1500) * np.exp(-t * 40) * .9
    x = np.tanh((thump * 1.4 + nz) * 1.5) * .9
    return reverb(x, IR_ROOM, .3) * level

def pingpong(buf, k_n=3, fb=.38):
    d = int(BEAT * 0.75 * SR); out = buf.copy()
    for k in range(1, k_n + 1):
        sh = np.zeros_like(buf); sh[d * k:] = buf[:-d * k] * (fb ** k)
        if k % 2: sh = sh[:, ::-1]
        out += sh
    return out

def supersaw_chord(notes, dur, level=1.0, cutoff=1800, voices=5, detune=0.12):
    n = int(dur * SR); out = np.zeros((n, 2))
    for m in notes:
        for v in range(voices):
            d_ = (v - (voices - 1) / 2) / ((voices - 1) / 2) * detune
            x = saw(mtof(m + d_), n); pan = (v / (voices - 1)) * 2 - 1
            out[:, 0] += x * np.cos((pan + 1) * np.pi / 4); out[:, 1] += x * np.sin((pan + 1) * np.pi / 4)
    out = filt(out, 'lp', cutoff, 0.8)
    return out / (len(notes) * voices) * 3.2 * level

def bass_note(r, n_s, lp=520, dec=4.0):
    n = int(n_s * SR) - 200; t = np.arange(n) / SR; f = mtof(r)
    x = saw(f, n) * .5 + np.sign(sine(f / 2, n)) * .25 + sine(f / 2, n) * .6
    return filt(x, 'lp', lp, 1.0) * np.minimum(1, t / .004) * np.exp(-t * dec)

def drone(t0, t1, m, level, buf=None):
    n = int((t1 - t0) * SR); t = np.arange(n) / SR
    x = sine(mtof(m), n) * np.minimum(1, t / 1.0) * np.minimum(1, (t1 - t0 - t) / 1.0)
    place(bass if buf is None else buf, x * level, t0)

def pad_section(t0, t1, cutoff, level, pump=False, step=2.0, buf=None):
    t = t0
    while t < t1 - 1e-6:
        d_ = min(step, t1 - t); ch = chord_at(t + .01)
        x = supersaw_chord(CH[ch], d_ + .4, level, cutoff)
        n = len(x); tt_ = np.arange(n) / SR
        e = np.minimum(1, tt_ / .08) * np.minimum(1, (d_ + .4 - tt_) / .4)
        if pump:
            ph = ((t + tt_) % BEAT) / BEAT
            e *= 0.35 + 0.65 * np.minimum(1, ph / .45)
        place(pads if buf is None else buf, x * e[:, None], t)
        t += d_

def arp_section(t0, t1, level, bright=3200, rate=4, buf=None):
    for b in np.arange(t0, t1, BEAT / rate):
        ch = chord_at(b + .01); tones = CH[ch] + [m + 12 for m in CH[ch]]
        k = int(round((b - t0) / (BEAT / rate)))
        m = tones[[0, 1, 2, 3, 4, 3, 2, 1][k % 8]] + 12
        place(arps if buf is None else buf, pluck(m, .3, level, bright), b, pan=(.35 if k % 2 else -.35))
