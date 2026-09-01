# Budget variance contract

This contract defines the deterministic behavior of
`budget-monitor-variance-payload-builder`. An agent that cannot run
`scripts/build_budget_variance_payload.js` can reproduce the exact same Lark card
body by following this document field-for-field.

## Original n8n flow

The source workflow is named `P2 Budget Monitor — Weekly Variance Alert`.

1. `Schedule Trigger` fires weekly, Monday 09:00 (`0 9 * * 1`).
2. Four `httpRequest` nodes read four Lark Bitable tables from one base
   (`page_size=500`):
   - `core_budget`, `core_actual`, `aelf_budget`, `aelf_actual`.
3. `计算差异` (a Code node) aggregates budget vs actual by `一级类目` (and core by
   `BU`), computes variance percentages, and tags a risk level per category.
4. `构建卡片` (a Code node) renders a weekly Lark **interactive card** and wraps it
   in an `im/v1/messages` send body.
5. `发送卡片` POSTs the card to a chat; `验证结果` checks `code === 0`.

This skill replaces steps 3 and 4 (the two Code nodes) as one deterministic
builder. The four Bitable reads and the final Lark send stay in Aevatar and are
brokered by `nyxid_proxy` — see `SKILL.md`.

### Porting note (important)

The n8n source fetched a Lark `tenant_access_token` and called
`open.larksuite.com` directly, via proxy slug `api-lark-bot-2`. On Aevatar that
manual token fetch is **dropped entirely**: `nyxid_proxy` brokers credentials and
the slug is **`api-lark-bot`**. The builder never fetches data or holds a token.

## Source base + table ids (baked defaults)

Extracted verbatim from the source HTTP node URLs. The caller may override any of
these; otherwise these are the defaults.

| Table         | Bitable `table_id` |
|---------------|--------------------|
| `core_budget` | `tblMtwgzEhW7yWTq` |
| `core_actual` | `tblVuALMhd7WGu9k` |
| `aelf_budget` | `tblVkaJLvAjLHARJ` |
| `aelf_actual` | `tbl3lXCuWOSlaiR5` |

Base `app_token`: `L80RbTPAjaiZpOsaYo3lnmYCg3s`

Default Lark recipient (from the `构建卡片` node): `receive_id`
`ou_3d9067006e9fb8eb8e5fc7b2bb4c6264`, `receive_id_type` `open_id`. In the active
playbook the card is normally posted to the **current chat** instead, so this
default only applies when no recipient is supplied and `lark_messages_send` needs
one.

## Input

`buildPayload(input)` (or stdin JSON) accepts the four tables. The caller may pass
the event body directly or wrap it in `body`; if `body` exists, fields are read
from it.

| Table        | Source keys (first present wins)                                  |
|--------------|-------------------------------------------------------------------|
| `coreBudget` | `coreBudget`, `core_budget`, `coreBudgetRows`, `core_budget_rows` |
| `coreActual` | `coreActual`, `core_actual`, `coreActualRows`, `core_actual_rows` |
| `aelfBudget` | `aelfBudget`, `aelf_budget`, `aelfBudgetRows`, `aelf_budget_rows` |
| `aelfActual` | `aelfActual`, `aelf_actual`, `aelfActualRows`, `aelf_actual_rows` |

Plus optional:

| Field             | Source keys                                                       |
|-------------------|-------------------------------------------------------------------|
| `today`           | `today`, `date`, `runDate`, `run_date` (only sets the week number)|
| `receive_id`      | `receive_id`, `receiveId`, `open_id`, `openId`, `chat_id`, `chatId`|
| `receive_id_type` | `receive_id_type`, `receiveId_type` → defaults to `open_id`        |

Each table value may be **any** of:

- a raw Bitable API response: `{ "data": { "items": [ { "fields": { ... } } ] } }`
- an array of Bitable records: `[ { "fields": { ... } }, ... ]`
- an array of already-extracted field objects: `[ { ... }, ... ]`
- n8n-style wrappers: `[ { "json": { ... } } ]`

A missing or empty table is treated as zero rows (the section renders with `$0`
totals). The builder never fails because a table is absent — it builds what it can.

## Row fields (per Bitable record `fields`)

All four tables share the same row shape:

| Field           | Meaning                                                          |
|-----------------|------------------------------------------------------------------|
| `日期`          | Spend date. Any format below is normalized to `YYYY-MM-DD`.       |
| `一级类目`      | Primary category. The grouping key for variance.                  |
| `BU`            | Business unit. Secondary grouping key (core `byBU` only).         |
| `支出金额(USD)` | Spend amount in USD. Parsed leniently (see `parseAmount`).        |

### `parseAmount`

- A `number` is returned as-is.
- Falsy (`""`, `null`, `0`) → `0`.
- Strings: strip `,`, whitespace, and `"`. A value wrapped in parentheses
  `(2,000)` is negative → `-2000`. Otherwise `parseFloat`, non-numeric → `0`.

### `normalizeDate`

Returns `YYYY-MM-DD`:

- `YYYY-MM-DD` → unchanged.
- `YYYY/MM/DD` → slashes to dashes.
- `D/M/YY` or `DD/MM/YY` (Bitable auto-format) → `20YY-MM-DD`, zero-padded.
- `M/D/YYYY` → `YYYY-MM-DD`.
- Anything else → returned unchanged.

## Variance computation (`计算差异`)

1. Normalize `日期` on every row of all four tables.
2. `coreCutoff` = max `日期` across `core_actual` rows; `aelfCutoff` = max `日期`
   across `aelf_actual` rows. `dataCutoff` = the later of the two (string compare).
