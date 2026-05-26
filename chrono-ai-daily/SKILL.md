---
name: chrono-ai-daily
description: ChronoAI daily
version: "0.1"
metadata:
  category: plain
---

---
name: daily
description: Use when anyone says "每日更新", "daily", or "check in". Auto-detects founder vs team member via GitHub username, shows company roadmap + role-appropriate view.
---

# Daily Check-in / 每日更新

Scan repos, check blockers, report delta. Auto-adapts output based on who's running it.

## Workflow

### 0. Role Detection

Detect who is running this skill:

```bash
CURRENT_USER=$(gh api user --jq '.login' 2>/dev/null || echo "unknown")
echo "Current user: $CURRENT_USER"
```

- If `CURRENT_USER` is `loning` → **founder mode**
- Otherwise → **Team mode**: read `team.yaml` via Read tool, look up CURRENT_USER in BOTH `members` and `non_engineering` sections.
  - If found → extract `name`, `products`, `repos`, `role` (if present)
  - If not found → show error: "你的 GitHub 用户名 '{CURRENT_USER}' 不在 team.yaml 中。请确认 `gh auth status` 显示的账号正确，或联系 Auric 添加。"
  - Set: USER_NAME, USER_PRODUCTS, USER_REPOS, USER_ROLE

**产品线名称映射:** nyxid=NyxID, aevatar=Aevatar, sisyphus=Sisyphus, ornn=Ornn, automath=Automath, symphony=Symphony, vibe-apps=Vibe Apps
**Disposition 来源:** goals.md "当前状态 / Current Status" 表
**触发条件来源:** goals.md "处置触发条件 / Disposition Triggers" 表的"变更条件"列
**products: [other] 或 products: [] 的处理:** 产品线状态显示"未纳入战略跟踪，联系 Auric 对齐"

### 1. Repo Scan

**founder mode:** scan ALL core repos (NyxID, Aevatar, Ornn, Automath, Sisyphus branch).

**Team mode:** only scan USER_REPOS from team.yaml. Special handling:
- If `sisyphus` is in USER_PRODUCTS, also scan `aevatarAI/aevatar` with `?sha=feature/sisyphus-v2`
- If USER_REPOS is empty (non-engineering with no repos yet), skip repo scan entirely

For each repo in scope, fetch via `gh api`:

```bash
# Per repo: commits + PR activity + open issues
gh api 'repos/{owner}/{repo}/commits?per_page=20' --jq '.[0:5] | .[] | "\(.sha[0:7]) \(.commit.author.date[0:10]) \(.commit.author.name): \(.commit.message | split("\n")[0])"'
gh api 'repos/{owner}/{repo}/pulls?state=all&per_page=30' --jq '.[] | select(.user.login == "'"$CURRENT_USER"'") | "#\(.number) \(.title) [state=\(.state)]"'
gh api repos/{owner}/{repo}/issues --jq '[.[] | select(.pull_request == null)] | .[] | "#\(.number) [\(if .state == "open" then "open" else "closed" end)] \(.title)"'
```

**Commit author matching:** match `author.login` == CURRENT_USER. If `author` is null (unsigned commits), fall back to `commit.author.name` containing USER_NAME.
**PR activity matching (Team mode primary signal):** match `user.login` == CURRENT_USER. Treat a PR as "近期工作" if any of `created_at`, `updated_at`, or `merged_at` is within the last 7 days.
**Why PR first:** do not infer "无工作" only from default-branch commit history. Many repos merge into `dev`, squash/rebase, or preserve commits under merger identities, so direct commit scan is fallback, not the primary signal for personal contribution.

### 2. Project Board Scan

Read the project board to get current milestone status and sub-issue completion:

```bash
# Get all board items grouped by target milestone
gh project item-list 3 --owner ChronoAIProject --format json -L 50
```

Parse items by Target (M0/M1/M2), count completion per milestone (Done vs total).

