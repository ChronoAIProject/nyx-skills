# Deadline monitor contract

This contract defines deterministic behavior for `deadline-monitor-digest-payload-builder`.

## Original n8n flow

The original workflow has four outbound branches:

1. Schedule node `每天 9:00 触发` collects open GitHub milestones, calculates `OVERDUE` and `CRITICAL` risks, and posts a Lark bot webhook text body from `生成飞书消息` to `发送飞书通知`.
2. Schedule node `每周一 9:30 触发（无Milestone检查）` collects open GitHub issues, counts issues with no milestone, and posts a Lark bot webhook text body from `找出无 Milestone 任务` to `发送无Milestone预警`.
3. Schedule node `每周五 17:00 触发（周报）` collects all GitHub milestones and posts a Lark bot webhook text body from `生成周五报告` to `发送周五报告`. The node label says 17:00; the JSON schedule field is `triggerAtHour: 13`.
4. Schedule node `每天 10:00 触发（T=50% Check-in）` collects issues, uses a tenant token to send a personal Lark text message from `准备 Check-in 消息体`, then posts a deterministic GitHub issue comment body from `在 GitHub Issue 发评论`.

This skill builds only the deterministic outbound bodies. Aevatar owns schedules, GitHub reads, user mapping, check-in dedupe, Lark tenant token exchange, webhook URL storage, Authorization headers, HTTP sends, and GitHub comments.

## GitHub target resolution

The runtime can collect data for either a single repository or an organization/user:

- Repository target: `owner/name`, fetched through `/repos/{owner}/{name}/...`.
- Organization/user target: `owner`, discovered through `/orgs/{owner}/repos?per_page=100&type=all`; if that 404s, try `/users/{owner}/repos?per_page=100&type=owner`, then fan out to `/repos/{repo.owner.login}/{repo.name}/...`.

Do not synthesize a repository name from an organization/user name. A single-segment target must be resolved through org/user repository discovery first. A 404 from `/repos/{owner}/{name}` is a failed data fetch, not evidence for an empty day.

When fan-out returns rows from multiple repositories, preserve the full repository name on each row with `repo` or `repository` (for example `ChronoAIProject/Ornn`). The builder also derives this from GitHub `html_url` for milestone and issue rows when possible.

## Input envelope

The caller may pass the event body directly or wrap it in `body`. If `body` exists, read fields from `body`; otherwise read fields from the root object.

Choose one mode with `mode`.

| Mode | Purpose |
|---|---|
| `daily_risk_digest` | Build the daily urgent Lark bot webhook text body. |
| `orphan_milestone_digest` | Build the weekly no-milestone Lark bot webhook text body. |
| `friday_progress_report` | Build the Friday progress Lark bot webhook text body. |
| `checkin_payloads` | Build personal Lark IM bodies and GitHub issue comment bodies for selected check-in rows. |

All date-driven modes require `today`. Accepted aliases are `today`, `date`, `runDate`, `run_date`, and `todayStr`. The value is normalized to the first 10 characters, matching `YYYY-MM-DD`.

## Lark webhook output

For digest modes, the original n8n code built:

```javascript
JSON.stringify({ msg_type: "text", content: { text: message } })
```

The skill returns both the workflow-compatible string and parsed body:

```json
{
  "message": "text sent to Lark",
  "larkBody": "{\"msg_type\":\"text\",\"content\":{\"text\":\"text sent to Lark\"}}",
  "lark": {
    "body": {
      "msg_type": "text",
      "content": { "text": "text sent to Lark" }
    }
  }
}
```

The configured bot webhook URL is not returned by this skill.

## Mode: daily_risk_digest

### Inputs

Required:

- `today`
- either risk rows or raw milestone rows

Risk row aliases:

| Normalized field | Source fields |
|---|---|
| `risks` | `risks`, `riskItems`, `risk_items` |

Each risk row must provide:

| Normalized field | Source fields |
|---|---|
| `repo` | `repo`, `repository`; or derived from `milestoneUrl` |
| `riskLevel` | `riskLevel`, `risk_level` |
| `milestoneTitle` | `milestoneTitle`, `milestone_title`, `title` |
| `milestoneUrl` | `milestoneUrl`, `milestone_url`, `html_url`, `url` |
| `dueDate` | `dueDate`, `due_date`, `due_on` |
| `riskMsg` | `riskMsg`, `risk_msg`; or derived from `riskLevel`, `daysRemaining`, and `openIssues` |
| `openIssues` | `openIssues`, `open_issues` |

Raw milestone aliases:

| Normalized field | Source fields |
|---|---|
| `milestones` | `milestones`, `items` |

For raw milestone rows, follow the workflow's `计算风险级别` logic:

- skip rows without `due_on` or `html_url`
- derive repo from `html_url` by removing `https://github.com/` and taking the first two path segments
- `daysRemaining = ceil((dueDate - today) / 86400000)`
- `OVERDUE` when `daysRemaining < 0`
- `CRITICAL` when `daysRemaining <= 3` and `open_issues > 0`
- if no rows become risky, return `{ "skip": true, "reason": "no deadline risks" }`

