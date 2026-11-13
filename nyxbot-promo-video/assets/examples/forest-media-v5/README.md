# 参考案例：Forest Media × NyxBot v5（62.3 秒，待配音）

- **客户：** Forest Media Pte. Ltd.，新加坡 Tampines 的招牌、灯箱、展览搭建公司。老板白老板（老白）中文很好，不会英文。
- **市场总监的评价：** "视频做得不错"。

## 文件
| 文件 | 内容 |
|---|---|
| `film.html` | 完整画面，可以直接用 `scripts/shot.py` 和 `scripts/render_all.py` 跑 |
| `timeline.json` | 16 句配音时段、配乐段落、重音、音效；`make_bed.py` 和 `make_vo_script.py` 都读它 |
| `img/` | 他朋友圈里的作品照片，已裁成正方形并放大锐化；只用于这位客户 |

一键复现：
```bash
cd scripts
python3 make_vo_script.py ../assets/examples/forest-media-v5/timeline.json ../out ForestMedia-v5
python3 make_bed.py ../assets/examples/forest-media-v5/timeline.json ../out/bed_raw.wav
python3 master.py ../out/bed_raw.wav ../out/bed.wav -18
python3 render_all.py ../assets/examples/forest-media-v5/film.html 62.3 ../out/bed.wav ../out/ForestMedia-v5-待配音.mp4
```

## 人物志 → 镜头
| 人物志 / 方案里的事实 | 变成了 |
|---|---|
| 朋友圈里的作品：炸鸡大狮、iSHANGHAI 圆灯箱、OTAKARAYA 发光字、印族文化馆四语标识、展位 | 0–3.6s 照片墙；"都是您的得意之作" |
| 英文客人从传单、Carousell、Facebook 来，经过兼职业务员，业务员拿介绍费 | 3.8–15s 三人流程、金币飞回、利润条被切走 |
| 英文客人手机里存的是业务员的号码 | 通讯录卡：Forest Media 那一行写"没存" |
| 原话「每个招牌都不一样」 | NyxBot: "Every sign is custom, so Boss Bai will price it himself." |
| 要他点头的事：价格、工艺、日期 | 中文卡片上的"等您一句：价格 / 做法 / 日期" |
| 线上找不到他（没有 Google、没有网站） | "客人上网，找不到您？" → 网站上放他自己的作品 |
| 不要说 AI、自动报价，不要承诺 WhatsApp | 全片没有这些词；预告只说"信息回复 · 即将开通" |
| 方案主标题「招牌您来做。英文交给它。」 | 结尾口号 |
| 试用三个月 · 不要钱 · 不签合同 | 结尾三个标签 |

## 配音稿
见 `timeline.json` 的 `vo` 字段（16 句），也可以运行 `make_vo_script.py` 导出 `.md` 和 `.srt`。
开头 5 句是市场总监亲自写的，原文一字未改，只拆成了 5 句：

> 这些招牌都是您的得意之作，但之前咱们接英文订单，总得绕一层业务员，每做一单都要被分走一笔利润，而且客户存的全是业务员的号码，忙活半天根本留不住属于自己的客源，太憋屈了！
