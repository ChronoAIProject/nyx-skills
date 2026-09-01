# Weekly goal audit contract

This contract defines deterministic behavior for `cho-weekly-goal-audit-payload-builder`.

## Original n8n flow

The original workflow:

1. Receives a Lark webhook event at `lark-weekly-goal-audit`.
2. Handles Lark URL verification and quick OK webhook responses.
3. Parses text, post, or file messages into weekly goals.
4. Downloads PDFs and asks Gemini/PDFco to extract text when needed.
5. Asks Gemini to audit weekly goals, then writes a Lark Base record and sends the employee a Lark message.
6. For weekend review messages, searches Lark Base for the latest weekly goal, asks Gemini for review analysis, updates the Base record, sends the employee a reply, and sends CHO a diagnosis message.

This skill implements the deterministic event parsing and payload construction only. Token exchange, PDF download, OCR, Base reads/writes, Gemini calls, Lark sends, and NyxID connector submission stay in Aevatar.

## Global constants copied from the workflow

```json
{
  "app_token": "BASE_APP_TOKEN_PLACEHOLDER_1",
  "table_id": "TABLE_ID_PLACEHOLDER_4",
  "defaultChoOpenId": "ou_PLACEHOLDER_OPEN_ID_1"
}
```

## Mode: parse_event

Read the event body from `input.body` when present; otherwise use the root input.

Accepted metadata aliases:

| Normalized field | Source fields |
|---|---|
| `weekKey` | `weekKey`, `week_key` |
| `submitTime` | `submitTime`, `submit_time` |
| `attemptId` | `attemptId`, `attempt_id` |
| `botOpenId` | `botOpenId`, `bot_open_id` |
| `botUserId` | `botUserId`, `bot_user_id` |
| `botUnionId` | `botUnionId`, `bot_union_id` |

For deterministic output, the caller must pass `weekKey`, `submitTime`, and `attemptId`. The original n8n flow generated these from runtime date/random state; this skill does not.

If `body.type` is `url_verification` and `body.challenge` exists, return:

```json
{
  "skip": true,
  "isChallenge": true,
  "challenge": "challenge-token",
  "webhookResponse": {
    "responseCode": 200,
    "body": { "challenge": "challenge-token" }
  }
}
```

For a handled message, return normalized fields including:

```json
{
  "skip": false,
  "isMessageEvent": true,
  "openId": "ou_employee",
  "employeeDisplayName": "Wang Shining",
  "employeeEmail": "user25@example.com",
  "employeeUserId": "6816bcb1",
  "goalText": "1. 本周五前上线 Aevatar Quickstart 并完成 3 个外部用户验证",
  "goalTextNormalized": "1. 本周五前上线 Aevatar Quickstart 并完成 3 个外部用户验证",
  "goalsForAudit": [
    {
      "id": 1,
      "original": "本周五前上线 Aevatar Quickstart 并完成 3 个外部用户验证"
    }
  ],
  "messageId": "om_message",
  "weekKey": "2026-W23",
  "submitTime": "2026-06-04T10:00:00.000Z",
  "attemptId": "attempt-001",
  "intent": "audit",
  "webhookResponse": {
    "responseCode": 200,
    "body": { "code": 0, "msg": "ok" }
  }
}
```

Non-target events return `skip: true` with a `reason`.

Example input:

```json
{
  "mode": "parse_event",
  "weekKey": "2026-W23",
  "submitTime": "2026-06-04T10:00:00.000Z",
  "attemptId": "attempt-001",
  "body": {
    "header": {
      "event_type": "im.message.receive_v1",
      "event_id": "ev_1"
    },
    "event": {
      "sender": {
        "sender_type": "user",
        "sender_id": {
          "open_id": "ou_employee",
          "user_id": "6816bcb1"
        }
      },
      "message": {
        "message_id": "om_message",
        "message_type": "text",
        "chat_type": "p2p",
        "content": "{\"text\":\"1. 本周五前上线 Aevatar Quickstart 并完成 3 个外部用户验证\"}"
      }
    }
  }
}
```

## Mode: build_review_search

Required input aliases:

| Normalized field | Source fields |
|---|---|
| `openId` | `openId`, `open_id` |
| `weekKey` | `weekKey`, `week_key` |

Return the Lark Base `searchRecords` payload equivalent to the workflow node `检索最新版周目标`:

```json
{
  "message_type": "cho_weekly_goal_review_search",
  "lark": {
    "searchRecords": {
      "resource": "base",
      "operation": "searchRecords",
      "app_token": {
        "__rl": true,
        "value": "BASE_APP_TOKEN_PLACEHOLDER_1",
        "mode": "id"
      },
      "table_id": {
        "__rl": true,
        "value": "TABLE_ID_PLACEHOLDER_4",
        "mode": "id"
      },
      "body": {
        "filter": {
          "conjunction": "and",
          "conditions": [
            {
              "field_name": "员工OpenID",
              "operator": "is",
              "value": ["ou_employee"]
            },
            {
              "field_name": "周次",
              "operator": "is",
              "value": ["2026-W23"]
            }
          ]
        }
      },
      "options": {}
    }
  }
}
```

Example input:

```json
{
  "mode": "build_review_search",
  "openId": "ou_employee",
  "weekKey": "2026-W23"
}
```

## Mode: build_audit_payloads

Required input aliases:

| Normalized field | Source fields |
|---|---|
| `openId` | `openId`, `open_id` |
| `weekKey` | `weekKey`, `week_key` |
| `submitTime` | `submitTime`, `submit_time` |
| `attemptId` | `attemptId`, `attempt_id` |
| `goalText` | `goalText`, `goal_text` |
| `goalsForAudit` | `goalsForAudit` |
| `auditOutput` | `auditOutput`, `audit_output`, `llmOutput`, `llm_output`, `modelOutput`, `model_output` |

Optional input aliases:

| Normalized field | Source fields |
|---|---|
| `translatedReply` | `translatedReply`, `translated_reply`, `finalReply`, `final_reply` |
| `translationOutput` | `translationOutput`, `translation_output`, `translationResult`, `translation_result` |

`auditOutput` is the already-returned Gemini audit output. If Aevatar ran the translation LLM for English goals, pass the translated text through `translatedReply` or `translationOutput`; the skill does not call Gemini.

The Base fields are built exactly like `组装多维表字段`:

```json
{
  "员工OpenID": "ou_employee",
  "员工标识": "Wang Shining <user25@example.com>",
  "周次": "2026-W23",
  "版本ID": "attempt-001",
  "消息ID": "om_message",
  "原始周目标": "1. 本周五前上线 Aevatar Quickstart 并完成 3 个外部用户验证",
  "审计全文": "已收到你的本周目标（2026-W23）。\n...",
  "提交时间": 1780567200000,
  "审计分数": 8,
  "价值主维度": ["收入创造", "长期资产"],
  "目标类型占比": "Structure Move 100% / Revenue Move 0% / Risk Control Move 0%",
  "维护型占比": "0%"
}
```

Return shape:

```json
{
  "message_type": "cho_weekly_goal_audit_payloads",
  "audit": {
    "auditText": "已收到你的本周目标（2026-W23）。\n...",
    "score": 8,
    "larkReply": "已收到你的本周目标（2026-W23）。\n...\n\n---\n请根据优化建议修改后再次发送给机器人；每次提交都会重新评分并保留历史记录。"
  },
  "bitableBody": {
    "fields": {}
  },
  "lark": {
    "employeeMessage": {
      "resource": "message",
      "operation": "send",
      "receive_id": {
        "__rl": true,
        "mode": "id",
        "value": "ou_employee"
      },
      "content": {
        "text": "..."
      },
      "options": {}
    },
    "createRecord": {
      "resource": "base",
      "operation": "createRecord",
      "app_token": {
        "__rl": true,
        "value": "BASE_APP_TOKEN_PLACEHOLDER_1",
        "mode": "id"
      },
      "table_id": {
        "__rl": true,
        "value": "TABLE_ID_PLACEHOLDER_4",
        "mode": "id"
      },
      "body": {
        "fields": {}
      },
      "options": {}
    }
  }
}
```

Example input:

```json
{
  "mode": "build_audit_payloads",
  "openId": "ou_employee",
  "employeeDisplayName": "Wang Shining",
  "employeeEmail": "user25@example.com",
  "employeeUserId": "6816bcb1",
  "weekKey": "2026-W23",
  "submitTime": "2026-06-04T10:00:00.000Z",
  "attemptId": "attempt-001",
  "messageId": "om_message",
  "goalText": "1. 本周五前上线 Aevatar Quickstart 并完成 3 个外部用户验证",
  "goalTextNormalized": "1. 本周五前上线 Aevatar Quickstart 并完成 3 个外部用户验证",
  "goalsForAudit": [
    {
      "id": 1,
      "original": "本周五前上线 Aevatar Quickstart 并完成 3 个外部用户验证"
    }
  ],
  "auditOutput": {
    "score": 8,
    "highlights": ["目标有明确外部用户验证方向。"],
    "redFlags": ["仍需补充验收链接或用户名单。"],
    "items": [
      {
        "id": 1,
        "violations": [],
        "reason": "目标绑定外部用户验证，具备业务结果导向。",
        "rewrite": "请补充 3 个外部用户的来源、验证口径和验收截图链接。",
        "valueDimensions": ["收入创造", "长期资产"]
      }
    ],
    "choNote": "方向正确，请把验收证据钉死。"
  }
}
```

