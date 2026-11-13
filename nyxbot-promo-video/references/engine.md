# 画面引擎：film.html

`film.html` 是一个独立的网页，不依赖网络。它对外只暴露两个接口：
- `window.readyPromise`：字体和图片都加载完才 resolve。
- `window.seek(t)`：把画面设置成第 t 秒的样子。

画面是**纯函数**：同一个 t 永远出同一帧。没有 CSS 动画，也没有计时器。所以逐帧截图就能得到完全确定的视频。

## 结构
```
<div id="stage">            1920×1080
  #glow  #lines             背景
  .scene#s0 … #s7           每个场景一个 div，seek 里按时间切换 display
  #tag  #flash  #fade       常驻标签、闪白、黑场渐变
</div>
<div id="nyxSrc" hidden>    NyxID 标志的 svg（必须放在 <script> 之前）
<script> … </script>
```

## 工具函数（已写在脚本开头）
| 函数 | 作用 |
|---|---|
| `P(t,a,b)` | 把 t 线性映射到 0..1 并截断 |
| `eo` `eo5` `eio` `bo` | 缓动：ease-out 三次方、ease-out 五次方、ease-in-out、back-out 回弹 |
| `st(el,{x,y,s,r,o,b})` | 设置位移、缩放、旋转、透明度、模糊；o≈0 时自动 visibility:hidden |
| `pop(t,tin,tout,{d,dy,dx,ds,db,ease,od})` | 标准入场和退场：tin 开始入场（时长 d），tout 开始退场（时长 od）。返回对象交给 `st` |
| `outMul(o,q)` | 场景整体退场时，把元素自身的状态乘上退场系数 |
| `scene(id,t,a,b)` | t 在 [a,b] 之间时显示这个场景，返回 true |
| `txt(el,v)` | 内容变了才写 textContent |
| `kf(K,t)` | 关键帧插值，用于背景光晕和线条 |

典型写法：
```js
function s4(t) {
  if (!scene('s4', t, ...T.s4)) return;
  const out = eio(P(t, M.BUILD - .3, M.BUILD));            // 场景整体退场
  st($('#t4a'), outMul(pop(t, M.SITE, 1e9, { dy: 0, ds: -.3, db: 16, d: .3, ease: eo5 }), out));  // 大字砸下
  st($('#t4b'), outMul(pop(t, 33.5, 1e9, { dy: 0, ds: -.4, db: 16, d: .3, ease: eo5 }), out));
}
```

## 时间
- 用 `M = {…}` 定义标记点：DROP、CALL、HANG、SITE、BUILD、NEXT、FINAL、ENDHIT、END 等。
- `T = {s0:[a,b], …}` 定义每个场景的显示区间，前后各多留 0.05 秒做交叉淡化。
- **所有时间要和 `timeline.json` 的 `markers` 和 `vo` 一致。** 大字的入场时间等于配音里那个词说出的时间。
- 整段要往后平移时（比如开头加长了 10.8 秒），不用改每个数字。参考案例的做法是：后段场景函数收到 `t - OFF`，`seek` 里 `late = t >= 新CALL` 时就切到旧时间轴（见 `assets/examples/forest-media-v5/film.html` 里的 `OFF`、`NM`、`NT`）。

## 常用组件（参考案例里都有，复制改字即可）
| 组件 | 说明 |
|---|---|
| 照片墙 `#phs .ph` | 8 张，位置和角度写在 `PHPOS`，每 0.25 秒弹出一张 |
| 三人流程 `.node` 加虚线箭头 | 客户 → 中间人 → 老板；金币 `.coin` 沿抛物线飞回中间人 |
| 利润条 `#ord #slice` | 绿条被红色斜纹切走一块 |
| 通讯录卡 `#saved .ctr` | 逐行出现，最后一行抖一下 |
| 来电手机 `#cph` | 状态、通话计时、28 根声波柱（按说话人变色）、挂断键 |
| 转写 `#tr .tln` | 说话人标签；英文逐词出现（`.w`）；说完后中文小字（`.zh`）淡入；上一句变暗 |
| 中文卡片 `#sum .srow` | 逐行滑入，"等您一句"后面跟三个红色标签 |
| 语音气泡 `.bub.boss` 加 `.wave` | 说话时声波跳动；AI 回复气泡 `.bub.ai` |
| 浏览器 `#brw #site` | 网址逐字打出 → 导航 → 标题逐字出现 → 作品卡回弹 → 高亮 |
| 预告 | "下一步"加大字加"即将开通"标签，周围飘几个淡色英文消息气泡 |
| 结尾 | 标志 → 口号两行 → 三个标签依次弹出 → 页脚免责声明 |

## 自查
- `python3 scripts/shot.py film.html shots 1.5 5 9 …`：截图时会打印页面报错。
- 改了以后**重新截同一时间点**确认。只改了中间一段就局部重渲染时，要抽查边界帧有没有旧画面。最省事的办法是 `render_all.py` 全部重渲。
