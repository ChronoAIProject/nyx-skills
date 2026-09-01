# ICP Hunter contract

This contract defines deterministic behavior for `icp-hunter-scoring-payload-builder`.

## Original n8n flow

The original workflow is `NyxID ICP Hunter - Discovery and Scoring V7.5.1`.

The trigger path is:

1. `Schedule Trigger` with cron expression `0 9 * * *`.
2. `Expand Queries`.

The workflow also contains an unconnected `Manual Trigger`.

The original n8n flow:

1. Expands eight ICP search queries.
2. Calls NyxID/Tavily search.
3. Formats search results.
4. Enriches Reddit, Twitter/X, GitHub, and Discourse evidence.
5. Calls Gemini for scoring.
6. Parses Gemini scoring output from a JSON object with `users`.
7. Validates source-grounded usernames.
8. Collects, filters, and dedupes users.
9. Reads existing Lark Base records.
10. Dedupes against existing Lark records.
11. Calls Gemini for P0 outreach drafts.
12. Maps new users to Lark Base fields.
13. Calls Lark Base `createRecord`.
14. Builds output stats.
15. Sends a Lark interactive report card.

This skill implements steps 6, 10, 12, 14, and 15 payload construction only. Search, enrichment, Lark reads, Gemini calls, Lark writes, message sending, tokens, credentials, and network I/O stay in Aevatar/NyxID.

## Modes

The script reads JSON from stdin and writes JSON to stdout.

### `parse_scoring`

Input contains a Gemini scoring response. The response may be passed as root JSON or under `scoringResponse`, `geminiResponse`, or `response`.

Supported model response shapes:

```json
{ "candidates": [{ "content": { "parts": [{ "text": "{\"users\":[]}" }] } }] }
```

```json
{ "choices": [{ "message": { "content": "{\"users\":[]}" } }] }
```

```json
{ "content": [{ "text": "{\"users\":[]}" }] }
```

The script strips markdown JSON fences, parses the first JSON object, reads `users`, and drops placeholder usernames matching the workflow's placeholder guard.

Output:

```json
{
  "users": [],
  "_users": [],
  "_placeholder_dropped": 0
}
```

If parsing fails, return:

```json
{ "_error": true, "message": "Parse failed: ..." }
```

### `build_payloads`

Input contains scored candidate users and optional existing Lark records. The mode returns both Lark Base create-record payloads and the final Lark interactive message payload.

Required fields:

| Normalized field | Source fields |
|---|---|
| `users` | `users`, `_users`, or parsed from `scoringResponse` |
| `runTime` | `runTime`, `run_time` |

Required only when a valid user has no post date:

| Normalized field | Source fields |
|---|---|
| `fallbackPostDate` | `fallbackPostDate`, `fallback_post_date`, `postCreatedDate`, `post_created_date` |

Optional run fields:

| Normalized field | Source fields | Default copied from workflow |
|---|---|---|
| `existingRecords` | `existingRecords`, `larkRecords`, `existing_lark_records` | `[]` |
| `weekTag` | `weekTag`, `week_tag` | empty string |
| `batchId` | `batchId`, `batch_id` | empty string |
| `appToken` | `appToken`, `app_token` | `BASE_APP_TOKEN_PLACEHOLDER_2` |
| `tableId` | `tableId`, `table_id` | `TABLE_ID_PLACEHOLDER_3` |
| `receiveId` | `receiveId`, `receive_id`, `chatId`, `chat_id` | `oc_PLACEHOLDER_CHAT_ID_1` |

## User field aliases

Use the first non-empty value in the listed order.

