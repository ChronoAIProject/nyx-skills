# Tech digest contract

This contract defines deterministic behavior for `tech-digest-aggregator-payload-builder`.

## Original n8n flow

The original workflow is named `n8n信息聚合器 - Twitter- 有价值小报`.

It has these main steps:

1. A `Schedule Trigger` runs at hour `12`.
2. RSS nodes read AI news feeds from The Verge, TechCrunch, NYTimes, MIT Technology Review, VentureBeat, WIRED, OpenAI Blog, Google DeepMind Blog, ScienceDaily, 404 Media, AI Business, and Ahead of AI.
3. Twitter username input is split, `Get Tweets3` calls the Twitter API, and `Extract Info4` normalizes recent tweets.
4. Filter nodes keep items within 24 hours.
5. Gemini LLM chains translate, clean up, classify, title, and select Top10 tweets.
6. `CreateRecord base` and `CreateRecord base4` write Lark Base records.
7. `新闻小报`, `干货小报`, and `推特价值小报` build Markdown.
8. `Code in JavaScript2`, `Code in JavaScript5`, and `Code in JavaScript 推特价值` wrap Markdown into interactive card objects.
9. `Send message`, `Send message1`, and `Send message 推特价值` send Lark interactive messages.

This skill implements steps 6, 7, and 8 payload construction only. RSS fetches, Twitter API calls, 24-hour collection filtering, Lark token handling, Lark writes/sends, and all Gemini LLM calls stay in Aevatar. LLM outputs are input fields to this skill.

## Modes

| Mode | Purpose |
|---|---|
| `build_records` | Build Lark Base create-record request payloads. |
| `build_messages` | Build the three Lark interactive message payloads. |
| `build_all` | Build both records and messages. This is the default. |

The caller may pass the event body directly or wrap it in `body`. If `body` exists, read fields from `body`; otherwise read fields from the root object.

## Input aliases

Use the first non-empty value in the listed order.

| Normalized field | Source fields |
|---|---|
| `items` | `items`, `records`, `classifiedItems`, `classified_items` |
| `rssItems` | `rssItems`, `rss_items`, `newsItems`, `news_items` |
| `tweetItems` | `tweetItems`, `tweet_items`, `twitterItems`, `twitter_items` |
| `date` | `date`, `today`, `runDate`, `run_date`, `digestDate`, `digest_date` |
| `top10` | `top10`, `twitterTop10`, `twitter_top10`, `top10Output`, `top10_output`, `aiTop10`, `ai_top10`, `output`, `text`, `result`, `message` |
| `appToken` | `app_token`, `appToken`, `baseAppToken`, `base_app_token` |
| `tableId` | `table_id`, `tableId`, `baseTableId`, `base_table_id` |
| `receiveId` | `receive_id`, `receiveId`, `email`, `recipientEmail`, `recipient_email` |
| `receiveIdType` | `receive_id_type`, `receiveIdType` |

If `rssItems` or `tweetItems` are present, records and messages are built from those two arrays. If neither is present, `items` is treated as the generic item array.

## Item fields

Each item may be passed directly, as `{ "json": { ... } }`, or with an LLM result under `output`.

| Normalized field | Source fields |
|---|---|
| `标题` | `标题`, `title`, `headline` |
| `内容` | `内容`, `content`, `contentSnippet`, `text`, `summary` |
| `日期` | `日期`, `date`, `isoDate`, `createdAt`, `created_at` |
| `链接` | `链接`, `link`, `url` |
| `来源` | `来源`, `source`, `author`, `username` |
| `板块` | `板块`, `section`, `bucket` |
| `分类` | `分类`, `category` |
| `分类理由` | `分类理由`, `categoryReason`, `category_reason` |

For `tweetItems`, mirror `分类排序2`: remove `\n` and `\r` from string fields, replace `"` with `“`, and remove `\n` and `\r` from `链接`.

## Workflow literal defaults

These values come from the workflow nodes:

```json
{
  "appToken": "BASE_APP_TOKEN_PLACEHOLDER_3",
  "tableId": "TABLE_ID_PLACEHOLDER_1",
  "receiveIdType": "email",
  "receiveId": "user02@example.com"
}
```

Callers may pass real connector ids or recipients. The skill never invents them.

## Sorting and dedupe

