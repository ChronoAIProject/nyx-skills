# Interview analysis contract

This contract defines deterministic behavior for `interview-minutes-analysis-payload-builder`.

## Original flow boundary

The original n8n workflow has these linear steps:

1. Receive `POST lark-interview-analysis`.
2. Load static NyxID and Lark config.
3. Fetch a Lark tenant token.
4. Refresh a Lark user token.
5. Scan ATS Bitable records where `Minutes URL` is present.
6. Select the first record whose `AI Interview Notes` field is empty.
7. Extract the Lark Minutes token.
8. Fetch Minutes metadata.
9. Fetch the Minutes transcript.
10. Build a Groq prompt and call the model.
11. Parse the model result and build notes text plus an interactive card.
12. Call `PUT /open-apis/bitable/v1/apps/:ats_app_token/tables/:ats_table_id/records/:record_id`.
13. Call `POST /open-apis/im/v1/messages?receive_id_type=open_id`.
14. Return `{ "ok": true, "message": "面试分析完成" }` to the webhook.

This skill implements step 11 payload construction and returns connector-ready bodies for steps 12 and 13. Token exchange, Bitable reads, Minutes reads, Groq calls, HTTP sends, and webhook responses stay in Aevatar or connector code.

## Input shape

The caller may pass the event body directly or wrap it in `body`. If `body` exists, read fields from `body`; otherwise read fields from the root object.

The script accepts `mode: "build_payload"`. If `mode` is omitted, use `build_payload`.

## Field aliases

Use the first non-empty value in the listed order.

| Normalized field | Source fields | Required |
|---|---|---|
| `analysis` | `analysis`, `aiAnalysis`, `interviewAnalysis`, `modelOutput`, `model_output`, `llmOutput`, `llm_output`, `groqResponse`, `groq_response`, root `choices` | yes |
| `hrOpenId` | `hrOpenId`, `hr_open_id` | yes |
| `atsAppToken` | `atsAppToken`, `ats_app_token` | yes |
| `atsTableId` | `atsTableId`, `ats_table_id` | yes |
| `recordId` | `recordId`, `record_id` | yes |
| `generatedAt` | `generatedAt`, `generated_at`, `analysisTime`, `analysis_time`, `sourceTime`, `source_time` | yes |
| `candidateName` | `candidateName`, `candidate_name` | no |
| `jobTitle` | `jobTitle`, `job_title` | no |
| `minuteTitle` | `minuteTitle`, `minute_title` | no |

If `analysis`, `aiAnalysis`, or `interviewAnalysis` is an object, use it directly.

If `groqResponse`, `groq_response`, or the root input has `choices[0].message.content`, parse that string the same way the workflow's `解析结果 + 构建卡片` node does: extract the first JSON object substring with `/\{[\s\S]*\}/`, then `JSON.parse` it.

If a raw `modelOutput`, `model_output`, `llmOutput`, or `llm_output` string is supplied, parse it the same way.

If model-output parsing fails, use the workflow's fallback analysis:

```json
{
  "overall": "Error",
  "score": 0,
  "summary": "AI解析失败",
  "strengths": [],
  "red_flags": ["错误:<parse error message>"],
  "key_moments": [],
  "culture_fit": "Unknown",
  "culture_fit_reason": "",
  "next_step": "请手动评估",
  "suggested_questions": [],
  "veto_check": {},
  "veto_count": 0
}
```

`generatedAt` must be supplied by the caller. The n8n workflow used the current Singapore time in the card note; this skill does not read the current time.

## Defaults

These defaults come from the workflow's final card builder:

```json
{
  "candidateName": "候选人",
  "jobTitle": "",
  "minuteTitle": ""
}
```

## Decision fields

Build:

```text
decision = score >= 3 ? "✅ 推进下一轮" : "❌ 淘汰"
```

Build:

```json
{
  "1": "🔴",
  "2": "🟠",
  "3": "🟡",
  "4": "🟢",
  "5": "⭐"
}
```

Use `⚪` when the score is not one of the listed keys.

Build:

```text
headerColor = score >= 4 ? "green" : score === 3 ? "yellow" : "red"
```

Map `overall` as:

```json
{
  "Strong Hire": "🟢 Strong Hire",
  "Hire": "🟢 Hire",
  "Maybe": "🟡 Maybe",
  "Pass": "🔴 Pass",
  "Strong Pass": "🔴 Strong Pass",
  "Error": "⚠️ Error"
}
```

Use the raw `overall` value when it is not listed.

For `veto_check`, keep entries whose value is present and not exactly `N/A`. Prefix each line with `🚫` when the value starts with `VETO`; otherwise prefix with `✅`.

Build:

```text
vetoSummary = veto_count === 0 ? "✅ 全部通过" : "🚫 触发 <veto_count> 条否决"
```

If `veto_count` is missing, use `0`, matching the workflow.

## Notes text

Build `notes_text` exactly as:

