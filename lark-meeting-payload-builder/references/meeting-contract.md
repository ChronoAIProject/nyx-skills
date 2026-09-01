# Meeting payload contract

This contract defines deterministic behavior for `lark-meeting-payload-builder`.

## Original n8n flow

The original workflow is `Lark Meeting v2`.

Form-submission path:

1. Receives an n8n hosted form named `Meeting Form`.
2. Reads `Meeting Transcript`, `Meeting Date`, `Your Name`, and `Minutes URL`.
3. Fetches a NyxID token from a set node.
4. Calls Groq through NyxID and asks the model to return task JSON.
5. Parses the model output into task items.
6. Creates one Lark Base record for each task.
7. Builds one text digest.
8. Sends the digest to a fixed Lark group chat.

Reminder path:

1. Runs on Wednesday 10:00, Friday 9:00, and Monday 9:30 schedule triggers.
2. Fetches up to 50 Lark Base task records.
3. Builds a reminder text from unfinished records.
4. Sends the reminder to the same fixed Lark group chat.

This skill implements steps 5, 6, 7, and 8 payload construction in the form-submission path, and steps 3 and 4 payload construction in the reminder path. Token exchange, Lark Base reads/writes, Lark IM sends, and LLM calls stay in NyxID/Aevatar.

## Constants from the workflow

Use these exact constants from the n8n HTTP/code nodes:

```json
{
  "chatId": "oc_922f242b5105f8f32c737c003d2f1b22",
  "basePath": "/open-apis/bitable/v1/apps/Z1FSb2bmFaDdlWsTen8lwtKLgyh/tables/tblCIDFBnAfPPUi7/records",
  "messagePath": "/open-apis/im/v1/messages?receive_id_type=chat_id",
  "messageSuffix": "\n\n【via lark-cli (auto-generated)】"
}
```

## Input wrapping

The caller may pass the event body directly or wrap it in `body`. If `body` exists, read fields from `body`; otherwise read fields from the root object.

## Mode: build_task_payloads

This mode replaces `Parse Tasks`, the Lark Base body construction inside `Save to Lark Base`, `Build Message`, and the Lark IM body construction inside `Send to Group Chat`.

### Required fields

Use the first non-empty value in the listed order.

| Normalized field | Source fields |
|---|---|
| `meetingDate` | `Meeting Date`, `meetingDate`, `meeting_date`, `date` |
| `tasks` | `tasks`, `aiTasks`, `extractedTasks`, `modelOutput`, `model_output`, `llmOutput`, `llm_output`, `groqResponse`, `groq_response` |
| `today` | `today`, `runDate`, `run_date`, `executionDate`, `execution_date`, `currentDate`, `current_date` |

The caller may pass `weekFriday`, `week_friday`, `fridayStr`, `friday_str`, `fallbackDeadline`, `fallback_deadline`, `defaultDeadline`, or `default_deadline` instead of `today`.

`today` must be a deterministic date string, preferably `YYYY-MM-DD`. It is used only to compute the next Friday when `weekFriday` is not provided. This replaces the n8n code node's runtime `new Date()`.

### LLM task input

`tasks` may be:

- an array of task objects,
- one task object,
- a JSON string containing an array or object,
- a Groq-style response object with `choices[0].message.content`.

Do not call an LLM in this skill. The caller must provide the model output.

### Normalized task fields

For each model task `t` at zero-based index `i`, build:

```json
{
  "task_id": "TASK-<meetingDate without hyphens>-<two digit index starting at 01>",
  "task": "t.task or Unnamed",
  "task_type": "t.task_type or action_item",
  "owner": "t.owner or Unassigned",
  "owner_role": "t.owner_role or empty string",
  "deadline": "t.deadline or computed weekFriday",
  "priority": "t.priority or medium",
  "infer_reason": "t.infer_reason or empty string",
  "source_quote": "t.source_quote or empty string",
  "has_inferred": true,
  "meeting_date": "meetingDate"
}
```

