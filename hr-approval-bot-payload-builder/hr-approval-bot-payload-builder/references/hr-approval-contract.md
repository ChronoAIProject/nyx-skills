# HR approval contract

This contract defines deterministic behavior for `hr-approval-bot-payload-builder`.

## Original flow boundary

The original n8n flow has these linear steps:

1. Receive a `POST` webhook at `lark-hr-bot`.
2. Return a URL verification challenge when `body.type` is `url_verification`.
3. Extract Lark message text, sender `open_id`, sender `user_id`, and `chat_id`.
4. Fetch a Lark tenant token.
5. Query Lark contact user info by sender `open_id`.
6. Ask Groq for leave-request JSON.
7. Parse the model result and derive approval fields.
8. If information is incomplete, send a Lark text message asking for more information.
9. If information is complete, build a Lark approval form and call `POST /open-apis/approval/v4/instances`.
10. Send a Lark text message confirming submission.

This skill implements steps 2, 3, 7 payload derivation, 8 body construction, 9 body construction, and 10 body construction only. Token exchange, contact lookup, model calls, approval submission, and message sending stay in NyxID/Aevatar.

## Modes

The script accepts two modes:

- `parse_event`: parse the Lark webhook body.
- `build_payloads`: build final outbound Lark payload bodies. This is the default when `mode` is absent.

The caller may pass the event or payload body directly or wrap it in `body`.

## `parse_event`

If `body.type` equals `url_verification`, return:

```json
{
  "skip": true,
  "is_challenge": true,
  "challenge": "<body.challenge>",
  "webhookResponse": { "challenge": "<body.challenge>" }
}
```

For message events, read `body.event.message.content`. Parse it as JSON and use the `text` property. If parsing fails, `messageText` is an empty string, matching the workflow code node.

Return:

```json
{
  "skip": false,
  "messageText": "<parsed text or empty string>",
  "openId": "<body.event.sender.sender_id.open_id or empty string>",
  "userId": "<body.event.sender.sender_id.user_id or empty string>",
  "chatId": "<body.event.message.chat_id or empty string>"
}
```

### `parse_event` example

Input:

```json
{
  "mode": "parse_event",
  "body": {
    "header": { "event_type": "im.message.receive_v1" },
    "event": {
      "sender": {
        "sender_id": {
          "open_id": "ou_sender_open",
          "user_id": "u_sender"
        }
      },
      "message": {
        "chat_id": "oc_chat",
        "content": "{\"text\":\"我要请明天年假\"}"
      }
    }
  }
}
```

Output:

```json
{
  "skip": false,
  "messageText": "我要请明天年假",
  "openId": "ou_sender_open",
  "userId": "u_sender",
  "chatId": "oc_chat"
}
```

## `build_payloads` input shape

The model output is an input field. Pass it as an object or as a JSON string in one of:

| Normalized field | Accepted aliases |
|---|---|
| model output object | `aiResult`, `ai_result`, `llmResult`, `llm_result`, `modelOutput`, `model_output`, `leaveRequest`, `leave_request`, or root fields |

Inside the model output, use the first non-empty value in the listed order:

| Normalized field | Accepted aliases |
|---|---|
| `has_all_info` | `has_all_info`, `hasAllInfo` |
| `leave_type_name` | `leave_type_name`, `leaveTypeName` |
| `start_date` | `start_date`, `startDate` |
| `end_date` | `end_date`, `endDate` |
| `days` | `days` |
| `reason` | `reason` |
| `reply_message` | `reply_message`, `replyMessage` |

Use the first non-empty value in the listed order for event and contact fields:

| Normalized field | Accepted aliases |
|---|---|
| `openId` | `openId`, `open_id`, `senderOpenId`, `sender_open_id`, `msgInfo.openId`, `messageInfo.openId`, `event.sender.sender_id.open_id` |
| `userId` | `userInfo.user_id`, `user_info.user_id`, `contactUser.user_id`, `contact_user.user_id`, `user_id`, `userId`, `employeeUserId`, `employee_user_id`, `msgInfo.userId`, `messageInfo.userId`, `event.sender.sender_id.user_id` |
| `leaderUserId` | `userInfo.leader_user_id`, `user_info.leader_user_id`, `contactUser.leader_user_id`, `contact_user.leader_user_id`, `leader_user_id`, `leaderUserId`, `managerUserId`, `manager_user_id` |
| `departmentIds` | `userInfo.department_ids`, `user_info.department_ids`, `contactUser.department_ids`, `contact_user.department_ids`, `department_ids`, `departmentIds` |