```text
<decision>  <overallTag>  <scoreEmoji> <score>/5  <vetoSummary>

🔍 否决条件检查:
<veto lines>

📝 总结: <summary>

✅ 亮点:
<strength lines, or "• 无">

⚠️ 风险信号:
<red flag lines, or "• 无">

🎯 关键时刻:
<[timestamp] content lines>

➡️ 建议: <next_step>

❓ 下轮追问:
<numbered suggested questions, or "• 无（已淘汰）">

——— AI 分析 · <minuteTitle>
```

Strength and red-flag entries are prefixed with `• `. Suggested questions are numbered from `1`.

## Lark card object

Build `card` as this object:

```json
{
  "config": { "wide_screen_mode": true },
  "header": {
    "title": {
      "content": "🤖 面试分析 — <candidateName> · <jobTitle>",
      "tag": "plain_text"
    },
    "template": "<headerColor>"
  },
  "elements": [
    {
      "tag": "div",
      "fields": [
        { "is_short": true, "text": { "tag": "lark_md", "content": "**决策**\n<decision>" } },
        { "is_short": true, "text": { "tag": "lark_md", "content": "**评级**\n<overallTag>" } },
        { "is_short": true, "text": { "tag": "lark_md", "content": "**评分**\n<scoreEmoji> <score>/5" } },
        { "is_short": true, "text": { "tag": "lark_md", "content": "**否决条数**\n<vetoSummary>" } }
      ]
    },
    { "tag": "hr" },
    { "tag": "div", "text": { "tag": "lark_md", "content": "**🔍 否决条件检查**\n<veto lines or ✅ 全部通过>" } },
    { "tag": "hr" },
    { "tag": "div", "text": { "tag": "lark_md", "content": "**📝 总结**\n<summary>" } },
    { "tag": "hr" },
    { "tag": "div", "text": { "tag": "lark_md", "content": "**✅ 亮点**\n<strength lines or • 无突出亮点>" } },
    { "tag": "div", "text": { "tag": "lark_md", "content": "**⚠️ 风险信号**\n<red flag lines or • 无>" } },
    { "tag": "hr" },
    { "tag": "div", "text": { "tag": "lark_md", "content": "**🎯 关键时刻**\n<`timestamp` content lines>" } },
    { "tag": "hr" },
    { "tag": "div", "text": { "tag": "lark_md", "content": "**➡️ 建议下一步**\n<next_step>" } },
    { "tag": "div", "text": { "tag": "lark_md", "content": "**❓ 下轮追问**\n<numbered suggested questions>" } },
    { "tag": "hr" },
    {
      "tag": "note",
      "elements": [
        { "tag": "plain_text", "content": "来源: 妙记逐字稿 · <minuteTitle> · <generatedAt>" }
      ]
    }
  ]
}
```

Omit the `❓ 下轮追问` div when `suggested_questions` is empty, matching the workflow.

Set `lark_card_json` to `JSON.stringify(card)`.

## Lark Bitable update

Build the connector-ready request as:

```json
{
  "method": "PUT",
  "path": "/open-apis/bitable/v1/apps/<atsAppToken>/tables/<atsTableId>/records/<recordId>",
  "body": {
    "fields": {
      "AI Interview Notes": "<notes_text>"
    }
  }
}
```

The `fields` key and `AI Interview Notes` field name are copied from the workflow's `回写 ATS 记录` node.

## Lark HR card message

Build the connector-ready request as:

```json
{
  "method": "POST",
  "path": "/open-apis/im/v1/messages?receive_id_type=open_id",
  "body": {
    "receive_id": "<hrOpenId>",
    "msg_type": "interactive",
    "content": "<lark_card_json>"
  }
}
```

The `receive_id`, `msg_type`, and `content` keys are copied from the workflow's `发送 Lark 卡片` node.

## Output shape

Return:

```json
{
  "message_type": "lark_interview_minutes_analysis_payloads",
  "summary": "Interview analysis for <candidateName>",
  "analysis": "<normalized analysis object>",
  "notes_text": "<notes_text>",
  "card": "<card object>",
  "lark_card_json": "<JSON.stringify(card)>",
  "lark": {
    "bitableUpdate": "<Lark Bitable update request>",
    "cardMessage": "<Lark HR card message request>"
  }
}
```

## Missing fields

If any required field is missing or empty, return:

```json
{
  "needs_more_information": true,
  "missing": ["analysis", "hrOpenId", "atsAppToken", "atsTableId", "recordId", "generatedAt"]
}
```

## Example

Input:

```json
{
  "candidate_name": "Alice Wang",
  "job_title": "AI Engineer",
  "minute_title": "Alice Wang 面试",
  "hr_open_id": "ou_hr_example",
  "ats_app_token": "app_token_example",
  "ats_table_id": "table_example",
  "record_id": "rec_example",
  "generated_at": "2026/6/4 15:30:00",
  "analysis": {
    "veto_check": {
      "v1": "PASS — 候选人说 \"我用 Cursor 重构了评测脚本\"",
      "v2": "PASS — 有 Agent 项目实现细节",
      "v3": "PASS — 讨论了队列重试和幂等",
      "v4": "PASS — 独立负责从设计到上线",
      "v5": "N/A"
    },
    "overall": "Hire",
    "score": 4,
    "summary": "未触发否决。候选人能说清 AI 工程实践和独立交付细节。建议推进下一轮技术深挖。",
    "strengths": ["Cursor 工作流有具体产出", "Agent 编排经验真实"],
    "red_flags": [],
    "key_moments": [{ "timestamp": "12:34", "content": "我把人工回归改成了自动评测流水线" }],
    "culture_fit": "High",
    "culture_fit_reason": "有小团队独立交付经验",
    "next_step": "推进下一轮，重点追问线上稳定性案例",
    "suggested_questions": ["评测流水线如何避免误判？", "Agent 失败重试怎么设计？"],
    "veto_count": 0
  }
}
```

