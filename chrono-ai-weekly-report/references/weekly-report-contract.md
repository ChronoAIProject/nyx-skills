# weekly-report contract

Determinism source of truth for `scripts/build_weekly_report_payload.js`. The agent fetches
and analyzes GitHub data, then passes ONE `report` object to the script, which formats it into
a Lark interactive card and a markdown fallback. The script does no I/O and reads no clock.

## Input

Accepted at the root, under `report`, or under `body`. Shape:

```json
{
  "account": "eanzhao",
  "window": { "start": "2026-05-29", "end": "2026-06-05", "label": "本周 · 05-29 → 06-05" },
  "headline": "把 Aevatar 从“会聊天”推进到“会用工具、会跑技能、还能自己造技能”。",
  "metrics": { "additions": 22115, "deletions": 5317, "changed_files": 453, "rework_commits": 14 },
  "sections": [
    {
      "title": "Feature · 技能系统",
      "items": [
        { "number": 1762, "title": "跨客户端 ::name 显式技能触发 ingress", "url": "https://github.com/aevatarAI/aevatar/pull/1762", "status": "merged", "scope": "dev" },
        { "number": 1695, "title": "use_skill 挂载 skill assets/*.yaml 为 scope 可调用 workflow", "url": "https://github.com/aevatarAI/aevatar/pull/1695", "status": "open", "scope": "#1698" }
      ]
    },
    {
      "title": "Refactor",
      "items": [
        { "number": 1763, "title": "AgentKind 身份契约收敛 primary-only + 删两套 legacy 子系统", "url": "https://github.com/aevatarAI/aevatar/pull/1765", "status": "merged", "scope": "185 文件" }
      ]
    }
  ],
  "blockers": [
    { "title": "feature/integrate (#1698) 与 dev 冲突", "url": "https://github.com/aevatarAI/aevatar/pull/1698", "why": "mergeable_state=dirty，1 个 DI 文件内容冲突", "cost": "挡住 12 个 issue + NyxID 工具进 dev" }
  ],
  "lark": { "chat_id": "oc_xxx", "receive_id_type": "chat_id" }
}
```

### Field aliases
- account: `account` / `login` / `username`
- headline: `headline` / `summary` / `mainline`
- sections: `sections`; or arrays `features` / `refactors` / `fixes` (auto-titled)
- item number: `number` / `num` / `id`
- item title: `title` / `name`
- item url (the hyperlink): `url` / `html_url` / `link`
- item status: `status` / `state` — one of `merged|open|review|draft|blocked|closed`;
  falls back to the `merged` / `draft` booleans, else `open`
- item scope tag: `scope` / `note` / `branch` / `where`
- blocker fields: `title`, `url`, `why`/`reason`, `cost`/`impact`
- lark target: `lark.chat_id` (or `receive_id` / `open_id` / `union_id` / `user_id`) +
  `lark.receive_id_type` (default `chat_id`)

## Output

```json
{
  "message_type": "weekly_report",
  "counts": { "merged": 3, "open": 9, "review": 2, "draft": 0, "blocked": 1, "closed": 0, "total": 15 },
  "markdown": "# eanzhao 本周 GitHub 周报 · ...",
  "lark": {
    "method": "POST",
    "path": "/open-apis/im/v1/messages",
    "query": "?receive_id_type=chat_id",
    "card": { "config": { "wide_screen_mode": true }, "header": { "...": "..." }, "elements": ["..."] },
    "body": { "receive_id": "oc_xxx", "msg_type": "interactive", "content": "<stringified card>" }
  }
}
```

Send step (agent): `nyxid_proxy` service `api-lark-bot`, `POST {path}{query}` with `lark.body`.
If `receive_id` is empty the output carries `lark.note` reminding the agent to fill `chat_id`
from runtime context first.

### Card layout
- **Header**: blue normally, red when `blockers` is non-empty; title `"{account} · 本周工作周报"`.
- **Summary div**: account + window + a one-line count strip.
- **Metrics table**: a `column_set` with four columns (净改动 / 文件 / 工作项 / 返工), each a
  bold label over its value — this is the "表格".
- **Per section**: an `hr`, a bold section header with the item count, then one `column_set`
  row per item: left column = hyperlinked `[#num title](url)`, right column = status emoji +
  label + scope.
- **Blockers**: an `hr`, a `⚠️ 卡点` header, then one red-flag div per blocker with why + 代价.

### Empty / missing input
With `{}` (or no `sections`/`headline`/`metrics`) the script returns
`{ "needs_more_information": true, "missing": ["report"], "hint": "..." }` and never throws.

## Worked example

`echo '{"report":{"account":"eanzhao","window":{"label":"05-29→06-05"},"metrics":{"additions":22115,"deletions":5317,"changed_files":453,"rework_commits":14},"sections":[{"title":"Feature","items":[{"number":1762,"title":"::name ingress","url":"https://github.com/aevatarAI/aevatar/pull/1762","status":"merged","scope":"dev"}]}],"blockers":[{"title":"#1698 与 dev 冲突","url":"https://github.com/aevatarAI/aevatar/pull/1698","why":"mergeable_state=dirty","cost":"挡住 12 个 issue"}],"lark":{"chat_id":"oc_demo"}}}' | node scripts/build_weekly_report_payload.js`

returns a `weekly_report` object whose `lark.body.content` is the stringified interactive card
(red header because a blocker is present) and whose `markdown` mirrors it.
