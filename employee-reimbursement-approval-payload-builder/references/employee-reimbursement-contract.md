# Employee reimbursement contract

This contract defines deterministic behavior for `employee-reimbursement-approval-payload-builder`.

## Original flow boundary

The original n8n workflow has these entry points:

1. `POST lark-reimbursement` Lark webhook for p2p file/image messages, `submit` / `提交` / `报销` / `完成` / `done` / `go`, `clear` / `清空` / `取消` / `cancel`, URL verification, and CN card forwarding.
2. `Review Form Trigger` plus `Review Reimbursement` for finance confirmation.
3. `Refresh Token Schedule`, `Refresh Token Webhook`, admin setters, router-cache dump, and Crystal backfill utilities.

This skill implements only deterministic event parsing and outbound payload construction. Token refresh, CN forwarding, file download, file upload to `/approval/v4/files/upload`, OCR/LLM calls, Bitable reads and writes, Lark contact lookup, related-approval search, original-message forwarding execution, approval submission, approval-detail fetch, and pending-row cleanup stay in Aevatar.

Where the original workflow used OCR, pass already-extracted OCR objects in `pending[].ocr`. Where it uploaded approval attachments, pass the resulting file token in `pending[].file_token`. Where it resolved a related approval serial number, pass the resolved instance code as `related_approval_instance_code`.

## Mode: parse_event

Read the event body from `input.body` when present; otherwise read the root object.

If `body.type == "url_verification"`, return:

```json
{
  "route": "challenge",
  "challenge": "challenge-token",
  "webhook": {
    "body": { "challenge": "challenge-token" }
  }
}
```

If the body is a CN card callback with `body.type == "card"` and `body.action.value.submission_id`, return:

```json
{ "route": "ignore", "reason": "forwarded_cn_card" }
```

For Lark p2p message events:

- reject non-p2p messages with `reason: "group_disabled_dm_only"`.
- reject app-sent messages with `reason: "bot_self"`.
- file/image messages return `route: "file"` with `user_id`, `open_id`, `chat_id`, `msg_id`, `msg_type`, `file_key`, and `file_name`.
- text containing `清空`, `取消`, `clear`, or `cancel` returns `route: "clear"`.
- text containing `提交`, `报销`, `完成`, `submit`, `done`, or `go` returns `route: "submit"`.
- other messages return `route: "ignore"` and `reason: "unsupported_message"`.

Example input:

```json
{
  "mode": "parse_event",
  "body": {
    "event": {
      "sender": { "sender_type": "user", "sender_id": { "user_id": "u_1", "open_id": "ou_1" } },
      "message": {
        "chat_type": "p2p",
        "message_type": "file",
        "message_id": "om_1",
        "chat_id": "oc_1",
        "content": "{\"file_key\":\"file_1\",\"file_name\":\"invoice.pdf\"}"
      }
    }
  }
}
```

Example output:

```json
{
  "route": "file",
  "user_id": "u_1",
  "open_id": "ou_1",
  "chat_id": "oc_1",
  "msg_id": "om_1",
  "msg_type": "file",
  "file_key": "file_1",
  "file_name": "invoice.pdf"
}
```

## Mode: build_status_message

Build one connector-ready Lark text message. Output body shape:

```json
{
  "receive_id": "oc_or_ou",
  "msg_type": "text",
  "content": "{\"text\":\"message text\"}"
}
```

Accepted aliases:

| Normalized field | Source fields |
|---|---|
| `status` | `status`, `message_status`, `messageStatus`, `type` |
| `chat_id` | `chat_id`, `chatId`, `receive_id`, `receiveId` |
| `open_id` | `open_id`, `openId`, `receive_id`, `receiveId` |
| `file_name` | `file_name`, `fileName` |
| `count` | `count`, `pending_count`, `pendingCount` |
| `stale_count` | `stale_count`, `staleCount` |
| `invoice_number` | `invoice_number`, `invoiceNumber` |
| `ocr_vendor` | `ocr_vendor`, `ocrVendor` |
| `ocr_amount` | `ocr_amount`, `ocrAmount` |
| `ocr_currency` | `ocr_currency`, `ocrCurrency` |
| `cleared_count` | `cleared_count`, `clearedCount` |

Status values:

| `status` | Required fields | Path |
|---|---|---|
| `file_received` | `chat_id`, `file_name`, `count` | `/open-apis/im/v1/messages?receive_id_type=chat_id` |
| `no_pending` | `chat_id` | `/open-apis/im/v1/messages?receive_id_type=chat_id` |
| `cleared` | `chat_id`, `cleared_count` | `/open-apis/im/v1/messages?receive_id_type=chat_id` |
| `cooldown` | `open_id` | `/open-apis/im/v1/messages?receive_id_type=open_id` |

Exact text rules:

```text
file_received:
<prefix>Received <file_name><ocr text><duplicate text>
📎 Pending: <count> file(s). Send "提交/submit" when ready.<stale text>

prefix:
⚠️ DUPLICATE —  when is_duplicate is true
⚠️  when ocr_failed is true
✅  otherwise

ocr text:
 (OCR failed, manual input needed) when ocr_failed is true
 — <ocr_vendor> <ocr_amount> <ocr_currency> otherwise

duplicate text:
\n🔴 Duplicate invoice detected! Invoice# <invoice_number> already in pending. Send "清空/clear" to reset.

stale text:
\n⏰ Warning: <stale_count> file(s) pending > 24h. Send "提交/submit" or "清空/clear".

no_pending:
No pending files. Please send invoice files first. / 没有待处理的文件，请先发送发票文件。

cleared:
Pending files cleared (<cleared_count> removed) / 已清空暂存文件（<cleared_count> 个）

cooldown:
上一笔报销刚提交，正在处理中。同一个用户 1 分钟内不能重复提交，请稍等。
```

Example input:

```json
{
  "mode": "build_status_message",
  "status": "file_received",
  "chat_id": "oc_1",
  "file_name": "invoice.pdf",
  "count": 2,
  "ocr_vendor": "OpenAI",
  "ocr_amount": "20",
  "ocr_currency": "SGD"
}
```

Example output:

```json
{
  "message_type": "lark_text_message",
  "status": "file_received",
  "lark": {
    "path": "/open-apis/im/v1/messages?receive_id_type=chat_id",
    "body": {
      "receive_id": "oc_1",
      "msg_type": "text",
      "content": "{\"text\":\"✅ Received invoice.pdf — OpenAI 20 SGD\\n📎 Pending: 2 file(s). Send \\\"提交/submit\\\" when ready.\"}"
    }
  }
}
```

## Mode: build_review_package

Build the finance-review notification package from `save-for-review` and `dm-finance`.

Required input:

- `submission_id` or `submissionId`

Optional input:

- `pending`
- `count`
- `employee_name`
- `submitter_nickname`
- `submitter_email`
- `ocr_summary`
- `primary_currency`
- `total_amount`
- `mixed_currency`
- `has_ocr_failures`
- `has_duplicates`
- `duplicate_count`

If `pending` is present, the script deterministically derives the same aggregate fields as `aggregate-invoices`: `ocr_summary`, `combined_description`, `all_file_tokens`, `all_invoice_numbers`, `all_vendors`, `primary_currency`, `total_amount`, `first_date`, `mixed_currency`, `has_ocr_failures`, `has_duplicates`, and `duplicate_count`. If no pending invoice has a date, pass `first_date`, `firstDate`, `fallback_date`, or `fallbackDate`; the skill does not use the current date.

Constants copied from the workflow:

```json
{
  "reviewer_open_id": "ou_3d9067006e9fb8eb8e5fc7b2bb4c6264",
  "review_form_base_url": "https://n8n.aelf.dev/form/reimbursement-review?submission_id="
}
```

Each pending invoice with `msg_id` produces a forward payload:

```json
{
  "path": "/open-apis/im/v1/messages/<msg_id>/forward?receive_id_type=open_id",
  "body": { "receive_id": "ou_3d9067006e9fb8eb8e5fc7b2bb4c6264" }
}
```

Example input:

```json
{
  "mode": "build_review_package",
  "submission_id": "sub_001",
  "employee_name": "WU NAN",
  "submitter_email": "crystal.wu@aelf.io",
  "pending": [
    {
      "msg_id": "om_1",
      "file_token": "file_token_1",
      "file_name": "invoice.pdf",
      "ocr": {
        "vendor": "OpenAI",
        "amount": "20",
        "currency": "SGD",
        "date": "2026-04-15",
        "invoice_number": "INV-1",
        "description": "ChatGPT Team"
      }
    }
  ]
}
```

Example output:

```json
{
  "message_type": "employee_reimbursement_review_package",
  "submission_id": "sub_001",
  "form_url": "https://n8n.aelf.dev/form/reimbursement-review?submission_id=sub_001",
  "reviewer_open_id": "ou_3d9067006e9fb8eb8e5fc7b2bb4c6264",
  "aggregate": {
    "count": 1,
    "primary_currency": "SGD",
    "total_amount": 20,
    "mixed_currency": false,
    "has_ocr_failures": false,
    "has_duplicates": false,
    "duplicate_count": 0
  },
  "lark": {
    "reviewerHeader": {
      "path": "/open-apis/im/v1/messages?receive_id_type=open_id",
      "body": {
        "receive_id": "ou_3d9067006e9fb8eb8e5fc7b2bb4c6264",
        "msg_type": "text",
        "content": "{\"text\":\"📎 New reimbursement — 1 file(s) from WU NAN\\nOriginals below. Review link follows.\"}"
      }
    },
    "forwardMessages": [
      {
        "path": "/open-apis/im/v1/messages/om_1/forward?receive_id_type=open_id",
        "body": { "receive_id": "ou_3d9067006e9fb8eb8e5fc7b2bb4c6264" }
      }
    ],
    "financeMessage": {
      "path": "/open-apis/im/v1/messages?receive_id_type=open_id",
      "body": {
        "receive_id": "ou_3d9067006e9fb8eb8e5fc7b2bb4c6264",
        "msg_type": "text",
        "content": "{\"text\":\"📋 New Reimbursement (1 invoices)\\nFrom: WU NAN (crystal.wu@aelf.io)\\n\\n[Invoice 1] invoice.pdf\\n  Vendor:       OpenAI\\n  Amount:       20 SGD\\n  Date:         2026-04-15\\n  Invoice#:     INV-1\\n  Subscription: N/A\\n  Period:       N/A\\n  Description:  ChatGPT Team\\n\\nTotal: 20 SGD\\n\\n📝 Review & Submit: https://n8n.aelf.dev/form/reimbursement-review?submission_id=sub_001\"}"
      }
    }
  }
}
```

## Mode: build_approval_instance

Build the connector-ready request body for:

```text
POST /open-apis/approval/v4/instances?user_id_type=user_id
```

Required normalized inputs:

- `submitter_user_id`, `submitterUserId`, `user_id`, or `userId`
- `pending`, an array of OCR-normalized invoice items

Finance review fields may be passed at the root or under `review`, `review_fields`, or `reviewFields`. The lookup follows the original `getReview` logic: exact label, lowercase label, underscore lowercase label, whitespace-removed lowercase label, then case-insensitive comparison with spaces, underscores, and hyphens removed.

Review labels:

| Label | Default or rule |
|---|---|
| `Exclude Invoices` | comma, semicolon, or whitespace separated 1-based invoice indexes |
| `Reimbursement Category` | default `技术服务费` |
| `Currency` | default `SGD` |
| `Amount` | default sum of kept invoice OCR amounts |
| `Receipt Date` | default `first_date`; pass a fallback date instead of relying on current time |
| `Expense Description` | default kept invoice descriptions |
| `Department` | default `employee_department`, then `Finance` |
| `Payee Name` | default `employee_name`, then empty string |
| `Bank Name` | default `employee_bank_name`, then empty string |
| `Bank Account` | default `employee_bank_account`, then empty string |
| `Related Approval` | UUID is used directly; a serial number must be resolved by Aevatar and passed as `related_approval_instance_code` |
| `Remark` | default empty string |

Category constants:

```json
{
  "技术服务费": "lwkkktxl-xsh7nzjrjb-9",
  "员工福利": "lwkkktxl-hsb5k4bhad5-5",
  "差旅费": "lwkkktx1-a5eycrbdol7-0",
  "办公费": "lwkkktx1-1lgmf4xvjn2-0",
  "Others": "mjch1lsy-kmowo0xjgxc-3"
}
```

Currency constants:

```json
{
  "CNY": "lwpzlrza-zoo84ker6o-0",
  "SGD": "lwpzlrza-w81tf7okwq-0",
  "USDT": "lwpzlrza-ppsossh61bd-0"
}
```

Widget ids and types copied from `build-approval`:

| Field | id | type |
|---|---|---|
| field list | `widget17661255766760001` | `fieldList` |
| related approval | `widget17165489347490001` | `connect` |
| remarks | `widget17667289445210001` | `input` |
| row department | `widget17675914385750001` | `input` |
| row department head | `widget17165475059790001` | `contact` |
| row date | `widget17661256619280001` | `date` |
| row category | `widget17165483685010001` | `radioV2` |
| row short description | `widget17661266428940001` | `input` |
| row description | `widget17661277169490001` | `textarea` |
| row currency | `widget17168759377620001` | `radioV2` |
| row amount | `widget17661271904410001` | `amount` |
| row payee name | `widget17661238520260001` | `input` |
| row bank name | `widget17661239274280001` | `input` |
| row bank account | `widget17661240576810001` | `input` |
| row attachment | `widget17165484992290001` | `attachmentV2` |

Approval body shape:

```json
{
  "approval_code": "599F145B-9E25-4746-A2DA-7B87DB92AD0F",
  "user_id": "u_submitter",
  "form": "[{\"id\":\"widget17661255766760001\",\"type\":\"fieldList\",\"value\":[...]}]"
}
```

The returned `approval_body` field is a JSON string because the n8n `Submit Lark Approval` node read `$json.approval_body`; `approvalBody` and `lark.body` expose the same body as an object for Aevatar connectors.

Example input:

```json
{
  "mode": "build_approval_instance",
  "submitter_user_id": "u_submitter",
  "employee_department": "Human Resources",
  "employee_department_head_id": "u_head",
  "employee_name": "WU NAN",
  "employee_bank_name": "DBS Bank",
  "employee_bank_account": "186522257",
  "pending": [
    {
      "file_token": "file_token_1",
      "file_name": "invoice.pdf",
      "ocr": {
        "vendor": "OpenAI",
        "amount": "20",
        "currency": "SGD",
        "date": "2026-04-15",
        "invoice_number": "INV-1",
        "description": "ChatGPT Team"
      }
    }
  ],
  "review": {
    "Reimbursement Category": "技术服务费",
    "Currency": "SGD",
    "Amount": "20",
    "Receipt Date": "2026-04-15",
    "Expense Description": "ChatGPT Team",
    "Remark": "Reviewed by Finance"
  }
}
```

Example output shape:

```json
{
  "message_type": "lark_approval_instance",
  "approval_body": "{\"approval_code\":\"599F145B-9E25-4746-A2DA-7B87DB92AD0F\",\"user_id\":\"u_submitter\",\"form\":\"[...]\"}",
  "approvalBody": {
    "approval_code": "599F145B-9E25-4746-A2DA-7B87DB92AD0F",
    "user_id": "u_submitter",
    "form": "[...]"
  },
  "applicant_id": "u_submitter",
  "category": "技术服务费",
  "currency": "SGD",
  "amount": 20,
  "payee_name": "WU NAN",
  "kept_count": 1,
  "excluded_count": 0,
  "excluded_msg": "",
  "lark": {
    "path": "/open-apis/approval/v4/instances?user_id_type=user_id",
    "body": {
      "approval_code": "599F145B-9E25-4746-A2DA-7B87DB92AD0F",
      "user_id": "u_submitter",
      "form": "[...]"
    }
  }
}
```

## Mode: build_result_messages

Build the final chat and submitter DMs from `reply-result` and `dm-submitter`.

Required inputs:

- `chat_id` or `chatId`
- `submitter_open_id`, `submitterOpenId`, `open_id`, or `openId`
- `count`
- `amount`
- `currency`
- `serial_number`, `serialNumber`, `lark_no`, `larkNo`, `instance_code`, or `instanceCode`

Optional inputs:

- `excluded_msg` or `excludedMsg`
- `submitter_nickname` or `submitterNickname`
- `payee_name` or `payeeName`
- `ocr_summary` or `ocrSummary`
- `approval_detail` or `approvalDetail` with `data.serial_number`

Chat text:

```text
✅ Reimbursement submitted! / 报销审批已提交！
📋 <count> invoice(s)<excluded_msg>
💰 <amount> <currency>
👤 <submitter_nickname or payee_name>
📎 Lark No: <serial_number>
```

Submitter text:

```text
✅ Your reimbursement has been submitted! / 你的报销已提交！

Invoices: <count><excluded_msg>
Amount: <amount> <currency>
Lark No: <serial_number>

<ocr_summary>
```

Example input:

```json
{
  "mode": "build_result_messages",
  "chat_id": "oc_1",
  "submitter_open_id": "ou_1",
  "count": 1,
  "amount": 20,
  "currency": "SGD",
  "payee_name": "WU NAN",
  "serial_number": "202604150001",
  "ocr_summary": "\n[Invoice 1] invoice.pdf\n  Vendor:       OpenAI\n"
}
```

Example output:

```json
{
  "message_type": "employee_reimbursement_result_messages",
  "serial_number": "202604150001",
  "lark": {
    "chatMessage": {
      "path": "/open-apis/im/v1/messages?receive_id_type=chat_id",
      "body": {
        "receive_id": "oc_1",
        "msg_type": "text",
        "content": "{\"text\":\"✅ Reimbursement submitted! / 报销审批已提交！\\n📋 1 invoice(s)\\n💰 20 SGD\\n👤 WU NAN\\n📎 Lark No: 202604150001\"}"
      }
    },
    "submitterMessage": {
      "path": "/open-apis/im/v1/messages?receive_id_type=open_id",
      "body": {
        "receive_id": "ou_1",
        "msg_type": "text",
        "content": "{\"text\":\"✅ Your reimbursement has been submitted! / 你的报销已提交！\\n\\nInvoices: 1\\nAmount: 20 SGD\\nLark No: 202604150001\\n\\n\\n[Invoice 1] invoice.pdf\\n  Vendor:       OpenAI\\n\"}"
      }
    }
  }
}
```

## Missing fields

If required fields are absent or empty, return:

```json
{
  "needs_more_information": true,
  "missing": ["chat_id"]
}
```

Unsupported modes or statuses return:

```json
{
  "skip": true,
  "reason": "unsupported mode"
}
```