| Normalized field | Source fields |
|---|---|
| `username` | `username`, `userName`, `user_id`, `userId`, `用户ID` |
| `priority` | `priority`, `优先级` |
| `cohort` | `cohort`, `Cohort` |
| `platform` | `platform`, `平台` |
| `profile_url` | `profile_url`, `profileUrl`, `profile`, `Profile 链接` |
| `evidence_url` | `evidence_url`, `evidenceUrl`, `url`, `证据链接` |
| `icp_fit_score` | `icp_fit_score`, `icpFitScore` |
| `total_score` | `total_score`, `totalScore`, `score` |
| `evidence_wedge_fit_score` | `evidence_wedge_fit_score`, `evidenceWedgeFitScore`, `wedgeFitScore` |
| `score_breakdown` | `score_breakdown`, `scoreBreakdown`, `积分明细` |
| `contact_channel` | `contact_channel`, `contactChannel`, `联系渠道` |
| `language_timezone` | `language_timezone`, `languageTimezone`, `语言/时区` |
| `raw_evidence` | `raw_evidence`, `rawEvidence`, `原始证据` |
| `recommended_action` | `recommended_action`, `recommendedAction`, `推荐动作` |
| `week_tag` | `week_tag`, `weekTag`, `周标签` |
| `batch_id` | `batch_id`, `batchId`, `筛选批次` |
| `thread_role` | `thread_role`, `threadRole` |
| `post_created_date` | `post_created_date`, `postCreatedDate`, `帖子发布日期` |
| `outreach_draft` | `outreach_draft`, `outreachDraft`, `outreach draft` |
| `_watch_demote` | `_watch_demote`, `watchDemote` |

## Deduplication

`existingRecords` is the output Aevatar got from the Lark Base read. It may contain raw records, `{ "fields": ... }`, n8n-style `{ "json": ... }`, or paged `{ "items": [...] }`.

Dedup against existing records using the workflow fields:

- `证据链接`
- `用户标识`
- `用户ID`
- `平台`
- `规范化URL`
- `Profile 链接`

Drop a new user when any of these normalized keys match:

- normalized evidence URL
- stored `规范化URL`
- clean username plus platform
- stored `用户标识`
- normalized profile URL

The script also keeps the workflow's final in-batch duplicate guard by username/platform and evidence URL.

## Lark Base field mapping

Each valid user becomes one record:

```json
{
  "fields": {
    "用户ID": "<username>",
    "优先级": "<priority>",
    "Cohort": "<cohort>",
    "当前状态": "<status>",
    "平台": "<platform>",
    "Profile 链接": { "link": "<profile_url>", "text": "<profile_url>" },
    "证据链接": { "link": "<evidence_url>", "text": "<evidence_url>" },
    "总分": 8,
    "积分明细": "<score_breakdown> | wedge fit 3/5",
    "联系渠道": "<normalized channel>",
    "语言/时区": "<language_timezone>",
    "原始证据": "<raw_evidence>",
    "推荐动作": "<recommended_action>",
    "升温状态": "冷",
    "周标签": "<week_tag>",
    "筛选批次": "<batch_id>",
    "thread_role": "OP",
    "帖子发布日期": 1770508800000,
    "用户标识": "<clean username>@<platform>",
    "规范化URL": "<normalized evidence_url>",
    "备注": "API: NyxID Proxy",
    "outreach draft": "<outreach_draft>"
  }
}
```

`Profile 链接`, `证据链接`, `用户标识`, `规范化URL`, and `outreach draft` are omitted only when their source value is absent.

Valid status values:

```json
{ "P0": "待外联", "P1": "观察中", "P2": "暂存" }
```

Valid cohorts:

```json
["A", "B", "A+B", "partner", "unknown"]
```

Invalid or empty cohorts become `unknown`.

Valid `推荐动作` values:

```json
[
  "高触达一对一邀请",
  "先观察 + 轻量互动",
  "暂存观察",
  "Path A long-term watch",
  "follow up 已超期 · 维持 attribution",
  "SKIP · stale + 低 ROI · cron 老 backlog",
  "SKIP · placeholder · 数据异常",
  "SKIP · 永久不外联",
  "不录入"
]
```

Invalid `推荐动作` becomes `暂存观察`.

Valid `联系渠道` values:

```json
["Reddit DM", "Reddit", "X DM", "X", "n8n Forum", "HA Forum", "GitHub", "Email", "Other"]
```

Channel normalization follows the workflow:

- values containing `reddit` become `Reddit DM`
- `x`, `x dm`, `twitter`, or `x/twitter` become `X DM`
- values containing `n8n` become `n8n Forum`
- values containing `home assistant`, `ha forum`, or `homeassistant` become `HA Forum`
- values containing `github` become `GitHub`
- values containing `mcp` become `Other`
- anything else becomes `Other`

## Lark Base create-record payload

The n8n node `Write to Lark` has:

```json
{
  "resource": "base",
  "operation": "createRecord",
  "app_token": { "__rl": true, "value": "BASE_APP_TOKEN_PLACEHOLDER_2", "mode": "id" },
  "table_id": { "__rl": true, "value": "TABLE_ID_PLACEHOLDER_3", "mode": "id" },
  "body": "={{ JSON.stringify({ fields: $json.fields }) }}",
  "options": {}
}
```