### Output shape

```json
{
  "message_type": "deadline_daily_risk_digest",
  "summary": "Deadline emergency digest for 2 risk(s)",
  "totalRisks": 2,
  "overdueCount": 1,
  "criticalCount": 1,
  "risks": [
    {
      "repo": "ChronoAIProject/Ornn",
      "riskLevel": "OVERDUE",
      "riskMsg": "已逾期 2 天，仍有 4 个 Issues 未完成",
      "milestoneTitle": "M1",
      "milestoneUrl": "https://github.com/ChronoAIProject/Ornn/milestone/1",
      "dueDate": "2026-06-02",
      "openIssues": 4
    }
  ],
  "message": "full digest text",
  "larkBody": "{\"msg_type\":\"text\",\"content\":{\"text\":\"full digest text\"}}",
  "lark": { "body": { "msg_type": "text", "content": { "text": "full digest text" } } }
}
```

### Example

Input:

```json
{
  "mode": "daily_risk_digest",
  "today": "2026-06-04",
  "milestones": [
    {
      "title": "Mainnet rollout",
      "html_url": "https://github.com/ChronoAIProject/Ornn/milestone/1",
      "due_on": "2026-06-02T00:00:00Z",
      "open_issues": 4
    },
    {
      "title": "Connector cleanup",
      "html_url": "https://github.com/ChronoAIProject/NyxID/milestone/2",
      "due_on": "2026-06-06T00:00:00Z",
      "open_issues": 2
    }
  ]
}
```

Expected message starts with:

```text
🚨 Chrono AI | 紧急预警 | 需立即处理
📅 2026-06-04   ⛔ 共 2 个紧急任务
================================
```

## Mode: orphan_milestone_digest

### Inputs

Required:

- `today`
- open issue rows under `issues`, `openIssues`, `open_issues`, or `items`

Follow the workflow's `找出无 Milestone 任务` logic:

- for each row, count it when `milestone` is absent or null and both `number` and `html_url` exist
- do not skip pull requests; the original workflow did not filter `pull_request` here
- derive repo name from `html_url` by removing `https://github.com/` and taking path segment index 1
- sort repo counts descending
- show only the first 15 repos in the message
- if no rows qualify, return `{ "skip": true, "reason": "no orphan issues" }`

### Output shape

```json
{
  "message_type": "deadline_orphan_milestone_digest",
  "summary": "No-milestone digest for 3 issue(s)",
  "total": 3,
  "repoCount": 2,
  "repoCounts": [
    { "repo": "Ornn", "count": 2 },
    { "repo": "NyxID", "count": 1 }
  ],
  "message": "full digest text",
  "larkBody": "{\"msg_type\":\"text\",\"content\":{\"text\":\"full digest text\"}}",
  "lark": { "body": { "msg_type": "text", "content": { "text": "full digest text" } } }
}
```

### Example

Input:

```json
{
  "mode": "orphan_milestone_digest",
  "today": "2026-06-04",
  "issues": [
    { "number": 10, "html_url": "https://github.com/ChronoAIProject/Ornn/issues/10", "milestone": null },
    { "number": 11, "html_url": "https://github.com/ChronoAIProject/Ornn/issues/11", "milestone": null },
    { "number": 12, "html_url": "https://github.com/ChronoAIProject/NyxID/issues/12", "milestone": { "title": "M1" } }
  ]
}
```

Expected message contains:

```text
📋 每周提醒 | 无 Deadline 任务
📅 2026-06-04   共 2 个 Issues 未分配 Milestone
```

## Mode: friday_progress_report

### Inputs

Required:

- `today`
- milestone rows under `milestones` or `items`

Each milestone may include `repo` or `repository`. For the report list, use `repo.replace("ChronoAIProject/","")`. If no repo is present, use `unknown`, matching the workflow fallback.

Follow the workflow's `生成周五报告` logic:

- `oneWeekAgo = today - 7 days`
- `completedCount` increments for `state === "closed"` with `closed_at >= oneWeekAgo`
- for `state === "open"` with `due_on`, compute `daysRemaining`
- `overdueCount` increments when `daysRemaining < 0` and `open_issues > 0`
- `upcomingCount` increments when `0 <= daysRemaining <= 7` and `open_issues > 0`
- list at most 5 overdue rows and at most 5 upcoming rows

### Output shape

```json
{
  "message_type": "deadline_friday_progress_report",
  "summary": "Friday deadline progress report for 2026-06-04",
  "completedCount": 1,
  "overdueCount": 1,
  "upcomingCount": 1,
  "overdueList": ["• Ornn — Mainnet rollout"],
  "upcomingList": ["• NyxID — Connector cleanup（2天后到期）"],
  "message": "full report text",
  "larkBody": "{\"msg_type\":\"text\",\"content\":{\"text\":\"full report text\"}}",
  "lark": { "body": { "msg_type": "text", "content": { "text": "full report text" } } }
}
```

### Example

Input:

```json
{
  "mode": "friday_progress_report",
  "today": "2026-06-04",
  "milestones": [
    { "repo": "ChronoAIProject/Ornn", "title": "Done M1", "state": "closed", "closed_at": "2026-06-01T12:00:00Z" },
    { "repo": "ChronoAIProject/Ornn", "title": "Late M2", "state": "open", "due_on": "2026-06-01T00:00:00Z", "open_issues": 3 },
    { "repo": "ChronoAIProject/NyxID", "title": "Soon M3", "state": "open", "due_on": "2026-06-06T00:00:00Z", "open_issues": 2 }
  ]
}
```

Expected message contains:

```text
📊 Chrono AI | 周五进度复盘
📅 2026-06-04   本周总结
```

## Mode: checkin_payloads

### Inputs

Required:

- selected check-in rows under `checkins`, `checkinItems`, `checkin_items`, or `items`

Aevatar must already have applied GitHub issue fetch, assignee to Lark user mapping, T percent filtering, and dedupe. This skill does not read workflow static data or decide whether a user should be notified.

Each check-in row must provide:

| Normalized field | Source fields |
|---|---|
| `issueNumber` | `issueNumber`, `issue_number`, `number` |
| `issueTitle` | `issueTitle`, `issue_title`, `title` |
| `issueUrl` | `issueUrl`, `issue_url`, `html_url`, `url` |
| `repo` | `repo`, `repository` |
| `assigneeLogin` | `assigneeLogin`, `assignee_login`, `assignee` |
| `larkUserId` | `larkUserId`, `lark_user_id`, `user_id`, `userId` |
| `dueDate` | `dueDate`, `due_date`, `due_on` |
| `tPercent` | `tPercent`, `t_percent` |

### Lark personal message body

Build the exact body used by `准备 Check-in 消息体`:

```json
{
  "receive_id": "831cg5af",
  "msg_type": "text",
  "content": "{\"text\":\"[Deadline 提醒] Fix billing bug\\n\\nHi Kelisituo，你负责的「Fix billing bug」已经过了一半时间，deadline 是 2026-06-10。\\n\\n如果进度有变化或需要调整 deadline，在 issue 下更新一下就好：\\nhttps://github.com/ChronoAIProject/Ornn/issues/42\\n\\n不需要回复这条消息。\"}"
}
```

The connector path is:

```text
/open-apis/im/v1/messages?receive_id_type=user_id
```

### GitHub comment body

Build the exact JSON body used by `在 GitHub Issue 发评论`:

```json
{
  "body": "⏰ **Deadline 提醒**\n\n此任务已过一半时间（T=58%），deadline 是 **2026-06-10**。\n\n如进度有变化或需要调整 deadline，请在此回复更新。不需要另外发消息给 HR。"
}
```

The connector path is:

```text
/repos/ChronoAIProject/Ornn/issues/42/comments
```

### Output shape

```json
{
  "message_type": "deadline_checkin_payloads",
  "summary": "Deadline check-in payloads for 1 issue(s)",
  "count": 1,
  "items": [
    {
      "issueNumber": 42,
      "issueTitle": "Fix billing bug",
      "issueUrl": "https://github.com/ChronoAIProject/Ornn/issues/42",
      "repo": "ChronoAIProject/Ornn",
      "assigneeLogin": "Kelisituo",
      "larkUserId": "831cg5af",
      "dueDate": "2026-06-10",
      "tPercent": 58,
      "message": "personal Lark message text",
      "larkMsgBody": "{\"receive_id\":\"831cg5af\",\"msg_type\":\"text\",\"content\":\"{\\\"text\\\":\\\"personal Lark message text\\\"}\"}",
      "githubCommentBody": "{\"body\":\"GitHub comment text\"}",
      "lark": {
        "path": "/open-apis/im/v1/messages?receive_id_type=user_id",
        "body": {
          "receive_id": "831cg5af",
          "msg_type": "text",
          "content": "{\"text\":\"personal Lark message text\"}"
        }
      },
      "github": {
        "path": "/repos/ChronoAIProject/Ornn/issues/42/comments",
        "body": { "body": "GitHub comment text" }
      }
    }
  ]
}
```

### Example

Input:

```json
{
  "mode": "checkin_payloads",
  "checkins": [
    {
      "issueNumber": 42,
      "issueTitle": "Fix billing bug",
      "issueUrl": "https://github.com/ChronoAIProject/Ornn/issues/42",
      "repo": "ChronoAIProject/Ornn",
      "assigneeLogin": "Kelisituo",
      "larkUserId": "831cg5af",
      "dueDate": "2026-06-10",
      "tPercent": 58
    }
  ]
}
```

Expected item contains:

```json
{
  "lark": {
    "path": "/open-apis/im/v1/messages?receive_id_type=user_id"
  },
  "github": {
    "path": "/repos/ChronoAIProject/Ornn/issues/42/comments"
  }
}
```

## Missing fields

If any required field is missing or empty, return:

```json
{
  "needs_more_information": true,
  "missing": ["today"]
}
```

For indexed rows, the missing entries include the row index, for example:

```json
{
  "needs_more_information": true,
  "missing": ["checkins[0].larkUserId"]
}
```
