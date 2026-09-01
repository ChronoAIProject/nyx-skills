# Tweet draft approval contract

This contract defines deterministic behavior for `tweet-draft-approval-payload-builder`.

## Original n8n flow

The original workflow:

1. Receives a Lark webhook at `lark-group-webhook`.
2. Responds to Lark URL verification with `{ "challenge": body.challenge }`.
3. Normalizes either a Lark text message or an interactive card action.
4. Sends the tweet draft to Gemini for AI audit.
5. Parses the AI output into `status` and `report`.
6. If AI status is `APPROVED`, sends an interactive approval card to the chat.
7. Otherwise sends a Lark post telling the employee the AI audit failed.
8. If an admin card action is `approve`, sends a Lark post saying the tweet can be published.
9. Otherwise sends a Lark post saying the admin rejected the draft.

This skill implements steps 2, 3, 5, 6, 7, 8, and 9 payload construction only. The Lark webhook receiver, tenant token fetch, Gemini call, NyxID proxy call, and actual Lark message send stay in Aevatar.

## Modes

Use the first non-empty value in the listed alias order.

| Mode | Purpose |
|---|---|
| `parse_event` | Normalize raw Lark URL challenge, text message, or card-action event. |
| `parse_ai_result` | Parse raw AI audit text into `status` and `report` while carrying tweet fields. |
| `build_ai_review_payload` | Build the AI-rejected post or AI-approved admin-review card. This is the default mode. |
| `build_admin_action_payload` | Build the admin approved or admin rejected post message. |
| `auto` | Parse a raw event; card actions become admin-action payloads, chat messages return normalized fields. |

## Event input aliases

The caller may pass a raw event body directly or wrap it in `body`.

Card action source order:

1. `body.action.value`
2. `body.event.action.value`

Text message source:

1. `body.event.message.chat_id`
2. `body.event.sender.sender_id.open_id`
3. `body.event.message.content`

For message content, parse JSON and read `.text` when possible. Then remove a leading bot mention matching:

```text
^@_user_\d+\s*
```

If content is not JSON, use the raw string.

## Normalized fields

| Normalized field | Source aliases |
|---|---|
| `action` | `action` |
| `chat_id` | `chat_id`, `chatId` |
| `employee_id` | `employee_id`, `employeeId`, `open_id`, `openId` |
| `tweet_draft` | `tweet_draft`, `tweetDraft`, `draft` |
| `ai_output` | `ai_output`, `aiOutput`, `text`, `output` |
| `status` | `status` |
| `report` | `report` |

## URL verification output

If the raw body has `type: "url_verification"` or has `challenge`, return:

```json
{
  "skip": true,
  "is_challenge": true,
  "challenge": "challenge-code",
  "webhook": {
    "responseBody": {
      "challenge": "challenge-code"
    }
  }
}
```

## Event parsing output

For a Lark message event, return:

```json
{
  "skip": false,
  "is_card": "false",
  "action": "",
  "chat_id": "oc_chat",
  "employee_id": "ou_employee",
  "tweet_draft": "draft text"
}
```

For a card action, return the same shape with `is_card: "true"` and `action` from the card button value.

Non-applicable events return:

```json
{ "skip": true, "reason": "not a Lark message or card action event" }
```

## AI output parsing

Read raw model output from `ai_output`, `aiOutput`, `text`, or `output`.

Defaults:

```json
{
  "status": "REJECTED",
  "report": "AI 输出格式解析失败。"
}
```

Parsing matches the n8n code node:

1. Remove leading ```json, leading ```, and trailing ``` fences.
2. Try `JSON.parse`.
3. Use `parsed.status || "REJECTED"` and `parsed.report || rawOutput`.
4. If JSON parsing fails, regex-match `"status": "..."`.
5. Regex-match `"report": "..." }`; replace `\n` with line breaks and `\"` with `"`.
6. If no report match exists, set report to:

```text
【AI 返回了非标准格式，以下为原始输出】