Sort records with the workflow category order:

```json
[
  "产品发布/更新",
  "博客/研究/评论/深度报道",
  "其他（融资/社会舆论/人事变动等）"
]
```

The global digest dedupe signature is:

```text
content remove [.,/#!$%^&*;:{}=-_`~()！？。，、], remove whitespace, first 30 characters
```

Keep the first item for each signature.

## Lark Base record request

The original `CreateRecord base` and `CreateRecord base4` nodes use the same outbound fields:

```json
{
  "resource": "base",
  "operation": "createRecord",
  "app_token": {
    "__rl": true,
    "value": "BASE_APP_TOKEN_PLACEHOLDER_3",
    "mode": "id"
  },
  "table_id": {
    "__rl": true,
    "value": "TABLE_ID_PLACEHOLDER_1",
    "mode": "id"
  },
  "body": {
    "fields": {
      "标题": "<标题>",
      "内容": "<内容>",
      "日期": "<YYYY-MM-DD>",
      "链接": {
        "text": "原文链接",
        "link": "<链接 with newline removed>"
      },
      "来源": "<来源>",
      "板块": "<板块>",
      "分类": "<分类>",
      "分类理由": "<分类理由 or empty string>"
    }
  },
  "options": {
    "ignore_consistency_check": true
  }
}
```

`日期` is normalized to `YYYY-MM-DD`. If an item has no date, `date` is used as the fallback. If an item lacks `日期` and `date` is also missing, return:

```json
{
  "needs_more_information": true,
  "missing": ["date"]
}
```

## Lark interactive card

The wrapper code nodes build this exact card object:

```json
{
  "elements": [
    {
      "tag": "markdown",
      "content": "<markdown>"
    }
  ]
}
```

The Lark message nodes then set `content` to `JSON.stringify(card)`.

## Lark message request

The three message nodes use these outbound fields:

```json
{
  "resource": "message",
  "operation": "send",
  "receive_id_type": "email",
  "receive_id": "user02@example.com",
  "msg_type": "interactive",
  "content": "<card JSON string>",
  "options": {}
}
```

## AI资讯小报 Markdown

Use only items whose `分类` is one of:

```json
[
  "产品发布/更新",
  "行业资讯",
  "视频",
  "其他（融资/社会舆论/人事变动等）"
]
```

Group by `板块`. Start with:

```text
# <date> AI资讯小报
```

Sections are emitted in this order when present:

1. `明星公司动态`: group by `来源`, then each row is `- <内容>\n<链接>`.
2. `新闻`: each row is `- 《<来源>》：<标题>\n <内容>\n<链接>`.
3. `大佬动态`: group by `来源`, then each row is `- <内容>\n<链接>`.
4. `油管博主`: each row is `- 《<来源>》：<标题>\n<链接>`.

If no section has content, append `今日无资讯。`.

## AI干货小报 Markdown

Use only items whose `分类` is one of:

```json
[
  "博客/研究/评论/深度报道",
  "技术/经验/观点分享"
]
```

Start with:

```text
# <date> AI干货小报
```

Sections are emitted in this order when present:

1. `明星公司动态`
2. `大佬动态`
3. `新闻`

Formatting inside those sections matches the workflow code. If no section has content, append `今日无精选干货。`.

## 推特价值小报 Markdown

`top10` is the output from the `AI选Top10` LLM step. It may be a JSON array or a string containing a JSON array, including a fenced JSON code block.

If no array can be parsed, return:

```text
# 推特价值小报

今日暂无精选内容。
```

Otherwise start with:

```text
# <date> 推特价值小报

> 从推文中精选最有价值的 10 条
```

For each item:

```text
## <1-based index>. <标题 or 内容, first 60 chars>

<内容, first 150 chars><... if truncated>

💡 **推荐理由**：<推荐理由>

**来源**：<来源>  |[原文](<链接>)