Concrete output checks for that input:

```json
{
  "message_type": "lark_interview_minutes_analysis_payloads",
  "summary": "Interview analysis for Alice Wang",
  "notes_text": "✅ 推进下一轮  🟢 Hire  🟢 4/5  ✅ 全部通过\n\n🔍 否决条件检查:\n✅ v1: PASS — 候选人说 \"我用 Cursor 重构了评测脚本\"\n✅ v2: PASS — 有 Agent 项目实现细节\n✅ v3: PASS — 讨论了队列重试和幂等\n✅ v4: PASS — 独立负责从设计到上线\n\n📝 总结: 未触发否决。候选人能说清 AI 工程实践和独立交付细节。建议推进下一轮技术深挖。\n\n✅ 亮点:\n• Cursor 工作流有具体产出\n• Agent 编排经验真实\n\n⚠️ 风险信号:\n• 无\n\n🎯 关键时刻:\n[12:34] 我把人工回归改成了自动评测流水线\n\n➡️ 建议: 推进下一轮，重点追问线上稳定性案例\n\n❓ 下轮追问:\n1. 评测流水线如何避免误判？\n2. Agent 失败重试怎么设计？\n\n——— AI 分析 · Alice Wang 面试",
  "card": {
    "config": { "wide_screen_mode": true },
    "header": {
      "title": { "content": "🤖 面试分析 — Alice Wang · AI Engineer", "tag": "plain_text" },
      "template": "green"
    },
    "elements": [
      {
        "tag": "div",
        "fields": [
          { "is_short": true, "text": { "tag": "lark_md", "content": "**决策**\n✅ 推进下一轮" } },
          { "is_short": true, "text": { "tag": "lark_md", "content": "**评级**\n🟢 Hire" } },
          { "is_short": true, "text": { "tag": "lark_md", "content": "**评分**\n🟢 4/5" } },
          { "is_short": true, "text": { "tag": "lark_md", "content": "**否决条数**\n✅ 全部通过" } }
        ]
      },
      { "tag": "hr" },
      { "tag": "div", "text": { "tag": "lark_md", "content": "**🔍 否决条件检查**\n✅ v1: PASS — 候选人说 \"我用 Cursor 重构了评测脚本\"\n✅ v2: PASS — 有 Agent 项目实现细节\n✅ v3: PASS — 讨论了队列重试和幂等\n✅ v4: PASS — 独立负责从设计到上线" } },
      { "tag": "hr" },
      { "tag": "div", "text": { "tag": "lark_md", "content": "**📝 总结**\n未触发否决。候选人能说清 AI 工程实践和独立交付细节。建议推进下一轮技术深挖。" } },
      { "tag": "hr" },
      { "tag": "div", "text": { "tag": "lark_md", "content": "**✅ 亮点**\n• Cursor 工作流有具体产出\n• Agent 编排经验真实" } },
      { "tag": "div", "text": { "tag": "lark_md", "content": "**⚠️ 风险信号**\n• 无" } },
      { "tag": "hr" },
      { "tag": "div", "text": { "tag": "lark_md", "content": "**🎯 关键时刻**\n`12:34` 我把人工回归改成了自动评测流水线" } },
      { "tag": "hr" },
      { "tag": "div", "text": { "tag": "lark_md", "content": "**➡️ 建议下一步**\n推进下一轮，重点追问线上稳定性案例" } },
      { "tag": "div", "text": { "tag": "lark_md", "content": "**❓ 下轮追问**\n1. 评测流水线如何避免误判？\n2. Agent 失败重试怎么设计？" } },
      { "tag": "hr" },
      { "tag": "note", "elements": [{ "tag": "plain_text", "content": "来源: 妙记逐字稿 · Alice Wang 面试 · 2026/6/4 15:30:00" }] }
    ]
  },
  "lark_card_json": "the minified JSON string produced by JSON.stringify(card)",
  "lark": {
    "bitableUpdate": {
      "method": "PUT",
      "path": "/open-apis/bitable/v1/apps/app_token_example/tables/table_example/records/rec_example",
      "body": {
        "fields": {
          "AI Interview Notes": "same exact string as notes_text"
        }
      }
    },
    "cardMessage": {
      "method": "POST",
      "path": "/open-apis/im/v1/messages?receive_id_type=open_id",
      "body": {
        "receive_id": "ou_hr_example",
        "msg_type": "interactive",
        "content": "same exact string as lark_card_json"
      }
    }
  }
}
```
