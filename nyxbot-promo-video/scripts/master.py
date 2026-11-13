import sys, wave, subprocess, json, numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d
SR = 48000
def read(fn):
    w = wave.open(fn); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768
    return x.reshape(-1, 2)
def write(fn, x):
    y = (np.clip(x, -1, 1) * 32767).astype(np.int16); w = wave.open(fn, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(y.tobytes()); w.close()
def limit(x, ceil_db=-1.8, look=0.005, rel=0.08):
    c = 10 ** (ceil_db / 20)
    # 4x oversampled peak estimate for inter-sample peaks
    up = signal.resample_poly(x, 4, 1, axis=0)
    pk = np.abs(up).max(1).reshape(-1, 4).max(1)[:len(x)]
    g = np.minimum(1, c / np.maximum(pk, 1e-9))
    L = int(look * SR)
    g = minimum_filter1d(g, size=2 * L + 1)
    # release smoothing (keep minima, recover slowly)
    k = np.exp(-1 / (rel * SR)); out = np.empty_like(g); cur = 1.0
    gg = g
    # vectorised approximation: one-pole on the gain, then take min with instantaneous requirement
    sm = signal.lfilter([1 - k], [1, -k], gg)
    out = np.minimum(gg, sm)
    out = signal.lfilter([1 - np.exp(-1 / (0.001 * SR))], [1, -np.exp(-1 / (0.001 * SR))], out)
    out = np.minimum(out, gg * 1.0 + 0.0)
    return x * out[:, None]
def measure(fn):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', fn, '-af', 'loudnorm=I=-14:TP=-1.5:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    j = json.loads(r[r.rindex('{'):r.rindex('}') + 1]); return float(j['input_i']), float(j['input_tp'])
src, dst = sys.argv[1], sys.argv[2]; TGT = float(sys.argv[3]) if len(sys.argv) > 3 else -14.0
x = read(src); g_db = 0.0
I, TP = measure(src)
for it in range(4):
    g_db += (TGT - I)
    y = limit(x * 10 ** (g_db / 20))
    write(dst, y); I, TP = measure(dst)
    print(f'iter {it}: gain {g_db:+.2f} dB -> I {I:.2f} LUFS, TP {TP:.2f} dBTP')
    if abs(I - TGT) < 0.3: break