The script returns the parsed connector-ready body:

```json
{
  "resource": "base",
  "operation": "createRecord",
  "app_token": { "__rl": true, "value": "BASE_APP_TOKEN_PLACEHOLDER_2", "mode": "id" },
  "table_id": { "__rl": true, "value": "TABLE_ID_PLACEHOLDER_3", "mode": "id" },
  "body": {
    "fields": {}
  },
  "options": {}
}
```

## Report stats

Given the records that will be written, compute:

```json
{
  "total_written": 1,
  "p0_count": 1,
  "p1_count": 0,
  "p2_count": 0,
  "platforms": { "reddit": 1 },
  "api_layer": "NyxID Proxy",
  "run_time": "<runTime>",
  "outreach_count": 1,
  "summary": "[NyxID ICP Hunter] 写入 1 条: P0=1 (1 drafted), P1=0, P2=0",
  "lark_card": "<JSON string>"
}
```

`outreach_count` increments only when `outreach draft` exists, does not start with `[`, and is longer than 10 characters.

## Lark interactive message payload

The n8n node `Send message` has:

```json
{
  "resource": "message",
  "operation": "send",
  "receive_id_type": "chat_id",
  "receive_id": { "__rl": true, "value": "oc_PLACEHOLDER_CHAT_ID_1", "mode": "id" },
  "msg_type": "interactive",
  "content": "={{ $json.lark_card }}",
  "options": {}
}
```

The script returns:

```json
{
  "resource": "message",
  "operation": "send",
  "receive_id_type": "chat_id",
  "receive_id": { "__rl": true, "value": "oc_PLACEHOLDER_CHAT_ID_1", "mode": "id" },
  "msg_type": "interactive",
  "content": "<lark_card JSON string>",
  "options": {}
}
```

The card JSON string is exactly:

```json
{
  "header": {
    "title": {
      "tag": "plain_text",
      "content": "🎯 NyxID ICP Hunter 运行报告"
    },
    "template": "blue"
  },
  "elements": [
    {
      "tag": "div",
      "fields": [
        {
          "is_short": true,
          "text": {
            "tag": "lark_md",
            "content": "**📊 新增总数**\n<total_written> 条"
          }
        },
        {
          "is_short": true,
          "text": {
            "tag": "lark_md",
            "content": "**📅 运行时间**\n<runTime first 19 chars with T replaced by space>"
          }
        }
      ]
    },
    { "tag": "hr" },
    {
      "tag": "div",
      "fields": [
        {
          "is_short": true,
          "text": {
            "tag": "lark_md",
            "content": "**🔴 P0 高触达**\n<p0_count> 人 (<outreach_count> drafted)"
          }
        },
        {
          "is_short": true,
          "text": {
            "tag": "lark_md",
            "content": "**🟡 P1 轻量互动**\n<p1_count> 人"
          }
        }
      ]
    },
    {
      "tag": "div",
      "fields": [
        {
          "is_short": true,
          "text": {
            "tag": "lark_md",
            "content": "**🟢 P2 暂存观察**\n<p2_count> 人"
          }
        },
        {
          "is_short": true,
          "text": {
            "tag": "lark_md",
            "content": "**📍 平台分布**\n<platformText>"
          }
        }
      ]
    },
    { "tag": "hr" },
    {
      "tag": "action",
      "actions": [
        {
          "tag": "button",
          "text": {
            "tag": "plain_text",
            "content": "📋 打开 NyxID ICP Hunter CRM 表"
          },
          "url": "https://aelfblockchain.sg.larksuite.com/base/BASE_APP_TOKEN_PLACEHOLDER_2?table=TABLE_ID_PLACEHOLDER_3&view=vewTOJLNna",
          "type": "primary"
        }
      ]
    }
  ]
}
```

## Missing information

If required top-level fields are absent, return:

```json
{
  "needs_more_information": true,
  "missing": ["users", "runTime"]
}
```

If a valid user has no post date and no deterministic fallback was supplied, return:

```json
{
  "needs_more_information": true,
  "missing": ["users[0].postCreatedDate"]
}
```

## Examples

### Example: `parse_scoring`

Input:

```json
{
  "mode": "parse_scoring",
  "scoringResponse": {
    "candidates": [
      {
        "content": {
          "parts": [
            {
              "text": "```json\n{\"users\":[{\"username\":\"alice_dev\",\"platform\":\"reddit\",\"priority\":\"P1\",\"total_score\":6}]}\n```"
            }
          ]
        }
      }
    ]
  }
}
```

Output:

```json
{
  "users": [
    {
      "username": "alice_dev",
      "platform": "reddit",
      "priority": "P1",
      "total_score": 6
    }
  ],
  "_users": [
    {
      "username": "alice_dev",
      "platform": "reddit",
      "priority": "P1",
      "total_score": 6
    }
  ],
  "_placeholder_dropped": 0
}
```

### Example: `build_payloads`

Input:

```json
{
  "mode": "build_payloads",
  "runTime": "2026-05-10T09:15:30.000Z",
  "weekTag": "2026-W19",
  "batchId": "icp-example",
  "existingRecords": [],
  "users": [
    {
      "username": "alice_dev",
      "priority": "P0",
      "cohort": "A",
      "platform": "reddit",
      "profile_url": "https://reddit.com/user/alice_dev",
      "evidence_url": "https://reddit.com/r/selfhosted/comments/abc123/example",
      "icp_fit_score": 8,
      "evidence_wedge_fit_score": 3,
      "score_breakdown": "Claude Code + MCP config pain",
      "contact_channel": "Reddit",
      "language_timezone": "en-US / UTC-8",
      "raw_evidence": "I pasted API keys into an MCP config and hated it.",
      "recommended_action": "高触达一对一邀请",
      "post_created_date": "2026-05-10",
      "thread_role": "OP",
      "outreach_draft": "Saw your MCP config key pain. NyxID keeps raw keys out of the agent path. worth 5 min or nah?"
    }
  ]
}
```

Output shape:

```json
{
  "message_type": "icp_hunter_scoring_lark_payloads",
  "summary": "[NyxID ICP Hunter] 写入 1 条: P0=1 (1 drafted), P1=0, P2=0",
  "records": [
    {
      "fields": {
        "用户ID": "alice_dev",
        "优先级": "P0",
        "Cohort": "A",
        "当前状态": "待外联",
        "平台": "reddit",
        "Profile 链接": {
          "link": "https://reddit.com/user/alice_dev",
          "text": "https://reddit.com/user/alice_dev"
        },
        "证据链接": {
          "link": "https://reddit.com/r/selfhosted/comments/abc123/example",
          "text": "https://reddit.com/r/selfhosted/comments/abc123/example"
        },
        "总分": 8,
        "积分明细": "Claude Code + MCP config pain | wedge fit 3/5",
        "联系渠道": "Reddit DM",
        "语言/时区": "en-US / UTC-8",
        "原始证据": "I pasted API keys into an MCP config and hated it.",
        "推荐动作": "高触达一对一邀请",
        "升温状态": "冷",
        "周标签": "2026-W19",
        "筛选批次": "icp-example",
        "thread_role": "OP",
        "帖子发布日期": 1778371200000,
        "用户标识": "alice_dev@reddit",
        "规范化URL": "https://reddit.com/r/selfhosted/comments/abc123",
        "备注": "API: NyxID Proxy",
        "outreach draft": "Saw your MCP config key pain. NyxID keeps raw keys out of the agent path. worth 5 min or nah?"
      }
    }
  ],
  "createRecordPayloads": [
    {
      "resource": "base",
      "operation": "createRecord",
      "app_token": { "__rl": true, "value": "BASE_APP_TOKEN_PLACEHOLDER_2", "mode": "id" },
      "table_id": { "__rl": true, "value": "TABLE_ID_PLACEHOLDER_3", "mode": "id" },
      "body": { "fields": {} },
      "options": {}
    }
  ],
  "stats": {},
  "sendMessagePayload": {
    "resource": "message",
    "operation": "send",
    "receive_id_type": "chat_id",
    "receive_id": { "__rl": true, "value": "oc_PLACEHOLDER_CHAT_ID_1", "mode": "id" },
    "msg_type": "interactive",
    "content": "<lark_card JSON string>",
    "options": {}
  },
  "lark": {
    "base": { "createRecordPayloads": [] },
    "message": { "sendMessagePayload": {} }
  },
  "diagnostics": {}
}
```