## Mode: build_review_payloads

Required input aliases:

| Normalized field | Source fields |
|---|---|
| `openId` | `openId`, `open_id` |
| `employeeDisplayName` | `employeeDisplayName`, `employee_display_name`, `employeeName`, `employee_name` |
| `goalText` | `goalText`, `goal_text` |
| `recordId` | `recordId`, `record_id` |
| `reviewOutput` | `reviewOutput`, `review_output`, `llmOutput`, `llm_output`, `modelOutput`, `model_output` |

If `recordId` is not passed directly, the skill may read the last record from `records`, `searchRecordsResult`, `search_records_result`, `searchResult`, or `search_result`. This mirrors `提取目标记录`.

Optional input aliases:

| Normalized field | Source fields |
|---|---|
| `choOpenId` | `choOpenId`, `cho_open_id` |

Default `choOpenId` is the workflow placeholder `ou_PLACEHOLDER_OPEN_ID_1`.

`reviewOutput` is the already-returned Gemini review output. The skill parses and sanitizes it, then builds `reviewFields` exactly like `解析复盘结果`:

```json
{
  "周末总结原文": "本周已完成 Quickstart 上线，并拿到 3 个外部用户反馈",
  "目标完成状态": "已交付",
  "组织阻力": "无",
  "隐藏成就": "发现文档入口问题",
  "辅导建议": "CHO 诊断文本"
}
```

Return shape:

```json
{
  "message_type": "cho_weekly_goal_review_payloads",
  "recordId": "rec_1",
  "employeeEcho": "给员工的复盘回响",
  "choInsight": "给 CHO 的个体动能诊断书",
  "reviewFields": {},
  "lark": {
    "updateRecord": {
      "resource": "base",
      "operation": "updateRecord",
      "app_token": {
        "__rl": true,
        "value": "BASE_APP_TOKEN_PLACEHOLDER_1",
        "mode": "id"
      },
      "table_id": {
        "__rl": true,
        "value": "TABLE_ID_PLACEHOLDER_4",
        "mode": "id"
      },
      "record_id": "rec_1",
      "body": {
        "fields": {}
      },
      "options": {}
    },
    "employeeMessage": {
      "resource": "message",
      "operation": "send",
      "receive_id": {
        "__rl": true,
        "mode": "id",
        "value": "ou_employee"
      },
      "content": {
        "text": "【周末复盘回响】\n\n给员工的复盘回响"
      },
      "options": {}
    },
    "choMessage": {
      "resource": "message",
      "operation": "send",
      "receive_id": {
        "__rl": true,
        "value": "ou_PLACEHOLDER_OPEN_ID_1",
        "mode": "id"
      },
      "content": "{\"text\":\"🚨【微观即时探针 - 个体动能诊断书】\\n\\n员工：Wang Shining\\n\\n给 CHO 的个体动能诊断书\"}",
      "options": {}
    }
  }
}
```

Example input:

```json
{
  "mode": "build_review_payloads",
  "openId": "ou_employee",
  "employeeDisplayName": "Wang Shining",
  "goalText": "本周已完成 Quickstart 上线，并拿到 3 个外部用户反馈",
  "recordId": "rec_1",
  "reviewOutput": {
    "status": "已交付",
    "blockers": "无",
    "hiddenWins": "发现文档入口问题",
    "employeeEcho": "你这周把 Quickstart 上线并拿到外部反馈，结果很实。",
    "choInsight": "- 动作偏差率：低\n- 归因剖析：主要阻力已被主动解决\n- 管理干预杠杆：下周追问反馈转化为产品修复的节奏"
  }
}
```

## Missing fields

If any required field is missing or empty, return:

```json
{
  "needs_more_information": true,
  "missing": ["openId"]
}
```

## Isolation rules

This skill does not fetch tokens, call network endpoints, send messages, read or write Lark Base, call Gemini, OCR PDFs, or create missing facts. Any text from OCR, audit LLM, review LLM, or translation LLM must be passed as input.