<raw output>
```

Output shape:

```json
{
  "status": "APPROVED",
  "report": "AI report text",
  "chat_id": "oc_chat",
  "employee_id": "ou_employee",
  "tweet_draft": "draft text"
}
```

## Lark message endpoint

Every outbound Lark message body is connector-ready for:

```text
POST /open-apis/im/v1/messages?receive_id_type=chat_id
```

The body always has the workflow-derived field names:

```json
{
  "receive_id": "oc_chat",
  "msg_type": "post",
  "content": "JSON string"
}
```

## AI rejected post

When `status` is anything other than exactly `APPROVED`, build `msg_type: "post"` and content object:

```json
{
  "zh_cn": {
    "title": "AI审计未通过",
    "content": [
      [
        {
          "tag": "text",
          "text": "你的推文未通过审计，请按建议修改后重提。\n\n<report>"
        }
      ]
    ]
  }
}
```

Return:

```json
{
  "message_type": "lark_post_message",
  "stage": "ai_rejected",
  "summary": "Tweet draft failed AI audit; rejection message ready.",
  "status": "REJECTED",
  "report": "AI report text",
  "lark": {
    "path": "/open-apis/im/v1/messages?receive_id_type=chat_id",
    "body": {
      "receive_id": "oc_chat",
      "msg_type": "post",
      "content": "JSON string"
    }
  },
  "post": "same object before JSON stringification"
}
```

## AI approved admin-review card

When `status` is exactly `APPROVED`, build `msg_type: "interactive"` and this card object:

```json
{
  "config": {
    "wide_screen_mode": true
  },
  "header": {
    "title": {
      "tag": "plain_text",
      "content": "✅ AI审计通过，等待管理员复核"
    },
    "template": "blue"
  },
  "elements": [
    {
      "tag": "div",
      "text": {
        "tag": "lark_md",
        "content": "**发起人**：<at id=\"<employee_id>\"></at>\n**拟发布内容**：\n<tweet_draft>"
      }
    },
    {
      "tag": "hr"
    },
    {
      "tag": "div",
      "text": {
        "tag": "lark_md",
        "content": "**AI审计报告**：\n<report>"
      }
    },
    {
      "tag": "action",
      "actions": [
        {
          "tag": "button",
          "text": {
            "tag": "plain_text",
            "content": "同意发布"
          },
          "type": "primary",
          "value": {
            "action": "approve",
            "chat_id": "<chat_id>",
            "employee_id": "<employee_id>",
            "tweet_draft": "<tweet_draft>"
          }
        },
        {
          "tag": "button",
          "text": {
            "tag": "plain_text",
            "content": "驳回重写"
          },
          "type": "danger",
          "value": {
            "action": "reject",
            "chat_id": "<chat_id>",
            "employee_id": "<employee_id>",
            "tweet_draft": "<tweet_draft>"
          }
        }
      ]
    },
    {
      "tag": "div",
      "text": {
        "tag": "lark_md",
        "content": "请管理员审批：<at id=\"ou_PLACEHOLDER_OPEN_ID_1\"></at>"
      }
    }
  ]
}
```

`ou_PLACEHOLDER_OPEN_ID_1` is the literal administrator open id placeholder present in the original workflow. This skill must not invent a replacement.

Return:

```json
{
  "message_type": "lark_interactive_message",
  "stage": "ai_approved_admin_review",
  "summary": "Tweet draft passed AI audit; admin review card ready.",
  "status": "APPROVED",
  "report": "AI report text",
  "lark": {
    "path": "/open-apis/im/v1/messages?receive_id_type=chat_id",
    "body": {
      "receive_id": "oc_chat",
      "msg_type": "interactive",
      "content": "JSON string"
    }
  },
  "card": "same object before JSON stringification"
}
```

## Admin approved post

When `action` is exactly `approve`, build `msg_type: "post"` and content object:

```json
{
  "zh_cn": {
    "title": "🎉 审批通过，可以发布！",
    "content": [
      [
        {
          "tag": "at",
          "user_id": "<employee_id>"
        },
        {
          "tag": "text",
          "text": " 管理员已同意，请手动发布以下内容：\n\n<tweet_draft>"
        }
      ]
    ]
  }
}
```

Return `stage: "admin_approved"` with this object in `post` and its JSON string in `lark.body.content`.

## Admin rejected post

When `action` is not `approve`, the original n8n IF false branch sends the rejection notification. For normalized card-action inputs, this skill expects `action` to be present; common value is `reject`.

Build `msg_type: "post"` and content object:

```json
{
  "zh_cn": {
    "title": "🛑 管理员已驳回",
    "content": [
      [
        {
          "tag": "at",
          "user_id": "<employee_id>"
        },
        {
          "tag": "text",
          "text": " 你的推文草稿已被管理员驳回，请按要求修改后重新发送。"
        }
      ]
    ]
  }
}
```

Return `stage: "admin_rejected"` with this object in `post` and its JSON string in `lark.body.content`.

## Missing information

For `build_ai_review_payload`, required fields are:

```json
["chat_id", "employee_id", "tweet_draft", "report"]
```

For `build_admin_action_payload`, required fields are:

```json
["action", "chat_id", "employee_id", "tweet_draft"]
```

If any are missing or empty, return:

```json
{
  "needs_more_information": true,
  "missing": ["chat_id"]
}
```

## Examples

### parse_event message

Input:

```json
{
  "mode": "parse_event",
  "body": {
    "event": {
      "message": {
        "chat_id": "oc_demo_chat",
        "content": "{\"text\":\"@_user_1 Ship aelf Skills as simple actions for every AI assistant.\"}"
      },
      "sender": {
        "sender_id": {
          "open_id": "ou_demo_employee"
        }
      }
    }
  }
}
```

Output:

```json
{
  "skip": false,
  "is_card": "false",
  "action": "",
  "chat_id": "oc_demo_chat",
  "employee_id": "ou_demo_employee",
  "tweet_draft": "Ship aelf Skills as simple actions for every AI assistant."
}
```

### parse_ai_result

Input:

```json
{
  "mode": "parse_ai_result",
  "chat_id": "oc_demo_chat",
  "employee_id": "ou_demo_employee",
  "tweet_draft": "Ship aelf Skills as simple actions for every AI assistant.",
  "text": "{\"status\":\"APPROVED\",\"report\":\"Clear user value and no compliance red flags.\"}"
}
```

Output:

```json
{
  "status": "APPROVED",
  "report": "Clear user value and no compliance red flags.",
  "chat_id": "oc_demo_chat",
  "employee_id": "ou_demo_employee",
  "tweet_draft": "Ship aelf Skills as simple actions for every AI assistant."
}
```

### build_ai_review_payload

Input:

```json
{
  "mode": "build_ai_review_payload",
  "chat_id": "oc_demo_chat",
  "employee_id": "ou_demo_employee",
  "tweet_draft": "Ship aelf Skills as simple actions for every AI assistant.",
  "text": "{\"status\":\"APPROVED\",\"report\":\"Clear user value and no compliance red flags.\"}"
}
```

Output has:

```json
{
  "message_type": "lark_interactive_message",
  "stage": "ai_approved_admin_review",
  "status": "APPROVED",
  "lark": {
    "path": "/open-apis/im/v1/messages?receive_id_type=chat_id",
    "body": {
      "receive_id": "oc_demo_chat",
      "msg_type": "interactive",
      "content": "JSON string of the admin-review card"
    }
  }
}
```

### build_admin_action_payload

Input:

```json
{
  "mode": "build_admin_action_payload",
  "action": "approve",
  "chat_id": "oc_demo_chat",
  "employee_id": "ou_demo_employee",
  "tweet_draft": "Ship aelf Skills as simple actions for every AI assistant."
}
```

Output has:

```json
{
  "message_type": "lark_post_message",
  "stage": "admin_approved",
  "action": "approve",
  "lark": {
    "path": "/open-apis/im/v1/messages?receive_id_type=chat_id",
    "body": {
      "receive_id": "oc_demo_chat",
      "msg_type": "post",
      "content": "JSON string of the admin-approved post"
    }
  }
}
```

### auto

Input:

```json
{
  "mode": "auto",
  "body": {
    "event": {
      "action": {
        "value": {
          "action": "reject",
          "chat_id": "oc_demo_chat",
          "employee_id": "ou_demo_employee",
          "tweet_draft": "Ship aelf Skills as simple actions for every AI assistant."
        }
      }
    }
  }
}
```

Output has:

```json
{
  "message_type": "lark_post_message",
  "stage": "admin_rejected",
  "action": "reject",
  "lark": {
    "path": "/open-apis/im/v1/messages?receive_id_type=chat_id",
    "body": {
      "receive_id": "oc_demo_chat",
      "msg_type": "post",
      "content": "JSON string of the admin-rejected post"
    }
  }
}
```