`has_inferred` is `(t.inferred_fields || []).length > 0`, exactly like the workflow.

### Lark Base record body

For each normalized task, build:

```json
{
  "fields": {
    "Task": "<task>",
    "Owner": "<owner>",
    "Deadline": "<deadline>",
    "Priority": "High",
    "Status": "Not Started",
    "Boss Quote": "<source_quote>"
  }
}
```

Priority mapping matches the workflow exactly:

| Normalized task `priority` | Lark Base `Priority` |
|---|---|
| `high` | `High` |
| `medium` | `Medium` |
| anything else | `Low` |

### Meeting task message

Build the text exactly as the n8n `Build Message` node:

```text
📋 本周任务清单
📅 会议日期：<meetingDate>
────────────────────

🔴 P0 本周必须完成

1. 【老板需求】 <task>
   👤 <owner>　　📅 <本周五 or deadline>
   💬 "<source_quote>"

🟡 P1 重要任务

2. 【执行任务】 <task>
   👤 <owner>　　📅 <本周五 or deadline>
   💬 "<source_quote>"

🟢 P2 一般任务

3. 【执行任务】 <task>
   👤 <owner>　　📅 <本周五 or deadline>
   💬 "<source_quote>"

────────────────────
共 <task count> 个任务，完成后请更新多维表格 ✅
```

Only tasks with exact lowercase `priority` values `high`, `medium`, and `low` are listed in those sections. The workflow does not normalize case.

Use `【老板需求】` when `task_type` is exactly `boss_requirement`; otherwise use `【执行任务】`.

Use `本周五` when `deadline` equals `weekFriday`; otherwise use the raw `deadline`.

### Lark group message body

Build:

```json
{
  "receive_id": "oc_922f242b5105f8f32c737c003d2f1b22",
  "msg_type": "text",
  "content": "{\"text\":\"<meeting task message>\\n\\n【via lark-cli (auto-generated)】\"}"
}
```

### Output shape

Return:

```json
{
  "message_type": "lark_meeting_tasks",
  "summary": "Meeting task payloads for <meetingDate>",
  "meeting": {
    "meetingDate": "<meetingDate>",
    "taskCount": 1,
    "chatId": "oc_922f242b5105f8f32c737c003d2f1b22",
    "weekFriday": "<weekFriday>"
  },
  "tasks": [],
  "message": "<meeting task message>",
  "lark": {
    "base": {
      "path": "/open-apis/bitable/v1/apps/Z1FSb2bmFaDdlWsTen8lwtKLgyh/tables/tblCIDFBnAfPPUi7/records",
      "bodies": []
    },
    "message": {
      "path": "/open-apis/im/v1/messages?receive_id_type=chat_id",
      "body": {}
    }
  }
}
```

### Example

Input:

```json
{
  "mode": "build_task_payloads",
  "meetingDate": "2026-06-03",
  "today": "2026-06-04",
  "tasks": [
    {
      "task": "Finish rollout report",
      "task_type": "boss_requirement",
      "owner": "Crystal",
      "deadline": "",
      "priority": "high",
      "inferred_fields": ["deadline"],
      "source_quote": "Please finish the rollout report this week."
    },
    {
      "task": "Update risk table",
      "task_type": "action_item",
      "owner": "Alex",
      "deadline": "2026-06-10",
      "priority": "medium",
      "source_quote": "Alex will update the risk table."
    }
  ]
}
```

Output excerpt:

```json
{
  "message_type": "lark_meeting_tasks",
  "meeting": {
    "meetingDate": "2026-06-03",
    "taskCount": 2,
    "chatId": "oc_922f242b5105f8f32c737c003d2f1b22",
    "weekFriday": "2026-06-05"
  },
  "lark": {
    "base": {
      "path": "/open-apis/bitable/v1/apps/Z1FSb2bmFaDdlWsTen8lwtKLgyh/tables/tblCIDFBnAfPPUi7/records",
      "bodies": [
        {
          "fields": {
            "Task": "Finish rollout report",
            "Owner": "Crystal",
            "Deadline": "2026-06-05",
            "Priority": "High",
            "Status": "Not Started",
            "Boss Quote": "Please finish the rollout report this week."
          }
        }
      ]
    }
  }
}
```

