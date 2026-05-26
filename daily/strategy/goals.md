# Chrono AI 目标体系 / Goal Framework

> 北极星 + 里程碑链 / North Star + Milestone Chain
> 下次回顾 / Next review: 2026-05-01
> 看板 / Project Board: [Chrono AI 目标与路线图](https://github.com/orgs/ChronoAIProject/projects/3)

## 公司级北极星 / Company North Star

**Chrono AI 2026 Q2: NyxID 获得第一批外部用户 (≥10 周活)**
**Chrono AI 2026 Q2: Get NyxID's first external users (≥10 weekly active)**

整个公司这个季度追这一件事. 其他产品线支撑或暂停.
The entire company focuses on this one goal this quarter. All other product lines either support it or pause.

所有产品线的终极方向: 让 AI 做所有执行，人只做创造性工作（详见 [culture.md 愿景](culture.md#愿景--vision)）。
Ultimate direction for all product lines: let AI do all execution, humans do only creative work (see [culture.md Vision](culture.md#愿景--vision)).

## 指标口径 / Metric Definition

| 术语 / Term | 定义 / Definition |
| --- | --- |
| 外部用户 / External user | 非 Chrono AI 组织成员 (非 aevatarAI / ChronoAIProject / the-omega-institute org member) / Not a member of any Chrono AI GitHub org |
| 外部用户识别 / External user identification | 通过邀请码注册区分 / Identified via invite code registration (resolves: proxy logs 不含 GitHub org membership) |
| 触达 / Reach | 滚动 7 天内有 ≥1 次成功的 API 请求通过 NyxID proxy (HTTP 2xx) / ≥1 successful API request through NyxID proxy in a rolling 7-day window |
| 激活 / Activated | ≥2 次不同 session 的请求，滚动 7 天内 / ≥2 requests from different sessions in a rolling 7-day window (暂定，待 M0 数据验证 / provisional, pending M0 data validation) |
| 留存信号 / Retention signal | 连续 2 周有 proxy 请求 / Proxy requests in 2 consecutive weeks |
| 数据来源 / Data source | NyxID proxy access log + 邀请码注册系统 / invite code registration system |

## 用户漏斗 / User Funnel

```
  看到 NyxID (曝光)          ← Ada outreach, community posts
  See NyxID (awareness)
         │
         ▼
  点击了解 (兴趣)            ← GitHub README, landing page
  Click to learn (interest)
         │
         ▼
  注册托管实例 (获取)         ← nyx.chrono-ai.fun 注册 + 邀请码
  Register on hosted instance (acquisition)
         │
         ▼
  首次 proxy 成功 (激活前)    ← quickstart tutorial (托管版)
  First proxy success (pre-activation)
         │
         ▼
  触达 / Reach               ← M0 milestone uses this
  (≥1 次 2xx, 7 天内)
         │
         ▼
  激活 / Activated           ← M1/M2 milestone uses this
  (≥2 不同 session, 7 天内)
         │
         ▼
  留存 / Retention           ← 产品价值验证
  (连续 2 周有请求)
```

## 产品线处置 / Product Line Disposition

### 状态定义 / Status Definitions

| 状态 / Status | 含义 / Meaning |
| --- | --- |
| **ACTIVE** | 全力投入, 有明确里程碑和 deadline, 占用核心执行资源 / Full commitment with milestones, deadlines, and dedicated resources |
| **INCUBATING** | 低投入保持活跃, 有 owner 和方向性里程碑, 不占用核心执行资源 / Low investment, active owner, directional milestones, no core resource allocation |
| **EXPLORING** | 低投入探索验证, 有 owner, 验证方向性假设, 不设硬性 deadline / Low investment exploration, owner validates directional hypotheses, no hard deadlines |
| **PARKED** | 零投入等待触发, 有 owner 监控触发条件, 不做开发 / Zero investment, owner monitors trigger conditions, no development |
| **KILLED** | 终止, 不再投入 / Terminated, no further investment |

### 当前状态 / Current Status

| 产品 / Product | 处置 / Status | 北极星指标 / North Star Metric | 当前值 / Current | Owner | 活跃开发者 / Active Devs |
| --- | --- | --- | --- | --- | --- |
| NyxID | **ACTIVE** | 外部周活用户数 / External weekly active users | 1 | kaiweijw | kaiweijw |
| Aevatar | **ACTIVE** | 测试网就绪 / Testnet readiness | 测试网运行中 / Testnet live | eanzhao | eanzhao, potter-sun, louis4li, Auric |
| Ornn | **INCUBATING** | Skill 被外部 agent 调用次数 / External agent skill invocations | 0 | chronoai-shining | chronoai-shining |
| Automath | **INCUBATING** | 机器验证定理数 / Machine-verified theorems | 2350+ | loning | Auric, AlyciaBHZ |
| Symphony | **PARKED** | GitHub Issues 集成完成度 / GH Issues integration | 已打通 / Connected | kaiweijw | — |
| Vibe Apps | **PARKED** | Aevatar DX 验证 / Aevatar DX validation | 暂停 / Paused | ctkm-aelf | — |
| Sisyphus | **INCUBATING** | Discovery Registry entries | 0 | Auric (loning) | chronoai-shining |
| GodGPT | **PARKED** | — | 维护中 / Maintenance | — | jason-aelf (偶尔热修复 / occasional hotfix) |

## 里程碑链 / Milestone Chain

### NyxID (ACTIVE)

看板 / Board: [Chrono AI 目标与路线图](https://github.com/orgs/ChronoAIProject/projects/3) — Target 字段 M0/M1/M2

| 里程碑 / Milestone | 目标 / Target | 当前 / Current | 阻塞 / Blocker | Deadline | 解锁 / Unlocks |
| --- | --- | --- | --- | --- | --- |
| M0 — 首个外部用户 / First external user | 1 | 1 ✅ (04-16 达成) | N/A (已达成) | **04-18** | 产品验证 / Product validation (使用 reach 定义 / uses reach definition) |

**M0 路径: 托管优先 / Hosted-first approach (Auric 决策 2026-04-13)**
- M0 使用托管实例 https://nyx.chrono-ai.fun/, 外部用户直接注册使用, 不需要自部署
- M0 uses the hosted instance; external users register and use directly, no self-deployment required
- 私有部署 (Docker quickstart) 推迟到 M1+ / Private deployment (Docker quickstart) deferred to M1+
- Quickstart bugs (#277-283) 均为私有部署问题, 不阻塞 M0 / All are self-deploy issues, not M0 blockers
| M1 — 10 周活用户 / 10 weekly active users | 10 | 0 | 见看板 label:blocker + target:M1 / See board | **05-08** | Show HN 发布 / Show HN launch (使用 activated 定义 / uses activated definition) |
| M2 — 50 周活用户 / 50 weekly active users | 50 | 0 | 见看板 label:blocker + target:M2 / See board | **06-15** | Aevatar Phase 2 启动 / Aevatar Phase 2 start (使用 activated 定义 / uses activated definition) |

### M1 Checkpoint 决策规则 / M1 Checkpoint Decision Rules

04-25 前置指标 (outreach 启动一周后):
- outreach 联系人 <20 或回复 <3 → 升级 outreach 资源
- NyxID 注册用户数 <5 → 诊断注册/onboarding 流程 (托管实例)
- NyxID registration <5 → diagnose registration/onboarding flow (hosted instance)

05-08 M1 合流双重 gate:

| Gate | 条件 / Condition | 判定 / Measured by |
| --- | --- | --- |
| Track 1 (增长) | NyxID ≥10 activated users | NyxID proxy log (排除团队 IP) |
| Track 2 (平台) | Ornn-NyxID 集成端到端可用 + #102 平台 NyxID 账号就绪 | Ean + Shining 确认 |

| Track 1 | Track 2 | 决策 / Decision |
| --- | --- | --- |
| Ready | Ready | 合流 → 平台推广 (NyxID 是入口) |
| Ready | Not Ready | Track 1 继续独立推广, Track 2 延长两周 |
| Not Ready | Ready | 诊断增长问题, Track 2 待命 |
| Not Ready | Not Ready | 两轨都延长, 诊断各自瓶颈 |

TIA (#41) 重新评估: M1 (05-08)，根据 Kaiwei 带宽和 NyxID connector 成熟度判断 go/no-go。
TIA (#41) re-evaluation: at M1 (05-08), based on Kaiwei bandwidth and NyxID connector maturity.

### 职责矩阵 / Responsibility Matrix

| 数据 / Data | Source of Truth | 维护者 / Maintainer |
| --- | --- | --- |
| 产品线处置 / Product disposition | goals.md | Auric |
| 处置触发条件 / Disposition triggers | goals.md | Auric |
| 北极星定义 + 指标口径 / North star + metrics | goals.md | Auric |
| Milestone deadline | goals.md | Auric |
| 具体 issue 状态 / Issue status | 看板 / Board | 团队 / Team |
| Issue 里程碑归属 / Issue milestone | 看板 Target 字段 / Board Target field | 团队 / Team |
| 阻塞标记 / Blocker flag | 看板 blocker label / Board blocker label | Auric + 团队 / Team |
| Assignee | 看板 / Board | 团队 / Team |

### Ornn (INCUBATING)

看板 / Board: 无独立看板, issue 在 ChronoAIProject/Ornn repo 管理。
Auric 于 2026-04-09 调整: ACTIVE→INCUBATING。Shining 精力以 Ornn-NyxID 集成为主，不独立推广。
Auric adjusted on 2026-04-09: ACTIVE→INCUBATING. Shining focuses on Ornn-NyxID integration, not standalone promotion.

| 里程碑 / Milestone | 说明 / Description | Owner |
| --- | --- | --- |
| O0 — 公司官网上线 / Company site launch | Ornn 品牌页上线公司官网 / Ornn brand page live on company site | Auric |
| O1 — Skill-Only API 可用 / Skill-Only API ready | 外部 agent 可直接调用 Ornn skills / External agents can invoke Ornn skills directly | chronoai-shining |

### Automath (INCUBATING)

看板 / Board: 无看板, 研究产出以 commit 和论文为主。

| 里程碑 / Milestone | 说明 / Description | Owner |
| --- | --- | --- |
| I0 — 持续研究产出 / Ongoing research output | 保持定理发现节奏, 不设硬 deadline / Maintain theorem discovery pace, no hard deadline | loning |

- 激活条件 / Activation: Sisyphus v2 就绪 + Aevatar Phase 2 启动 / Sisyphus v2 ready + Aevatar Phase 2 starts

### Aevatar (ACTIVE)

测试网已上线 / Testnet live: https://aevatar-console.aevatar.ai/
开发集中在主仓库 / Development in monorepo: aevatarAI/aevatar
活跃开发者 / Active devs: eanzhao, potter-sun, louis4li, Auric

| 里程碑 / Milestone | 说明 / Description | Deadline | Owner |
| --- | --- | --- | --- |
| A0 — 测试网稳定 / Testnet stable | Console + Studio + Workflow 可用 / Console, Studio, Workflow functional | **04-18** | eanzhao |
| Day One — 对外内测 / External beta | 飞书 bot → 对话创建 agent → 持久运行, 3 个模板 (每日更新/社交媒体/竞品监控) / Lark bot conversational agent creation, 3 templates | **04-25** | eanzhao |
| A1 — Phase 2 启动 / Phase 2 start | 扩展平台能力, 提前 M2 两周就绪 / Expand platform capabilities, ready 2 weeks before M2 | **04-30** | eanzhao |

Day One 成功标准: ≥5 agent 运行超 48h, ≥3 用户无人工指导完成创建, **≥1 agent 通过 NyxID proxy 发出 2xx 请求** (端到端健康检查: agent 不只是活着，还在通过 NyxID 做有用的事)。设计文档: `docs/superpowers/specs/2026-04-13-aevatar-day-one-design.md`
Day One 用户通过 NyxID 授权服务 → 天然成为 NyxID 用户 → 直接贡献 M1 指标。
Aevatar 是平台基础设施, NyxID 是 Q2 增长焦点, Day One 是两者合流点。
看板 / Board: [Aevatar Framework](https://github.com/orgs/aevatarAI/projects/23) — 具体 issue deadline 在此看板 End date 字段管理。
公司看板 (ChronoAIProject #3) 只跟踪 NyxID M-series, 不重复 Aevatar milestones。

#### Team Intelligence Agent (Dogfooding, ADR-009)

跨产品线计划: 用 Aevatar agent + NyxID connector + Ornn skill 构建内部团队信息智能层，替代全员周会。
Cross-product initiative: build internal team intelligence layer using Aevatar+NyxID+Ornn, replacing all-hands meetings.

| 里程碑 / Milestone | 说明 / Description | Owner | Gate |
| --- | --- | --- | --- |
| T-go — Go/No-Go 判断 | Ean+Kaiwei 30 分钟 micro-sync: Aevatar testnet 能否跑 ~20 agent + NyxID 能否连飞书 | Auric | 两个 yes → P0。任一 no → 退回 Approach C |
| T0 — Connectors (P0) | NyxID Lark connector (只读+推送) + GitHub connector | kaiweijw | 需评估与 NyxID M0-M2 的带宽冲突 |
| T1 — Daily Briefing (P1) | Aevatar agent per person + Ornn 信息综合 skill | eanzhao + chronoai-shining | ≥80% 团队满意度 → T2 |
| T1.5 — 群聊 @agent (ADR-011) | GroupRouter Agent: 群聊 @bot 并发查询群内 User Agents, 汇总回复 | eanzhao | T1 完成后启动 |
| T2 — Micro-Sync (P2) | 跨线依赖检测 + micro-sync 推荐 | chronoai-shining | >50% micro-sync 被认为有价值 → T3 |

**资源风险 / Resource risk:** Kaiwei 同时负责 NyxID M0-M2。T-go 必须评估带宽冲突，NyxID 里程碑优先。
Note: Aevatar runs parallel to NyxID. NyxID is Q2 growth focus, Aevatar is platform infrastructure.

### Living with AI Demo (ACTIVE)

看板 / Board: [Chrono AI 目标与路线图](https://github.com/orgs/ChronoAIProject/projects/3) — Living with AI items 在公司看板, 无独立 Target 字段。
策略决策 / Strategy: [ADR-003](../decisions/003-living-with-ai-demo.md) (定位) + [ADR-019](../decisions/019-living-with-ai-staging-plan.md) (脱离验证 3-stage plan, 2026-04-21)

四层栈的集成层: 把 NyxID (连接) + Ornn (能力) + Aevatar (运行) 三层带进物理世界 (机器人、智能家居、摄像头、语音)。
Integration layer of the 4-layer stack: bringing NyxID + Ornn + Aevatar into the physical world.
详见 `products/living-with-ai/README.md`。
Full-stack demo: autonomous agent + smart home devices. Validates all three product lines.

**当前路线 (ADR-019, 2026-04-21 APPROVED):** 沿用 ADR-018 Voice Avatar staging pattern, 用 3 个 stage 推进, Stage 1-2 脱离 Aevatar 用 Python FastAPI + Home Assistant 验证 agent harness thesis, Stage 3 post-thesis port 进 Aevatar HouseholdEntity canon。原 D-prep~D3 单路线计划 superseded by ADR-019。视频录制目标暂缓到 Stage 2 完成后评估。

| 里程碑 / Stage | 说明 / Description | Deadline | Owner | Support |
| --- | --- | --- | --- | --- |
| Stage 1 — lights-first thesis validation | [living-with-ai-agent](https://github.com/ChronoAIProject/living-with-ai-agent) Python FastAPI + HA adapter, harness plan/approve/execute/verify 闭环, lights only | 待 kaihuei 定 | kaihuei | Auric review |
| Stage 2 — multi-device scale (standalone) | 扩展 cameras/sensors/audio, 验证 harness 在多设备并发下的 safety + approval + verification | 待 Stage 1 完成后 finalize | kaihuei | Auric |
| Stage 3 — Aevatar 集成 (post-thesis) | port 验证过的 harness spec 进 Aevatar HouseholdEntity + 14 proxy agents + Ornn skills + stream processing canon (ADR-006) | post-thesis, 待 Stage 2 完成后另开 design | eanzhao | kaihuei, Auric |

**Stage 1 Exit Criteria:** 端到端 (自然语言 → plan → approve → execute → HA state readback verify) 跑通 + 3 种 light scenario + 失败场景覆盖 + 26+ unit tests + Auric/kaihuei 共同签字。详见 ADR-019 § Stage 1 Exit Criteria。

Kaihuei 全职 owner, 保持 ACTIVE。Voice Presence 独立走 Voice Avatar (ADR-018 Kaihuei Go2 硬件线, voice-presence#6), 与本 staging plan 并行不交叉。
NyxID DevOps 由 Kaiwei 兼任, 不设独立岗位 / absorbed by Kaiwei.

### Symphony (PARKED)

看板 / Board: 无看板。
Auric 于 2026-04-09 调整: EXPLORING→PARKED。M1 前 Kaiwei 带宽全部给 NyxID。
Auric adjusted on 2026-04-09: EXPLORING→PARKED. Kaiwei's bandwidth fully allocated to NyxID before M1.
探索 OpenAI Symphony 概念 / Exploring OpenAI's Symphony concept
每个 agent 即一个"人"，做项目管理 / Each agent = a "person", project management
已与 GitHub Issues 打通 / Integrated with GitHub Issues
未来接入 Aevatar / Future integration with Aevatar
仓库 / Repo: ChronoAIProject/chronoai-symphony (Rust)
Owner: kaiweijw

### Vibe Apps (PARKED)

看板 / Board: 无看板。
Auric 于 2026-04-09 调整: EXPLORING→PARKED。Calvin 已实质全职 NyxID。
Auric adjusted on 2026-04-09: EXPLORING→PARKED. Calvin now fully dedicated to NyxID ecosystem.
验证 Aevatar 开发者体验 / Validating Aevatar developer experience
仓库 / Repos: vibe-soulgarden-expo, vibe-riteset-expo
Owner: ctkm-aelf

### Sisyphus (INCUBATING)

看板 / Board: 无独立看板, Axiom Reasoning issues 在 aevatarAI/aevatar-agent-framework repo。
Auric override 2026-04-05: Shining 在 Aevatar Framework 上持续做 Axiom Reasoning 平台化, 实际投入已超过 PARKED 定义。
Auric override 2026-04-05: Shining actively building Axiom Reasoning platform on Aevatar Framework, actual investment exceeds PARKED definition.

方向: 与 Automath 结合, 构建 Discovery Registry (discovery-first 模型)。详见 ADR-008。
Direction: Integrate with Automath to build Discovery Registry (discovery-first model). See ADR-008.

| 里程碑 / Milestone | 说明 / Description | Owner |
| --- | --- | --- |
| S0 — 接口契约定义 / Interface contract | Discovery report + direction hint schema 对齐 | Auric + chronoai-shining |
| S1 — Discovery Registry MVP | 闭环 POC: Automath 导出 discovery → Registry 存储 → Sisyphus 分类 | Auric + chronoai-shining |

- 激活条件 / Activation to ACTIVE: Discovery Registry MVP 跑通 + Auric 决定分配专职资源 / Discovery Registry MVP works + Auric allocates dedicated resources
- Owner: Auric (loning)

## 处置触发条件 / Disposition Triggers

| 产品 / Product | 当前 / Current | 变更条件 / Trigger |
| --- | --- | --- |
| Ornn | INCUBATING | Auric 调整 2026-04-09: Shining 精力以 NyxID-Ornn 集成为主。Ornn skills 通过 NyxID proxy 可调用 → 回到 ACTIVE |
| Aevatar | ACTIVE | 测试网已上线, 与 NyxID 并行推进 / Testnet live, runs parallel to NyxID |
| Symphony | PARKED | Auric 调整 2026-04-09: Kaiwei 带宽全给 NyxID。M2 后 Kaiwei 有余力 → 恢复 EXPLORING |
| Vibe Apps | PARKED | Auric 调整 2026-04-09: Calvin 全职 NyxID。M2 后如需 DX 验证 → 恢复 EXPLORING |
| Sisyphus | INCUBATING | Auric override 2026-04-05: Shining 持续做平台化。Discovery Registry MVP 跑通 + Auric 分配资源 → ACTIVE |
| Automath | INCUBATING | Sisyphus v2 就绪 / ready → ACTIVE |

## 更新协议 / Update Protocol

| 项目 / Item | 说明 / Description |
| --- | --- |
| 谁更新 / Who updates | Auric 手动 / Auric manually |
| 何时更新 / When | 里程碑达成时 + 每月 1 日回顾 / On milestone completion + monthly review on the 1st |
| 更新内容 / What | 北极星当前值, 里程碑阻塞 issue, 产品线处置变更 / North star values, blocker issues, disposition changes |
| /daily 角色 / /daily role | 只读不写: 语义解析本文件, 输出进度报告 / Read-only: parses this file, outputs progress report |