---
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
  "lark": {
    "createRecordRequests": []
  }
}
```

`build_messages` returns:

```json
{
  "message_type": "lark_interactive_messages",
  "messages": [
    {
      "name": "AI资讯小报",
      "workflowNode": "Send message",
      "markdown": "",
      "card": {},
      "lark_card": "{}"
    },
    {
      "name": "AI干货小报",
      "workflowNode": "Send message1",
      "markdown": "",
      "card": {},
      "lark_card": "{}"
    },
    {
      "name": "推特价值小报",
      "workflowNode": "Send message 推特价值",
      "markdown": "",
      "card": {},
      "lark_card": "{}"
    }
  ],
  "lark": {
    "sendMessages": []
  }
}
```

`build_all` returns:

```json
{
  "message_type": "tech_digest_lark_payloads",
  "records": [],
  "messages": [],
  "lark": {
    "createRecordRequests": [],
    "sendMessages": []
  }
}
```

If `items`, `rssItems`, and `tweetItems` are all missing:

```json
{
  "needs_more_information": true,
  "missing": ["items"]
}
```

If `build_messages` or `build_all` lacks `date`:

```json
{
  "needs_more_information": true,
  "missing": ["date"]
}
```

## Example: build_records

Input:

```json
{
  "mode": "build_records",
  "date": "2026-06-04",
  "rssItems": [
    {
      "标题": "OpenAI releases example",
      "内容": "OpenAI released a new model update.",
      "日期": "2026-06-04T01:00:00.000Z",
      "链接": "https://example.com/openai",
      "来源": "OpenAI Blog",
      "板块": "明星公司动态",
      "分类": "产品发布/更新"
    }
  ]
}
```

Output contains:

```json
{
  "message_type": "lark_base_records",
  "records": [
    {
      "fields": {
        "标题": "OpenAI releases example",
        "内容": "OpenAI released a new model update.",
        "日期": "2026-06-04",
        "链接": {
          "text": "原文链接",
          "link": "https://example.com/openai"
        },
        "来源": "OpenAI Blog",
        "板块": "明星公司动态",
        "分类": "产品发布/更新",
        "分类理由": ""
      }
    }
  ]
}
```

## Example: build_messages

Input:

```json
{
  "mode": "build_messages",
  "date": "2026-06-04",
  "rssItems": [
    {
      "标题": "OpenAI releases example",
      "内容": "OpenAI released a new model update.",
      "日期": "2026-06-04",
      "链接": "https://example.com/openai",
      "来源": "OpenAI Blog",
      "板块": "明星公司动态",
      "分类": "产品发布/更新"
    },
    {
      "标题": "Research analysis",
      "内容": "A detailed research review.",
      "日期": "2026-06-04",
      "链接": "https://example.com/research",
      "来源": "MIT Technology Review",
      "板块": "新闻",
      "分类": "博客/研究/评论/深度报道"
    }
  ],
  "top10": [
    {
      "idx": 0,
      "标题": "New AI tool",
      "内容": "A builder shared a useful AI workflow.",
      "来源": "JamesAI",
      "链接": "https://x.com/example/status/1",
      "推荐理由": "有实操价值"
    }
  ]
}
```

Output contains three `lark.sendMessages` entries. The first entry has:

```json
{
  "resource": "message",
  "operation": "send",
  "receive_id_type": "email",
  "receive_id": "user02@example.com",
  "msg_type": "interactive",
  "options": {}
}
```

## Example: build_all

Input:

```json
{
  "mode": "build_all",
  "date": "2026-06-04",
  "rssItems": [
    {
      "标题": "OpenAI releases example",
      "内容": "OpenAI released a new model update.",
      "日期": "2026-06-04",
      "链接": "https://example.com/openai",
      "来源": "OpenAI Blog",
      "板块": "明星公司动态",
      "分类": "产品发布/更新"
    }
  ],
  "tweetItems": [
    {
      "标题": "New AI tool",
      "内容": "A builder shared a useful AI workflow.",
      "日期": "2026-06-04",
      "链接": "https://x.com/example/status/1",
      "来源": "JamesAI",
      "板块": "AI领域博主",
      "分类": "博客/研究/评论/深度报道",
      "分类理由": "分享实操经验"
    }
  ],
  "top10": [
    {
      "idx": 0,
      "标题": "New AI tool",
      "内容": "A builder shared a useful AI workflow.",
      "来源": "JamesAI",
      "链接": "https://x.com/example/status/1",
      "推荐理由": "有实操价值"
    }
  ]
}
```

Output contains:

```json
{
  "message_type": "tech_digest_lark_payloads",
  "lark": {
    "createRecordRequests": [],
    "sendMessages": []
  }
}
```