## Mode: build_reminder_payload

This mode replaces `Build Reminder` and the Lark IM body construction inside `Send Reminder`.

### Required fields

Use the first non-empty value in the listed order.

| Normalized field | Source fields |
|---|---|
| `today` | `today`, `runDate`, `run_date`, `executionDate`, `execution_date`, `currentDate`, `current_date` |
| `records` | `records`, `items`, `data.items` |

`today` must be deterministic, preferably `YYYY-MM-DD`. It replaces the workflow's runtime `new Date()`.

### Record input

Each record should match the shape returned by Lark Base:

```json
{
  "fields": {
    "Task": "Update risk table",
    "Owner": "Alex",
    "Deadline": "2026-06-10",
    "Priority": "Medium",
    "Status": "Not Started",
    "Boss Quote": "Alex will update the risk table."
  }
}
```

Records with `fields.Status === "Done"` are ignored. If no unfinished records remain, return:

```json
{
  "skip": true,
  "reason": "no unfinished tasks"
}
```

### Monday reminder text

When `today` is Monday, build:

```text
Weekly Summary / 每周汇报 (Before meeting / 开会前)
------------------------------

<unfinished count> tasks unfinished / 项未完成:

1. <Task>
   <Owner> | <OVERDUE or TODAY or N days left>

Update Lark Base / 请更新多维表格状态
```

### Wednesday and Friday reminder text

When `today` is Wednesday, use label:

```text
Mid-week Reminder / 周中提醒
```

For any other day, including Friday, use label:

```text
Deadline Reminder / 截止提醒
```

Then list only the first 8 unfinished tasks:

```text
Deadline Reminder / 截止提醒
------------------------------

1. <Task>
   <Owner> | <OVERDUE or TODAY or Nd left>

Update Lark Base / 请更新多维表格状态
```

### Lark group message body

Build:

```json
{
  "receive_id": "oc_922f242b5105f8f32c737c003d2f1b22",
  "msg_type": "text",
  "content": "{\"text\":\"<reminder message>\\n\\n【via lark-cli (auto-generated)】\"}"
}
```

### Output shape

Return:

```json
{
  "message_type": "lark_meeting_reminder",
  "summary": "Meeting task reminder payload",
  "skip": false,
  "reminderMessage": "<reminder message>",
  "unfinishedCount": 1,
  "lark": {
    "message": {
      "path": "/open-apis/im/v1/messages?receive_id_type=chat_id",
      "body": {}
    }
  }
}
```

### Example

Input:

```json
{
  "mode": "build_reminder_payload",
  "today": "2026-06-05",
  "records": [
    {
      "fields": {
        "Task": "Finish rollout report",
        "Owner": "Crystal",
        "Deadline": "2026-06-05",
        "Status": "Not Started"
      }
    },
    {
      "fields": {
        "Task": "Closed task",
        "Owner": "Alex",
        "Deadline": "2026-06-05",
        "Status": "Done"
      }
    }
  ]
}
```

Output excerpt:

```json
{
  "message_type": "lark_meeting_reminder",
  "summary": "Meeting task reminder payload",
  "skip": false,
  "unfinishedCount": 1,
  "lark": {
    "message": {
      "path": "/open-apis/im/v1/messages?receive_id_type=chat_id",
      "body": {
        "receive_id": "oc_922f242b5105f8f32c737c003d2f1b22",
        "msg_type": "text"
      }
    }
  }
}
```

## Missing fields

If any required field is missing or empty, return:

```json
{
  "needs_more_information": true,
  "missing": ["meetingDate", "tasks", "today"]
}
```
