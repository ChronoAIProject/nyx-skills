# 配乐与音效：timeline.json

`scripts/make_bed.py timeline.json out.wav` 全部用代码合成：没有采样，没有版权问题。
风格是 120 BPM 的电子流行。它读的就是配音稿用的那份 `timeline.json`，所以台词、音乐压低和画面用同一套时间。

## 格式
```json
{
 "title": "客户 × NyxBot 宣传片 v1",
 "duration": 62.3, "bpm": 120, "fps": 30, "seed": 78,
 "vo_direction": "可选：写在配音稿开头的整体语气说明",
 "markers": {"DROP": 22.0, "CALL": 25.0, "...": 0},
 "vo": [ {"id": "01", "start": 0.4, "end": 3.4, "text": "这些招牌，都是您的得意之作。", "note": "带着骄傲"} ],
 "music": {
  "chords": [[0, "C"], [3.6, "Am9"], {"loop": ["Am","F","C","G"], "start": 22.0, "end": 42.6, "every": 2.0}],
  "sections": [ {"start": 0, "end": 3.6, "mode": "groove"}, {"start": 3.6, "end": 18.4, "mode": "tension"} ],
  "hits": [ {"t": 22.0, "kind": "drop", "lead": 1.8}, {"t": 18.6, "kind": "hit"}, {"t": 60.8, "kind": "end", "chord": "C"} ],
  "rolls": [[20.8, 22.0, 0.12, 0.5]]
 },
 "sfx": [ {"t": 0.1, "kind": "blip", "f": 880, "f2": 1100, "level": 0.12, "repeat": 8, "every": 0.25, "step_f": 60, "pan": 0.35, "alt_pan": true} ]
}
```

### chords（和弦）
- 两种写法：`[时间, 和弦]` 表示从这一刻换和弦；`{"loop": […], "start", "end", "every"}` 表示循环进行。
- 可用的和弦：Am F C G Dm Em Am9 Fmaj7 Cmaj7 E Gsus Dsus。
- 常用安排：
  - 痛点段用 Am9 / Fmaj7（暗）；
  - 情绪最低点用 E（悬）；
  - 高潮后用 Am-F-C-G 或 C-G-Am-F（亮）；
  - 收尾停在 C。

### sections（段落）
| mode | 听感 | 用在 |
|---|---|---|
| `groove` | 四拍底鼓、拍手、踩镲、八分音符贝斯、泵感铺底、亮琶音 | 开头照片墙、高潮之后、结尾 |
| `tension` | 半速轻底鼓、滴答、低音长音、暗铺底、暗琶音 | 痛点段，配音密集的地方 |
| `quiet` | 只有铺底和长音 | 情绪最低点（"太憋屈了！"）之后的 1–2 秒 |
| `break` | 稀疏底鼓、铺底、琶音 | 预告段 |
| `build` | 底鼓、踩镲、贝斯逐渐加强 | 高潮前 1–2 秒 |

可选参数：`pad_cutoff`、`pad_level`、`pad_step`（铺底多久换一次，最好等于换和弦的间隔）、`arp`（布尔值）、`arp_level`、`arp_bright`、`open_hat`、`drone`。

### hits（重音）
| kind | 效果 | 用在 |
|---|---|---|
| `drop` | 往前 `lead` 秒加上升音效和反向镲，到点打重音和镲 | 画面闪白的高潮 |
| `hit` | 重音加轻镲 | 情绪落点 |
| `end` | 重音、镲，加一个慢慢衰减的结尾长和弦 | 结尾 |

`rolls` 是高潮前的拍手连击：[开始, 结束, 起始音量, 结束音量]。

### sfx（音效，跟着画面动作走）
| kind | 声音 | 配什么画面 |
|---|---|---|
| `blip` | 提示音，f→f2 滑音 | 弹出、出现 |
| `tick` | 滴答 | 列表逐行出现 |
| `ding` | 叮 | 完成、上线 |
| `clink` | 硬币声 | 介绍费金币 |
| `stamp` | 盖章 | 大字点题 |
| `impact` | 重击 | 强调 |
| `whoosh_up` / `whoosh_down` | 风声 | 转场 |
| `ring` | 电话铃 | 来电 |
| `hangup` | 两声挂断音 | 挂断 |
| `typing` | 一串滴答，需要 `end` | 网站搭建、打字 |

通用参数：`level`、`repeat`、`every`、`step_f`（每次重复升高的频率）、`pan`、`alt_pan`（左右交替）、`dur`。

## 混音规则（make_bed.py 自动完成）
- 每个 `vo` 时段前 0.25 秒开始压低，后 0.4 秒恢复。音乐压低 7 dB，音效压低 3 dB，提示音跟着音乐一起压。
- 提示音比音乐低约 4 dB，重音和音乐差不多响。
- 渐入 0.02 秒，渐出 0.8 秒。
- `master.py in.wav out.wav -18`：做到 −18 LUFS、真峰值 ≤ −1.8 dBTP。这是给用户自己叠配音用的"配乐音效"轨。
- 成片加上人声后，做到 −14 LUFS。

## 叠配音（收到用户的配音文件后）
```bash
# 01.wav…NN.wav，开始时间取自 timeline.json；adelay 的单位是毫秒
ffmpeg -i bed.wav -i 01.wav -i 02.wav … -filter_complex \
 "[1]adelay=400|400[a1];[2]adelay=3800|3800[a2];…;[0][a1][a2]…amix=inputs=N+1:normalize=0[m]" -map "[m]" mix.wav
python3 scripts/master.py mix.wav final.wav -14
```
配音比时段长时，有三种处理办法：
1. 把后面的时段整体后移，画面同步平移；
2. 用 `atempo=1.05~1.1` 轻微加速；
3. 请用户换短一点的说法。

不要硬切。
