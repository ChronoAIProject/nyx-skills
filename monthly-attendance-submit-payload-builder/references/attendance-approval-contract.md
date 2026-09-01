# Monthly attendance approval contract

This contract defines deterministic behavior for `monthly-attendance-approval-payload-builder`.

## Original n8n flow

The original workflow is named `月度考勤审批 - 自动提交`. It has two schedule branches:

1. **Submit branch** — `每日10点触发` (`0 10 28-31 * *`) → `NyxID Config` (constants) → `判断是否月末` (only proceeds when *tomorrow* is the 1st, i.e. today is the month's last day) → `获取 Lark Token` (tenant token) → `拉取考勤记录` (Bitable records filtered to the current `YYYY年M月`) → `生成审批内容` (stats + description + form) → `Code in JavaScript` (`POST /open-apis/approval/v4/instances`, dropping the read-only date widget) → `发送 DM 通知` (interactive confirmation card via `POST /open-apis/im/v1/messages`).
2. **Reminder branch** — `月底提醒触发（每月27号）` (`0 10 27 * *`) → DMs a "fill in your attendance data" reminder card. This is a standalone nudge with no approval; aevatar reproduces it (if wanted) by sending a card on the 27th, and it is out of scope for the deterministic payload below.

This skill builds only the **deterministic outbound bodies** of the submit branch: the approval instance body and the confirmation DM body. **On aevatar the manual `tenant_access_token` fetch and the direct `open.larksuite.com` calls are dropped** — the `api-lark-bot` NyxID proxy slug brokers credentials. Aevatar owns the schedule, the Bitable read, token exchange, HTTP sends, and message delivery.

## Input shape

The caller may pass fields at the root or wrapped under `body`. The script reads the attendance rows from any of:

- `records` — array of row objects, each either `{ fields: {...} }` (Bitable record shape) or a flat `{...}` of field → value;
- `items` — same as `records`;
- a raw Lark Bitable list response — `{ data: { items: [...] } }` or `{ items: [...] }`.

Each row's field map uses the **verbatim Bitable column names** (note the deliberately mixed-width parentheses in the two leave columns):

| Field key | Meaning | Type in Bitable |
|---|---|---|
| `月份` | Month label, e.g. `2026年5月` (used by aevatar to filter rows; the script trusts already-filtered rows) | string |
| `应出勤天数` | Expected work days for the month | number |
| `人员情况` | Person status; `离职` marks a departure | array of rich-text segments `[{text}]` or a plain string |
| `事假(天）` | Personal-leave days (half-width `(`, full-width `）`) | number |
| `病假（天）` | Sick-leave days (full-width both sides) | number |

### Config aliases (defaults baked from `NyxID Config`)

Use the first non-empty value; otherwise the default.

| Normalized | Source aliases | Default |
|---|---|---|
| `year` | `year`, `Year` | — (required) |
| `month` | `month`, `Month` | — (required) |
| `approval_code` | `approval_code`, `approvalCode` | `3F02FB04-3919-4089-B42B-B1B557820EB5` |
| `submitter_id` (`user_id` in body) | `submitter_id`, `submitterId`, `user_id`, `userId` | `ee689459` |
| `notify_user_id` (DM `receive_id`) | `notify_user_id`, `notifyUserId` | `831cg5af` |
| `doc_url` | `doc_url`, `docUrl`, `sheetUrl` | `https://aelfblockchain.sg.larksuite.com/base/MwIRb3h5hauYvcsA28kl8FGfgjg?table=tblTDqjSDKffQ7cm&view=vewfR8fiQS` |
| `widget_desc_id` | `widget_desc_id`, `descWidgetId` | `widget17195537488110001` |
| `widget_link_id` | `widget_link_id`, `linkWidgetId` | `widget17174729080890001` |
| `instance_code` | `instance_code`, `instanceCode` | `—` (placeholder until the approval response returns one) |

`year` and `month` are **required** and must be supplied by aevatar (the deterministic builder never reads the wall clock; argless `new Date()` / `Date.now` are forbidden). If either is missing, the script returns `{ "needs_more_information": true, "missing": ["year", "month"] }`. If no rows resolve, it returns `{ "needs_more_information": true, "missing": ["records"] }`.

## workDays / attendance computation

Ported verbatim from node `生成审批内容`:

- **`workDays`** — the **first** row whose `应出勤天数` is `> 0`. (All rows in a month share the same expected work days; the first positive value wins.)
- **`resignCount`** — number of rows whose `人员情况` resolves to exactly `离职`. The array form reads segment `[0].text` (falling back to `.name`); a plain string is used as-is.
- **`leaveCount`** — number of rows whose `事假(天）` is `> 0`.
- **`sickCount`** — number of rows whose `病假（天）` is `> 0`.

Non-numeric or missing cells coerce to `0`.

## Approval description (textarea widget value)

Built exactly as node `生成审批内容` (history format, blank line between每项, trailing auto-generated marker):

```text
{year}年{month}月出勤天数：{workDays}天 （单休）

离职人员：{resignCount} 人

事假：{leaveCount} 人

病假：{sickCount} 人

【via lark-cli (auto-generated)】
```

## Form widget mapping

The approval definition has three widgets, but node `Code in JavaScript` **omits the read-only date widget** (`widget17167976379680001`) — Lark rejects writes to read-only date fields. Only two widgets are submitted, in this order:

| Order | Widget id (default) | `type` | Value |
|---|---|---|---|
| 1 | `widget17195537488110001` (`widget_desc_id`) | `textarea` | the approval description above |
| 2 | `widget17174729080890001` (`widget_link_id`) | `input` | `doc_url` |

The read-only date widget `widget17167976379680001` (`widget_date_id`) is documented for completeness but is **never** part of the submitted `form`.

## Exact approval body

`POST /open-apis/approval/v4/instances` (via `nyxid_proxy` slug `api-lark-bot`):

```json
{
  "approval_code": "3F02FB04-3919-4089-B42B-B1B557820EB5",
  "user_id": "ee689459",
  "form": "<JSON.stringify of the 2-element form array above>"
}
```

`form` is the **stringified** array (Lark requires the form as a JSON string), e.g.:

```text
[{"id":"widget17195537488110001","type":"textarea","value":"2026年5月出勤天数：22天 （单休）\n\n离职人员：1 人\n\n事假：1 人\n\n病假：1 人\n\n【via lark-cli (auto-generated)】"},{"id":"widget17174729080890001","type":"input","value":"https://aelfblockchain.sg.larksuite.com/base/MwIRb3h5hauYvcsA28kl8FGfgjg?table=tblTDqjSDKffQ7cm&view=vewfR8fiQS"}]
```

## Exact DM body

`POST /open-apis/im/v1/messages?receive_id_type=user_id` — sent with `lark_messages_send` after the approval is submitted. `receive_id` is `notify_user_id`; `content` is the stringified interactive card from node `发送 DM 通知`:

```json
{
  "receive_id": "831cg5af",
  "msg_type": "interactive",
  "content": "<JSON.stringify of the card below>"
}
```

Card (the `审批编号` note uses the returned `instance_code`, falling back to `—`; the wording is `由 aevatar 自动提交`):

```json
{
  "config": { "wide_screen_mode": true },
  "header": {
    "title": { "tag": "plain_text", "content": "✅ {year}年{month}月 中国区考勤审批已提交" },
    "template": "blue"
  },
  "elements": [
    {
      "tag": "div",
      "fields": [
        { "is_short": true, "text": { "tag": "lark_md", "content": "**出勤天数**\n{workDays} 天（单休）" } },
        { "is_short": true, "text": { "tag": "lark_md", "content": "**离职人员**\n{resignCount} 人" } },
        { "is_short": true, "text": { "tag": "lark_md", "content": "**事假**\n{leaveCount} 人" } },
        { "is_short": true, "text": { "tag": "lark_md", "content": "**病假**\n{sickCount} 人" } }
      ]
    },
    { "tag": "hr" },
    {
      "tag": "action",
      "actions": [
        { "tag": "button", "text": { "tag": "plain_text", "content": "查看考勤表" }, "type": "primary", "url": "{doc_url}" }
      ]
    },
    { "tag": "note", "elements": [{ "tag": "plain_text", "content": "审批编号: {instance_code} | 由 aevatar 自动提交" }] }
  ]
}
```

## Fetching the attendance records on aevatar

The n8n source read the Bitable table directly. On aevatar, fetch the same records through the proxy and pass the response (or the extracted `items`) into the builder:

```text
GET /open-apis/bitable/v1/apps/MwIRb3h5hauYvcsA28kl8FGfgjg/tables/tblTDqjSDKffQ7cm/records?page_size=100
```

via `nyxid_proxy` `{ slug: "api-lark-bot", path: "/open-apis/bitable/v1/apps/.../records", method: "GET" }`. Keep only rows whose `月份` equals `{year}年{month}月` before building (the builder trusts the rows it is given). The Lark **attendance** API namespace (`/open-apis/attendance/v1/...`) exists for raw punch/clock data, but this workflow's source of truth is the curated **Bitable** attendance table above — use that path.

## Output shape

```json
{
  "message_type": "lark_attendance_approval_instance",
  "summary": "{year}年{month}月 中国区考勤审批 (出勤 N 天 / 离职 N / 事假 N / 病假 N)",
  "month": "{year}-{month}",
  "stats": { "workDays": 0, "resignCount": 0, "leaveCount": 0, "sickCount": 0 },
  "description": "<approval description>",
  "form": [ /* 2 widgets, date widget omitted */ ],
  "approval": {
    "path": "/open-apis/approval/v4/instances",
    "method": "POST",
    "body": { "approval_code": "...", "user_id": "...", "form": "<stringified form>" }
  },
  "dm": {
    "path": "/open-apis/im/v1/messages?receive_id_type=user_id",
    "method": "POST",
    "receive_id_type": "user_id",
    "body": { "receive_id": "...", "msg_type": "interactive", "content": "<stringified card>" }
  }
}
```

## Isolation

This skill does not fetch or store Lark tenant access tokens, NyxID bearers, OAuth credentials, or app secrets. It does not call network endpoints, read Bitable, send Lark messages, submit approvals, or invent records, widget ids, approval codes, user ids, or approval status. All I/O and credential brokering happen in aevatar through the NyxID-brokered tools.