If the model output string is not valid JSON, use the same fallback as the workflow:

```json
{
  "has_all_info": false,
  "reply_message": "抱歉没理解，请告诉我假期类型、开始日期、结束日期和原因。"
}
```

## Leave type ids

The Singapore leave type map is copied from the workflow:

```json
{
  "Annual Leave": "7372430614034694176",
  "Off in Lieu": "7372148222342512671",
  "Sick Leave": "7372150275550822432",
  "Unpaid Leave": "7372149064747515935",
  "Childcare Leave": "7373994238427529247",
  "Hospitalisation Leave": "7372147680094470176",
  "Reservist Leave": "7372146437582274591",
  "Maternity Leave": "7372151940576215072",
  "Paternity Leave": "7372153523011649567",
  "Marriage Leave": "7409935164769402911"
}
```

The workflow has `cnDepartmentIds = []`, so `isCN` is always false unless the source workflow changes. The returned region widget value is therefore:

```text
lworxu8i-sfhnu3wcjep-0
```

The approval code is copied from the workflow:

```text
BC26F7AB-3D6F-4F8F-90D0-9AC951651F23
```

## Missing information output

When `has_all_info` is false, build the Lark body for:

```text
POST /open-apis/im/v1/messages?receive_id_type=open_id
```

Body:

```json
{
  "receive_id": "<openId>",
  "msg_type": "text",
  "content": "{\"text\":\"<reply_message>\"}"
}
```

Skill output:

```json
{
  "message_type": "lark_hr_leave_more_info_message",
  "has_all_info": false,
  "lark": {
    "path": "/open-apis/im/v1/messages?receive_id_type=open_id",
    "moreInfoBody": {
      "receive_id": "<openId>",
      "msg_type": "text",
      "content": "{\"text\":\"<reply_message>\"}"
    }
  }
}
```

### Missing information example

Input:

```json
{
  "openId": "ou_sender_open",
  "aiResult": {
    "has_all_info": false,
    "reply_message": "请补充请假结束日期和原因。"
  }
}
```

Output:

```json
{
  "message_type": "lark_hr_leave_more_info_message",
  "has_all_info": false,
  "lark": {
    "path": "/open-apis/im/v1/messages?receive_id_type=open_id",
    "moreInfoBody": {
      "receive_id": "ou_sender_open",
      "msg_type": "text",
      "content": "{\"text\":\"请补充请假结束日期和原因。\"}"
    }
  }
}
```

## Approval form

When `has_all_info` is true, build `form` exactly as:

```json
[
  {
    "id": "widgetLeaveGroupV2",
    "type": "leaveGroupV2",
    "value": [
      { "id": "widgetLeaveGroupType", "type": "radioV2", "value": "<leaveTypeId>" },
      { "id": "widgetLeaveGroupStartTime", "type": "date", "value": "<start_date>T09:00:00+08:00" },
      { "id": "widgetLeaveGroupEndTime", "type": "date", "value": "<end_date>T18:00:00+08:00" },
      { "id": "widgetLeaveGroupInterval", "type": "radioV2", "value": "DAY" },
      { "id": "widgetLeaveGroupUnit", "type": "radioV2", "value": "DAY" },
      { "id": "widgetLeaveGroupReason", "type": "input", "value": "<reason>" },
      { "id": "widgetLeaveCertification", "type": "image", "value": [] }
    ]
  },
  { "id": "widget17168025974580001", "type": "radioV2", "value": "lworxu8i-sfhnu3wcjep-0" },
  { "id": "widget17167999750490001", "type": "text", "value": "" },
  { "id": "widget17542769722230001", "type": "contact", "value": ["<leaderUserId>"] },
  { "id": "widget17362411277050001", "type": "contact", "value": ["<userId>"] },
  { "id": "widget17167999853160001", "type": "input", "value": "Bot自动提交，请假期间如有紧急事项请联系直属上司。" }
]
```

`formJson` is `JSON.stringify(form)`.

## Approval and success message output

Build the connector-ready approval body for:

```text
POST /open-apis/approval/v4/instances
```

Approval body:

```json
{
  "approval_code": "BC26F7AB-3D6F-4F8F-90D0-9AC951651F23",
  "user_id": "<userId>",
  "user_id_type": "user_id",
  "form": "<JSON string form>"
}
```

Build the connector-ready success message body for:

```text
POST /open-apis/im/v1/messages?receive_id_type=open_id
```

Success text:

```text
✅ 审批已提交！

<reply_message>

请等待审批结果通知。
```

Skill output:

```json
{
  "message_type": "lark_hr_leave_approval",
  "summary": "HR leave approval for <userId> from <start_date> to <end_date>",
  "leaveRequest": {
    "openId": "<openId>",
    "userId": "<userId>",
    "leaderUserId": "<leaderUserId>",
    "leave_type_name": "<leave_type_name>",
    "leaveTypeId": "<leaveTypeId>",
    "regionValue": "lworxu8i-sfhnu3wcjep-0",
    "start_date": "<start_date>",
    "end_date": "<end_date>",
    "days": "<days or null>",
    "reason": "<reason>",
    "reply_message": "<reply_message>"
  },
  "form": ["<form array>"],
  "formJson": "<JSON string form>",
  "lark": {
    "approvalPath": "/open-apis/approval/v4/instances",
    "approvalBody": {
      "approval_code": "BC26F7AB-3D6F-4F8F-90D0-9AC951651F23",
      "user_id": "<userId>",
      "user_id_type": "user_id",
      "form": "<JSON string form>"
    },
    "messagePath": "/open-apis/im/v1/messages?receive_id_type=open_id",
    "successBody": {
      "receive_id": "<openId>",
      "msg_type": "text",
      "content": "{\"text\":\"✅ 审批已提交！\\n\\n<reply_message>\\n\\n请等待审批结果通知。\"}"
    }
  }
}
```

### Approval example

Input:

```json
{
  "openId": "ou_sender_open",
  "userInfo": {
    "user_id": "u_employee",
    "leader_user_id": "u_leader",
    "department_ids": ["od_sg"]
  },
  "aiResult": {
    "has_all_info": true,
    "leave_type_name": "Annual Leave",
    "start_date": "2026-06-05",
    "end_date": "2026-06-05",
    "days": 1,
    "reason": "家庭事务",
    "reply_message": "已为你整理 2026-06-05 的年假申请。"
  }
}
```

Output, with `formJson` abbreviated here only for readability:

```json
{
  "message_type": "lark_hr_leave_approval",
  "summary": "HR leave approval for u_employee from 2026-06-05 to 2026-06-05",
  "leaveRequest": {
    "openId": "ou_sender_open",
    "userId": "u_employee",
    "leaderUserId": "u_leader",
    "leave_type_name": "Annual Leave",
    "leaveTypeId": "7372430614034694176",
    "regionValue": "lworxu8i-sfhnu3wcjep-0",
    "start_date": "2026-06-05",
    "end_date": "2026-06-05",
    "days": 1,
    "reason": "家庭事务",
    "reply_message": "已为你整理 2026-06-05 的年假申请。"
  },
  "form": ["<exact form array from this contract>"],
  "formJson": "<JSON.stringify(form)>",
  "lark": {
    "approvalPath": "/open-apis/approval/v4/instances",
    "approvalBody": {
      "approval_code": "BC26F7AB-3D6F-4F8F-90D0-9AC951651F23",
      "user_id": "u_employee",
      "user_id_type": "user_id",
      "form": "<JSON.stringify(form)>"
    },
    "messagePath": "/open-apis/im/v1/messages?receive_id_type=open_id",
    "successBody": {
      "receive_id": "ou_sender_open",
      "msg_type": "text",
      "content": "{\"text\":\"✅ 审批已提交！\\n\\n已为你整理 2026-06-05 的年假申请。\\n\\n请等待审批结果通知。\"}"
    }
  }
}
```

## Missing fields

If required information is missing, return:

```json
{
  "needs_more_information": true,
  "missing": ["openId"]
}
```

If `leave_type_name` is not supported by the workflow's leave type map, return:

```json
{
  "needs_more_information": true,
  "missing": ["leaveTypeId"],
  "unsupported_leave_type_name": "<leave_type_name>"
}
```
