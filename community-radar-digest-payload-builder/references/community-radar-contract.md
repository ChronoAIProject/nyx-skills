# Community radar contract

This contract defines deterministic behavior for `community-radar-digest-payload-builder`.

## Original n8n flow

The original workflow is `NyxID Community Radar V2.6.2`.

1. It starts from a schedule trigger with cron `0 9 * * *` or from a manual trigger.
2. It builds an RSS source list.
3. It fetches RSS feeds.
4. It filters and normalizes RSS entries.
5. It reads existing Lark Base radar records and deduplicates by URL.
6. It enriches threads by calling Reddit, Discourse, or Hacker News endpoints.
7. It calls a NyxID-proxied LLM wedge filter and keeps `yes` or `maybe`.
8. It classifies, scores, and sets action status.
9. It maps each item to Lark Base fields.
10. It writes each record to Lark Base.
11. It builds output stats and sends one Lark interactive digest card.

This skill implements steps 8 through 11 payload construction only. RSS fetch, existing-record reads, deduplication inputs, enrichment fetches, LLM calls, Lark token exchange, Lark Base writes, and Lark message sends stay in Aevatar.

## Input shape

The caller may pass input directly or wrap it in `body`. If `body` exists, read fields from `body`; otherwise read fields from the root object.

The caller may pass n8n-style items as `{ "json": { ... } }`; the script unwraps `json`.

## Modes

Accepted `mode` values:

| Mode | Purpose |
|---|---|
| `build_records` | Build one Lark Base create-record payload per valid radar item. |
| `build_digest` | Build the final Lark interactive message payload from already-written record fields. |
| `build_all` | Build records, then compute the digest from those records. This is the default. |

Aliases:

| Canonical value | Accepted aliases |
|---|---|
| `build_records` | `records`, `base_records` |
| `build_digest` | `digest`, `card` |

## Top-level field aliases

Use the first non-empty value in the listed order.

| Normalized field | Source fields |
|---|---|
| `items` | `items`, `records`, `radarItems`, `radar_items`, `written`, `writtenRecords`, `written_records` |
| `runTime` | `run_time`, `runTime`, `executedAt`, `executed_at` |
| `appToken` | `app_token`, `appToken`, `baseAppToken`, `base_app_token` |
| `tableId` | `table_id`, `tableId`, `radarTableId`, `radar_table_id` |
| `chatId` | `chat_id`, `chatId`, `receive_id`, `receiveId` |
| `cardUrl` | `cardUrl`, `card_url`, `tableUrl`, `table_url`, `baseUrl`, `base_url` |

`runTime` is required for `build_digest` and `build_all`. The script never calls `Date.now()` or `new Date()` for the run timestamp. It only formats the timestamp string supplied by the caller.

## Workflow literal placeholders

When connector identifiers are not supplied, the script uses only the literal placeholders present in the exported workflow:

```json
{
  "appToken": "BASE_APP_TOKEN_PLACEHOLDER_2",
  "tableId": "TABLE_ID_PLACEHOLDER_2",
  "chatId": "oc_PLACEHOLDER_CHAT_ID_1",
  "cardUrl": "https://aelfblockchain.sg.larksuite.com/base/BASE_APP_TOKEN_PLACEHOLDER_2?table=TABLE_ID_PLACEHOLDER_2"
}
```

These are not real tokens or ids. Aevatar should supply real connector ids when sending.

## Radar item input fields

`build_records` and `build_all` expect each item to already contain the collected, enriched, classified, and LLM-judged data that remains after Aevatar has done I/O work.

Required per item:

| Field | Meaning |
|---|---|
| `title` | Thread title. |
| `url` | Thread URL. |
| `platform` | Source platform. |

If `_empty` is true, or `title`, `url`, or `platform` is missing, the item is skipped and no Lark Base record is built.

Optional per item fields used by the original mapping:

| Field | Output use |
|---|---|
| `category` | Lark field `类别`. |
| `cohort` | Lark field `Cohort`, restricted to `A`, `B`, `A+B`, `partner`, `unknown`; otherwise `unknown`. |
| `freshness` | Lark field `新鲜度`; defaults to `MONITOR` when empty. |
| `angle_code` | Lark field `Angle`, using the exact workflow map below. |
| `matchedKeywords` | Lark field `关键词命中`; arrays join with `, `. |
| `excerpt` | Lark field `摘要` when `op_body` is absent or short. |
| `op_body` | If longer than 30 chars, `摘要` starts with `[OP body] `. |
| `reply_draft` | The original flow clears this to empty before mapping. |
| `cta` | Lark field `CTA`. |
| `batch_id` | Lark field `批次ID`. |
| `relevance_score` | Lark field `相关度`; defaults to `0` unless it is a number. |
| `quality_score` | Lark field `帖子质量分` when it is a number. |
| `pubDate` | Lark field `帖子发布日期` as epoch milliseconds parsed from the supplied date string. |
| `traction` | Adds metadata to `摘要`. |
| `hoursAgo` | Adds `age=<hours>h` to metadata when number. |
| `op_class` | Used for action status and `OP=<value>` metadata. |
| `accepted_answer` | Adds `acc_ans=true` metadata when truthy. |
| `top_comment_score` | Adds `top_c=<value>` metadata when truthy. |
| `enrichment_status` | Used for action status and metadata. |
| `llm_verdict` | Adds `llm=<value>` metadata; this is LLM output supplied by Aevatar. |
| `matchedTier` | Adds `tier=<value>` metadata. |