3. Filter budgets to their cutoff: keep budget rows with `日期 <= cutoff`
   (`core_budget` by `coreCutoff`, `aelf_budget` by `aelfCutoff`). Actuals are
   used in full.
4. `aggregate(rows, key)` = sum of `parseAmount(支出金额(USD))` grouped by `key`
   (`一级类目`, or `BU` for the core BU breakdown). Missing key → `'Unknown'`.
5. `computeVariance(budgetAgg, actualAgg)` over the union of keys:
   - `budget`, `actual` rounded to 2 decimals.
   - `pct = budget > 0 ? actual / budget * 100 : (actual > 0 ? -1 : 0)`.
     `-1` is the sentinel for "spent with no budget".
   - `level`:
     - `pct >= 120` **or** `pct === -1` → `over`
     - `pct >= 100` → `warning`
     - `pct >= 80` → `watch`
     - else → `ok`
   - `pct` rounded to 1 decimal (sentinel `-1` kept as `-1`).
   - Sorted by `pct` descending, with `-1` treated as `999` (worst first).
6. Totals per board = `sum` of that board's category aggregation, rounded to 2
   decimals.

The computed `data` object:

```json
{
  "dataCutoff": "YYYY-MM-DD",
  "coreCutoff": "YYYY-MM-DD",
  "aelfCutoff": "YYYY-MM-DD",
  "coreBudgetRecords": 0,
  "aelfBudgetRecords": 0,
  "core": { "variance": [], "byBU": [], "totalBudget": 0, "totalActual": 0 },
  "aelf": { "variance": [], "totalBudget": 0, "totalActual": 0 }
}
```

Each `variance` entry:

```json
{ "category": "Marketing", "budget": 10000, "actual": 13500, "pct": 135, "level": "over" }
```

## Card construction (`构建卡片`)

Formatting helpers:

- `fmtUSD(n)` → `'$' + Math.abs(round(n)).toLocaleString('en-US')` (e.g. `$13,500`).
- `fmtPct(p)` → `'N/A(无预算)'` if `p === -1`, else `p + '%'`.
- `weekNum` = `ceil((ordinalDay - 1) / 7)` for the reference date (equivalent to
  the n8n `ceil((date - Jan 1) / 604800000)`). Header text is `2026-W<weekNum>`.
  The reference date is taken **only** from input `today`, falling back to
  `dataCutoff` when `today` is absent — the system clock is never read (determinism).
  With no `today` and no data at all, `weekNum` is `0`.
- Level emoji: `over 🔴`, `warning 🟡`, `watch 🟢`.
- Level label: `over 超支 (>=120%)`, `warning 警告 (>=100%)`, `watch 关注 (>=80%)`.

### `buildSection(title, variance, totalBudget, totalActual)`

```
**<title>**  总计: <fmtUSD(totalActual)> / <fmtUSD(totalBudget)> (<totalPct>%)

```

where `totalPct = totalBudget > 0 ? round(totalActual / totalBudget * 1000) / 10 : 0`.

Then, for each level in order `over`, `warning`, `watch`, **if it has items**:

```
<emoji> **<label>**
- <category>  <fmtUSD(actual)> / <fmtUSD(budget)>  <fmtPct(pct)>

```

(one `- ` line per item, then a blank line). Finally, if any `ok` items exist:

```
✅ 正常项: <count> 项
```

Two sections are rendered: `核心业务看板` (core) and `aelf BU 看板` (aelf).

### Card object

```json
{
  "config": { "wide_screen_mode": true },
  "header": {
    "title": { "tag": "plain_text", "content": "📊 每周预算监控报告 2026-W<weekNum>" },
    "template": "<red|orange|green>"
  },
  "elements": [
    { "tag": "div", "text": { "tag": "lark_md", "content": "数据截止: <dataCutoff>" } },
    { "tag": "hr" },
    { "tag": "div", "text": { "tag": "lark_md", "content": "<core section md>" } },
    { "tag": "hr" },
    { "tag": "div", "text": { "tag": "lark_md", "content": "<aelf section md>" } },
    { "tag": "hr" },
    { "tag": "note", "elements": [ { "tag": "plain_text", "content": "🤖 Auto-generated by Aevatar + NyxID | Budget Monitor P2" } ] }
  ]
}
```

`header.template`:

- `red` if any `over` exists in core **or** aelf variance.
- else `orange` if any `warning` exists.
- else `green`.

## Output of `buildPayload`

```json
{
  "message_type": "lark_interactive_message",
  "message": "每周预算监控报告 2026-W<n> (数据截止 <cutoff>): 超支 <n> 项, 警告 <n> 项 (核心 <actual>/<budget>, aelf <actual>/<budget>).",
  "data": { },
  "card": { },
  "lark": {
    "receive_id_type": "open_id",
    "body": {
      "msg_type": "interactive",
      "content": "<JSON.stringify(card)>",
      "receive_id": "ou_3d9067006e9fb8eb8e5fc7b2bb4c6264"
    }
  }
}
```

`lark.body` is exactly the body the Lark `POST
/open-apis/im/v1/messages?receive_id_type=<type>` send API expects: `msg_type`
`interactive`, `content` is the card as a JSON **string**, and `receive_id` is the
resolved recipient (omit/override it when posting to the current chat via
`reply_with_interaction`, where the chat is implicit). `message` is the one-line
human summary for the final report.

## Determinism requirement

Use only data the four Bitable tables actually return. Never invent categories,
amounts, dates, BUs, cutoffs, or a recipient. If a table is unreadable, skip it and
let that board render with `$0` totals — do not fabricate its rows.