**founder mode 额外扫描:** Aevatar 研发看板 (aevatarAI projects #23 "Aevatar Framework"):

```bash
gh project item-list 23 --owner aevatarAI --format json -L 30
```

按 Status 分组统计 (In Progress / Todo / Done)，提取最近活跃的 In Progress items (最多 5 条)。

### 3. Critical Path Check

**阻塞源 / Blocker source:** 从 Step 2 看板数据中筛选带 `blocker` label 的 items:
- Issue-backed items: 检查 `content.labels` 是否包含 `blocker`
- 如无 blocker items → 阻塞状态为 "无 (关键路径畅通)"

**Deadline 计算:** 从 `strategy/goals.md` 读取当前 milestone 的 deadline，计算剩余天数。

**Reconcile 检测 (founder mode only):**
运行以下检查，发现漂移时在报告中输出 `### ⚠️ 数据漂移警告` section:
1. goals.md milestone 表"阻塞"列中存在硬编码 issue 编号 (`#\d+`) → 提示: "goals.md 阻塞列仍有硬编码 issue 编号，应改为 '见看板 label:blocker'"
2. goals.md 产品线标记 PARKED 但看板有该产品的 non-Done items → 提示: "{product} 标记为 PARKED 但看板有活跃 items"
3. 当前 milestone deadline 已过但看板有未完成 blocker items → 报警: "M{n} deadline 已过但仍有未解决 blocker"

### 4. Output Report

Use Chinese. The roadmap section is **identical for all roles** (this is the alignment value).

#### Common Header (all roles)

```
## 每日更新 {date}

**北极星:** NyxID 外部周活用户 = {current}
**当前目标:** {milestone} (deadline {date}, 剩余 {n} 天)
**关键路径阻塞:** {blockers or "无 (关键路径畅通)"}
```

**阻塞数据来源:** Step 3 中从看板筛选的 blocker label items，不再从 goals.md 解析。

#### Roadmap (all roles, identical)

```
### 工作路线图

🎯 北极星: NyxID ≥10 外部周活用户         Current: {n}
═══════════════════════════════════════════════════════════

🏔️ M0: {title}                            {deadline} (剩 {n} 天)
   Target: {n} | Current: {n}
   ├── {status_icon} #{num} {title}        [{status}] {assignee} {blocker_flag}
   ├── ...
   └── ...
                                           ────── {done}/{total} 完成

🏔️ M1: {title}                            {deadline}
   Target: {n} | Current: {n}
   ├── {type_icon} #{num} {title}          [{status}]
   └── ...
                                           ────── {done}/{total} 完成

🏔️ M2: {title}                            {deadline} {hard_flag}
   Target: {n} | Current: {n}
   ├── {type_icon} #{num} {title}          [{status}]
   └── ...
                                           ────── {done}/{total} 完成

═══════════════════════════════════════════════════════════
关键路径: {critical_path_chain}
         {pointer_to_current_position}

Status icons: 🔴 In Progress, ⬜ Todo, ✅ Done
Type icons: 🔧 Technical, 📣 Non-technical
Flags: ⚠️ BLOCKER for P0 items, (HARD) for hard deadlines
```

Render rules for the roadmap:
- Skip milestone card items from the sub-item list (they are the section headers)
- Show assignee if assigned, "owner 待定" if not
- For each milestone, count Done items vs total to show completion fraction
- The 关键路径 line shows the sequential dependency chain across milestones
- Mark current position with ~~~~~~~~ under the active step
- ⚠️ BLOCKER flag: 从看板 `blocker` label 判定，不再从 goals.md 解析

---

#### Founder Mode (CURRENT_USER = loning)

After the roadmap, output:

```
### 仓库变更
- NyxID: {summary, who, what}
- Aevatar: {summary or "无变更"}
- Ornn: {summary or "无变更"}
- Automath: {summary or "无变更"}
- Sisyphus: {summary or "无变更"}

### 阻塞变化
数据来源: 看板 blocker label (对比上次运行状态)
- ✅ 已解决: {blocker label 被移除或 item 移到 Done}
- 🔴 新增: {新增 blocker label 的 items}
- ⏳ 未变: {仍有 blocker label 且未完成}

### Aevatar 研发看板 (aevatarAI #23)
数据来源: aevatarAI/projects/23 "Aevatar Framework"
- 进行中: {count} | 待办: {count} | 完成: {count}
- 活跃 items:
  - 🔴 #{num} {title} [{assignee}]
  - ...

### 需要 Auric 决策
{pending decisions from board items without assignee or with founder action needed}

### 建议下一步
{1-3 concrete actions based on what changed}
```

##### Update Docs (founder only)

If milestone Current values changed (北极星指标有新数据):
- Update `strategy/goals.md` milestone table (Current values only — 阻塞列已委托给看板)
- Update `products/*.md` if significant changes

注意: goals.md 阻塞列不再需要手动更新，blocker 状态由看板 label 管理。

Show diff. Do NOT commit unless Auric says commit.

---

#### Team Mode (CURRENT_USER != loning)

After the roadmap, output the following sections. Data filtered by USER_PRODUCTS and USER_REPOS from team.yaml.
**替换说明:** 以下 5 个 section 替代旧版的"我的工作/我的待办/我和目标的关系/阻塞提醒"。

##### 你的产品线状态

从 goals.md 读取 USER_PRODUCTS 中每个产品线的战略状态。
多产品线优先级: ACTIVE > INCUBATING > EXPLORING > PARKED. 同级别按里程碑 deadline 排序。PARKED 无 deadline 时按字母序。

```
### 你的产品线状态

{对 USER_PRODUCTS 中每个产品线:}

#### {product_name} — {disposition}

**战略定位:** {从 goals.md 读取该产品线的处置说明}
**当前里程碑:** {该产品线的里程碑或 "无硬性里程碑"}
**战略期望:**
  - ACTIVE: "全力推进 {milestone}，deadline {date}"
  - INCUBATING: "低投入保持活跃，关注 {milestone}"
  - EXPLORING: "探索验证方向，无硬性 deadline"
  - PARKED: "零投入等待触发条件: {trigger}"
  - KILLED: "该产品线已终止，无需投入"
```

如果 USER_PRODUCTS 为空或仅含 [other]:
```
你的产品线未纳入战略跟踪。联系 Auric 对齐。
```

##### 你的待办

按优先级排序。数据来源: 看板 items (通过 `content.repository` 匹配 USER_REPOS) + 产品 repo open issues。

```
### 你的待办

**P0 — 关键路径上:**
P0 判定: 看板 item 有 label "blocker" (唯一数据源，不再读取 goals.md 阻塞列)
- {status_icon} #{num} {title} [{status}] ⚠️

**P1 — 当前里程碑:**
{看板 items 在当前里程碑中的，排除 P0}
- {status_icon} #{num} {title} [{status}]

**P2 — 产品 repo open issues:**
{USER_REPOS 的 open issues，不在看板上的，最多 5 条}
通过 issue number + repo 匹配去重
- #{num} {title}
```

空 tier 处理: 如果某个优先级层无 item，省略该层标题。
如果所有待办为空:
```
看板和 issue list 中暂无你的产品线的待办。如果你认为有遗漏，请联系 Auric 对齐。
```

##### 你的近期工作

```
### 你的近期工作

最近 7 天:
{只扫 USER_REPOS，优先看 PR activity，每个 repo 最多显示 3 条:}
- {repo_name}: PR #{num} {title} [{merged/open/closed}]
- {repo_name}: 如无 PR activity，则回退显示 direct commits
- {repo_name}: 两者都无则 "无近期活动"
```

如果 USER_REPOS 为空: "暂无关联仓库。"
如果所有 repo 均无 PR 或 direct commit: "最近 7 天无 PR 或提交记录。"

##### 建议优先级

```
### 建议优先级

基于公司战略和当前关键路径:
1. {最重要的事 — 通常是 P0 中的第一个}
2. {第二重要的事}
3. {如果产品线是 PARKED/EXPLORING: 对应的低投入建议}
```

标注: "基于战略，具体可与 Auric 讨论"

##### Projects 相关信息

```
### 看板相关

{从 Step 2 看板数据中，按 assignee 或 content.repository 匹配 CURRENT_USER / USER_REPOS 的 items:}
- {status_icon} #{num} {title} [{status}] {milestone if any}
{如果无匹配:}
- 看板上暂无与你直接相关的 item
```

## Rules

- 中文输出
- 不自动 commit (founder mode 下也需要 Auric 确认)
- 不推荐视频/文章
- 不追踪 feature 完成度，只追踪行动和阻塞
- 报告要短，一屏能看完
- 路线图部分全员一致，这是对齐的核心
- Team mode 读取 team.yaml (members + non_engineering 统一查找) 和 goals.md，按产品线过滤
- Team mode 扫描产品 repo open issues（不只看板），但限制最多 5 条避免信息过载
- Team mode 的"你的近期工作"优先扫描 PR activity，direct commits 仅作 fallback
- Team mode 显示"建议优先级"但标注"基于战略，具体可与 Auric 讨论"
- Team mode 不显示 "需要 Auric 决策"
- Team mode 不修改任何文档
- Step 2 (看板) 和 Step 3 (关键路径) 全量扫描不变，因为路线图需要全局数据
- Step 2 board data 双重用途: 全量用于路线图，按 USER_REPOS 过滤后用于"你的待办"和"看板相关"