## Angle names

The Lark field `Angle` is:

```text
<angle_code>-<angleName>
```

Map:

```json
{
  "A": "NAT pierce",
  "B": "MCP auto-wrap",
  "C": "Credential injection",
  "D": "Open-source",
  "E": "Cross-platform",
  "F": "Smart Home Integration",
  "G": "HA + AI bridge",
  "X": "Unclassified",
  "P": "Peer Help"
}
```

If `angle_code` is absent, `Angle` is an empty string.

## Action status

Before mapping to Lark fields, the original flow sets:

```json
{
  "reply_draft": "",
  "action_status": "<computed>"
}
```

Compute `action_status` exactly:

1. If `op_class` is `noob` or `expert`, use `MONITOR`.
2. Else if `enrichment_status` ends with `-ok` and:
   - `platform` is `Reddit`, `hoursAgo` is greater than `6`, and `traction.ups` and `traction.comments` are both zero, use `MONITOR`.
   - `platform` is `n8n Forum` or `HA Forum`, `hoursAgo` is greater than `6`, and `traction.views` is less than `10`, use `MONITOR`.
3. Else if numeric `quality_score` is less than or equal to `3`, use `MONITOR`.
4. Else if `freshness` is `ACT NOW` or `ACT TODAY`, enrichment is ok, and `op_class` is `builder` or `unknown`, use `待回复`.
5. Else if `freshness` is `ACT NOW` or `ACT TODAY` and enrichment is not ok, use `MONITOR`.
6. Else use `MONITOR`.

The Lark field `行动状态` accepts only `待回复`, `已回复`, `跳过`, `MONITOR`, `草稿已备`; otherwise it falls back to `跳过`.

## Lark Base fields

For each valid radar item, build `fields` exactly:

```json
{
  "标题": "<title>",
  "URL": { "link": "<url>", "text": "<title or url>" },
  "平台": "<platform>",
  "类别": "<category>",
  "Cohort": "<safe cohort>",
  "新鲜度": "<freshness or MONITOR>",
  "Angle": "<angle code and name, or empty string>",
  "关键词命中": "<matched keywords>",
  "摘要": "<excerpt or OP body plus metadata>",
  "回复草稿": "",
  "CTA": "<cta>",
  "行动状态": "<safe action status>",
  "批次ID": "<batch id>",
  "相关度": 0,
  "帖子质量分": 7,
  "规范化URL": "<normalized URL>",
  "帖子发布日期": 1770000000000
}
```

Remove only fields whose value is `undefined`. Empty strings remain, matching the workflow.

URL normalization:

1. Parse as URL when possible.
2. For Reddit paths matching `/r/<sub>/comments/<id>`, keep only that path.
3. Return `origin + path`, remove trailing slash, lowercase.
4. If URL parsing fails, remove query string, fragment, trailing slash, then lowercase.

Metadata appended to `摘要`:

```text

[META V2.1] ups=<ups> | c=<comments> | hn_score=<score> | v=<views> | posts=<posts> | p=<participants> | age=<hoursAgo>h | OP=<op_class> | acc_ans=true | top_c=<top_comment_score> | enrich=<enrichment_status> | llm=<llm_verdict> | tier=<matchedTier>
```

Only present metadata parts are included. `enrich=<enrichment_status>` is omitted when the status is `reddit-ok`, `forum-ok`, or `hn-ok`.

## Lark Base create-record request

The original Lark node is:

```json
{
  "resource": "base",
  "operation": "createRecord",
  "app_token": {
    "__rl": true,
    "value": "BASE_APP_TOKEN_PLACEHOLDER_2",
    "mode": "id"
  },
  "table_id": {
    "__rl": true,
    "value": "TABLE_ID_PLACEHOLDER_2",
    "mode": "id"
  },
  "body": "={{ JSON.stringify({ fields: $json.fields }) }}",
  "options": {}
}
```

This skill returns one request per record:

```json
{
  "resource": "base",
  "operation": "createRecord",
  "app_token": {
    "__rl": true,
    "value": "<appToken>",
    "mode": "id"
  },
  "table_id": {
    "__rl": true,
    "value": "<tableId>",
    "mode": "id"
  },
  "body": {
    "fields": {}
  },
  "body_json": "{\"fields\":{}}",
  "options": {}
}
```

`body_json` is the exact string form n8n used in the original node expression.

## Digest stats

`build_digest` reads each item as `item.fields` when present; otherwise it reads the item itself.

For each written record:

| Counter | Rule |
|---|---|
| `act_now` | `新鲜度` or `freshness` equals `ACT NOW`. |
| `act_today` | `新鲜度` or `freshness` equals `ACT TODAY`. |
| `monitor` | Every other record. |
| `categories` | Count by `类别` or `category`, including empty string. |
| `platforms` | Count by `平台` or `platform`, including empty string. |
| `drafts_generated` | `回复草稿` or `reply_draft` length is greater than `10` and does not start with `[`. |

Build summary exactly:

```text
[Community Radar] <total> items: <act_now> ACT NOW, <act_today> ACT TODAY, <monitor> MONITOR | <drafts_generated> drafts
```

## Lark interactive card

Build `lark_card` as `JSON.stringify(card)` with this card shape:

```json
{
  "header": {
    "title": {
      "tag": "plain_text",
      "content": "📡 NyxID Community Radar"
    },
    "template": "green"
  },
  "elements": [
    {
      "tag": "div",
      "fields": [
        {
          "is_short": true,
          "text": {
            "tag": "lark_md",
            "content": "**📊 命中总数**\n<total> 条"
          }
        },
        {
          "is_short": true,
          "text": {
            "tag": "lark_md",
            "content": "**📅 运行时间**\n<runTime first 19 chars, T replaced by space>"
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
            "content": "**🔴 ACT NOW**\n<act_now> 条"
          }
        },
        {
          "is_short": true,
          "text": {
            "tag": "lark_md",
            "content": "**🟡 ACT TODAY**\n<act_today> 条"
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
            "content": "**⚪ MONITOR**\n<monitor> 条"
          }
        },
        {
          "is_short": true,
          "text": {
            "tag": "lark_md",
            "content": "**✏️ 草稿生成**\n<drafts_generated> 条"
          }
        }
      ]
    },
    { "tag": "hr" },
    {
      "tag": "div",
      "text": {
        "tag": "lark_md",
        "content": "**📂 类别:** <category counts joined by ` | `>"
      }
    },
    {
      "tag": "div",
      "text": {
        "tag": "lark_md",
        "content": "**📍 平台:** <platform counts joined by ` | `>"
      }
    },
    { "tag": "hr" },
    {
      "tag": "action",
      "actions": [
        {
          "tag": "button",
          "text": {
            "tag": "plain_text",
            "content": "📋 打开 NyxID Community Radar 表"
          },
          "url": "<cardUrl>",
          "type": "primary"
        }
      ]
    }
  ]
}
```

## Lark message request

The original Lark message node is:

```json
{
  "resource": "message",
  "operation": "send",
  "receive_id_type": "chat_id",
  "receive_id": "oc_PLACEHOLDER_CHAT_ID_1",
  "msg_type": "interactive",
  "content": "={{ $json.lark_card }}",
  "options": {}
}
```

This skill returns:

```json
{
  "resource": "message",
  "operation": "send",
  "receive_id_type": "chat_id",
  "receive_id": "<chatId>",
  "msg_type": "interactive",
  "content": "<lark_card JSON string>",
  "options": {}
}
```

## Output shapes

`build_records` returns:

```json
{
  "message_type": "lark_base_records",
  "records": [
    {
      "fields": {}
    }
  ],
  "dropped_empty": 0,
  "lark": {
    "createRecordRequests": []
  }
}
```

`build_digest` returns:

```json
{
  "message_type": "lark_interactive_message",
  "summary": "[Community Radar] 1 items: 1 ACT NOW, 0 ACT TODAY, 0 MONITOR | 0 drafts",
  "stats": {},
  "card": {},
  "lark_card": "{}",
  "lark": {
    "sendMessage": {}
  }
}
```

`build_all` returns:

```json
{
  "message_type": "community_radar_lark_payloads",
  "records": [],
  "dropped_empty": 0,
  "stats": {},
  "card": {},
  "lark_card": "{}",
  "lark": {
    "createRecordRequests": [],
    "sendMessage": {}
  }
}
```

If `items` is missing:

```json
{
  "needs_more_information": true,
  "missing": ["items"]
}
```

If `runTime` is missing in `build_digest` or `build_all`:

```json
{
  "needs_more_information": true,
  "missing": ["runTime"]
}
```

If no valid record can be built:

```json
{
  "skip": true,
  "reason": "no valid radar records",
  "dropped_empty": 1,
  "records": [],
  "lark": {
    "createRecordRequests": []
  }
}
```

## Example: build_records

Input:

```json
{
  "mode": "build_records",
  "appToken": "BASE_APP_TOKEN_PLACEHOLDER_2",
  "tableId": "TABLE_ID_PLACEHOLDER_2",
  "items": [
    {
      "title": "Need scoped API keys for multiple agents",
      "url": "https://www.reddit.com/r/AI_Agents/comments/abc123/need_scoped_api_keys/?utm_source=rss",
      "platform": "Reddit",
      "category": "Credential Pain",
      "cohort": "A",
      "freshness": "ACT NOW",
      "angle_code": "C",
      "matchedKeywords": ["api key", "multiple agents"],
      "excerpt": "I am rotating keys across agent tools.",
      "cta": "Repo's public, roast welcome.",
      "batch_id": "radar-2026-06-04",
      "relevance_score": 8,
      "quality_score": 7,
      "pubDate": "2026-06-04T00:15:00.000Z",
      "traction": { "ups": 12, "comments": 4 },
      "hoursAgo": 2,
      "op_class": "builder",
      "enrichment_status": "reddit-ok",
      "llm_verdict": "yes",
      "matchedTier": "TIER2-cred"
    }
  ]
}
```

Output excerpt:

```json
{
  "message_type": "lark_base_records",
  "records": [
    {
      "fields": {
        "标题": "Need scoped API keys for multiple agents",
        "URL": {
          "link": "https://www.reddit.com/r/AI_Agents/comments/abc123/need_scoped_api_keys/?utm_source=rss",
          "text": "Need scoped API keys for multiple agents"
        },
        "平台": "Reddit",
        "类别": "Credential Pain",
        "Cohort": "A",
        "新鲜度": "ACT NOW",
        "Angle": "C-Credential injection",
        "关键词命中": "api key, multiple agents",
        "行动状态": "待回复",
        "规范化URL": "https://www.reddit.com/r/ai_agents/comments/abc123"
      }
    }
  ]
}
```

## Example: build_digest

Input:

```json
{
  "mode": "build_digest",
  "runTime": "2026-06-04T09:00:00.000Z",
  "chatId": "oc_PLACEHOLDER_CHAT_ID_1",
  "cardUrl": "https://aelfblockchain.sg.larksuite.com/base/BASE_APP_TOKEN_PLACEHOLDER_2?table=TABLE_ID_PLACEHOLDER_2",
  "items": [
    {
      "fields": {
        "标题": "Need scoped API keys for multiple agents",
        "平台": "Reddit",
        "类别": "Credential Pain",
        "新鲜度": "ACT NOW",
        "回复草稿": "",
        "行动状态": "待回复"
      }
    }
  ]
}
```

Output excerpt:

```json
{
  "message_type": "lark_interactive_message",
  "summary": "[Community Radar] 1 items: 1 ACT NOW, 0 ACT TODAY, 0 MONITOR | 0 drafts",
  "lark": {
    "sendMessage": {
      "resource": "message",
      "operation": "send",
      "receive_id_type": "chat_id",
      "receive_id": "oc_PLACEHOLDER_CHAT_ID_1",
      "msg_type": "interactive",
      "content": "{\"header\":{\"title\":{\"tag\":\"plain_text\",\"content\":\"📡 NyxID Community Radar\"},\"template\":\"green\"},\"elements\":[...]}",
      "options": {}
    }
  }
}
```

## Example: build_all

Input:

```json
{
  "mode": "build_all",
  "runTime": "2026-06-04T09:00:00.000Z",
  "items": [
    {
      "title": "Need scoped API keys for multiple agents",
      "url": "https://www.reddit.com/r/AI_Agents/comments/abc123/need_scoped_api_keys/?utm_source=rss",
      "platform": "Reddit",
      "category": "Credential Pain",
      "cohort": "A",
      "freshness": "ACT NOW",
      "angle_code": "C",
      "matchedKeywords": ["api key", "multiple agents"],
      "excerpt": "I am rotating keys across agent tools.",
      "cta": "Repo's public, roast welcome.",
      "batch_id": "radar-2026-06-04",
      "relevance_score": 8,
      "quality_score": 7,
      "pubDate": "2026-06-04T00:15:00.000Z",
      "traction": { "ups": 12, "comments": 4 },
      "hoursAgo": 2,
      "op_class": "builder",
      "enrichment_status": "reddit-ok",
      "llm_verdict": "yes",
      "matchedTier": "TIER2-cred"
    }
  ]
}
```

Output excerpt:

```json
{
  "message_type": "community_radar_lark_payloads",
  "records": [
    {
      "fields": {
        "标题": "Need scoped API keys for multiple agents"
      }
    }
  ],
  "lark": {
    "createRecordRequests": [
      {
        "resource": "base",
        "operation": "createRecord"
      }
    ],
    "sendMessage": {
      "resource": "message",
      "operation": "send",
      "msg_type": "interactive"
    }
  }
}
```
