# CN reimbursement contract

This contract defines deterministic behavior for `cn-reimbursement-approval-payload-builder`.

## Original flow boundary

The original n8n workflow has these entry points:

1. `POST cn-reimbursement` Lark webhook for p2p file messages, `submit` / `提交` / `清空` commands, url verification, and legacy card callbacks.
2. `CN Review Form Trigger` at `cn-reimbursement-review` for finance review.
3. `CN Refresh Token Schedule` and `CN Refresh Token Webhook` for NyxID token refresh.
4. `_admin-cn-clear-trigger` for admin static-data reset.

This skill implements only deterministic event parsing and outbound payload construction. Token refresh, Lark history reads, attachment download, hashing ledger, OCR, contact lookup, static-data queueing, file upload, approval submission, serial-number fetch, and message sending stay in Aevatar.

Where the original workflow used OCR, pass the already-extracted receipt objects in `receipts`. Where the original workflow uploaded approval attachments, pass the returned file `code` values in `approval_uploads`.

## Mode: parse_event

Read the event body from `input.body` when present; otherwise read the root object.

If the body is a card callback with `body.type == "card"` and `body.action.value.submission_id`, return:

```json
{
  "action": "card_callback",
  "payload": {}
}
```

If the body has `type: "url_verification"`, return:

```json
{
  "action": "challenge",
  "challenge": "challenge-token",
  "webhook": {
    "body": {
      "challenge": "challenge-token"
    }
  }
}
```

Drop app-sent messages, non-p2p chats, missing senders, and invalid message content:

```json
{ "action": "drop", "reason": "not_p2p" }
```

For valid p2p messages:

- sender open id comes from `event.sender.sender_id.open_id`.
- message id comes from `event.message.message_id`.
- chat id comes from `event.message.chat_id`.
- text comes from parsed `event.message.content.text`, trimmed and lowercased.
- image attachment comes from `event.message.content.image_key`.
- file attachment comes from `event.message.content.file_key`.

Return `action: "trigger"` when text includes `submit`, includes `提交`, includes `清空`, or equals `clear`; otherwise return `action: "buffer_attachment"` when an image or file attachment exists; otherwise return `action: "drop"`.

Example input:

```json
{
  "mode": "parse_event",
  "body": {
    "event": {
      "sender": { "sender_type": "user", "sender_id": { "open_id": "ou_submitter" } },
      "message": {
        "chat_type": "p2p",
        "message_id": "om_1",
        "chat_id": "oc_1",
        "message_type": "image",
        "content": "{\"image_key\":\"img_1\"}"
      }
    }
  }
}
```

Example output:

```json
{
  "action": "buffer_attachment",
  "open_id": "ou_submitter",
  "message_id": "om_1",
  "chat_id": "oc_1",
  "text": "",
  "attachments": [
    { "kind": "image", "key": "img_1", "message_id": "om_1" }
  ]
}
```

## Mode: build_status_message

Build a connector-ready Lark text message for:

```text
POST /open-apis/im/v1/messages?receive_id_type=open_id
```

Output body shape:

```json
{
  "receive_id": "ou_xxx",
  "msg_type": "text",
  "content": "{\"text\":\"message text\"}"
}
```

Accepted aliases:

| Normalized field | Source fields |
|---|---|
| `status` | `status`, `message_status`, `type` |
| `open_id` | `open_id`, `openId`, `receive_id`, `receiveId` |
| `operator_open_id` | `operator_open_id`, `operatorOpenId`, `open_id`, `openId`, `receive_id`, `receiveId` |
| `submission_id` | `submission_id`, `submissionId` |
| `errors` | `errors` |

Status values and exact text:

| `status` | Required fields | Text |
|---|---|---|
| `buffered` | `open_id`, `buffered`, `total` | `📎 收到 <buffered> 个文件（共 <total> 个待提交）。全部上传完成后发送「提交」或 submit 触发报销流程。` |
| `no_attachments` | `open_id` | `没有发票，请先上传发票图片，再发送 submit 或 提交。` |
| `not_cn_roster` | `open_id` | `此工作流仅服务 CN 团队。如有疑问联系管理员。` |
| `submitter_received` | `open_id`, `submission_id` | `✅ 报销已收到，财务审核中。\nID: <submission_id>` |
| `cancel` | `operator_open_id` | `已取消本次报销。` |
| `invalid_split` | `operator_open_id`, `errors` | `核对失败：\n- <errors joined by "\n- ">\n\n请修改后再次点击 确认提交。` |
| `clear` | `open_id` | `已清空缓存。请重新上传发票，然后发送「提交」。` |
| `cooldown` | `open_id` | `上一笔报销刚提交，正在处理中。同一个用户 1 分钟内不能重复提交，请稍等。` |

Example input:

```json
{
  "mode": "build_status_message",
  "status": "buffered",
  "open_id": "ou_submitter",
  "buffered": 1,
  "total": 3
}
```

Example output:

```json
{
  "message_type": "lark_text_message",
  "status": "buffered",
  "lark": {
    "path": "/open-apis/im/v1/messages?receive_id_type=open_id",
    "body": {
      "receive_id": "ou_submitter",
      "msg_type": "text",
      "content": "{\"text\":\"📎 收到 1 个文件（共 3 个待提交）。全部上传完成后发送「提交」或 submit 触发报销流程。\"}"
    }
  }
}
```

## Mode: build_review_package

Build the finance-review notification payloads from the original `build-review-card` code node and `send-review-card` HTTP node.

Required input keys:

- `submission_id` or `submissionId`
- `open_id` or `openId`

Optional input keys:

- `payee_name` or `payeeName`
- `receipts`
- `attachments`
- `totals`

Constants copied from the workflow:

```json
{
  "reviewer_open_id": "ou_3d9067006e9fb8eb8e5fc7b2bb4c6264",
  "review_form_base_url": "https://n8n.aelf.dev/form/cn-reimbursement-review?submission_id="
}
```

Reviewer message text:

```text
📋 CN报销待审核 — <payee_name or ?>
发票: <receipts.length> 张
原币合计: <currency amount joined by " | " or ?>

📝 审核链接:
https://n8n.aelf.dev/form/cn-reimbursement-review?submission_id=<submission_id>
```

Each receipt or attachment with `message_id` produces a forward payload:

```json
{
  "path": "/open-apis/im/v1/messages/<message_id>/forward?receive_id_type=open_id",
  "body": { "receive_id": "ou_3d9067006e9fb8eb8e5fc7b2bb4c6264" }
}
```

Example input:

```json
{
  "mode": "build_review_package",
  "submission_id": "sub_001",
  "open_id": "ou_submitter",
  "payee_name": "Shaw Zheng",
  "totals": { "CNY": 123.45 },
  "receipts": [
    { "message_id": "om_receipt_1", "merchant": "Store", "original_currency": "CNY", "original_amount": 123.45 }
  ]
}
```

Example output:

```json
{
  "message_type": "cn_reimbursement_review_package",
  "submission_id": "sub_001",
  "form_url": "https://n8n.aelf.dev/form/cn-reimbursement-review?submission_id=sub_001",
  "reviewer_open_id": "ou_3d9067006e9fb8eb8e5fc7b2bb4c6264",
  "lark": {
    "reviewerMessage": {
      "path": "/open-apis/im/v1/messages?receive_id_type=open_id",
      "body": {
        "receive_id": "ou_3d9067006e9fb8eb8e5fc7b2bb4c6264",
        "msg_type": "text",
        "content": "{\"text\":\"📋 CN报销待审核 — Shaw Zheng\\n发票: 1 张\\n原币合计: CNY 123.45\\n\\n📝 审核链接:\\nhttps://n8n.aelf.dev/form/cn-reimbursement-review?submission_id=sub_001\"}"
      }
    },
    "forwardMessages": [
      {
        "path": "/open-apis/im/v1/messages/om_receipt_1/forward?receive_id_type=open_id",
        "body": { "receive_id": "ou_3d9067006e9fb8eb8e5fc7b2bb4c6264" }
      }
    ],
    "submitterAck": {
      "path": "/open-apis/im/v1/messages?receive_id_type=open_id",
      "body": {
        "receive_id": "ou_submitter",
        "msg_type": "text",
        "content": "{\"text\":\"✅ 报销已收到，财务审核中。\\nID: sub_001\"}"
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

- `user_id`
- `bank_card`
- `approvalDate` only when no receipt has a valid `YYYY-MM-DD` date
- either `rows`, or both `splits` and `actual_cny_total`

Accepted aliases:

| Normalized field | Source fields |
|---|---|
| `user_id` | `user_id`, `userId` |
| `bank_card` | `bank_card`, `bankCard` |
| `submission_id` | `submission_id`, `submissionId` |
| `open_id` | `open_id`, `openId` |
| `actual_cny_total` | `actual_cny_total`, `actualCnyTotal`, `cnyTotal` |
| `category_code` | `category_code`, `categoryCode` |
| `category_label` | `category_label`, `categoryLabel`, `category` |
| `default_subbrand` | `default_subbrand`, `defaultSubbrand` |
| `reimbursement_form_url` | `reimbursement_form_url`, `reimbursementFormUrl` |
| `approvalDate` | `approvalDate`, `fallbackDate`, `isoDate` |
| `approval_uploads` | `approval_uploads`, `approvalUploads` |

Subbrand approver constants from `resolve-row-approvers`:

```json
{
  "aelf network": ["bfb84d8a"],
  "AetherLink": ["6b15c721"],
  "Portkey": ["bfb84d8a"],
  "eBridge": ["bfb84d8a"]
}
```

Category code constants:

```json
{
  "技术服务费": "lwkkktxl-xsh7nzjrjb-9",
  "员工福利": "lwkkktxl-hsb5k4bhad5-5",
  "差旅费": "lwkkktx1-a5eycrbdol7-0",
  "办公费": "lwkkktx1-1lgmf4xvjn2-0",
  "Others": "mjch1lsy-kmowo0xjgxc-3"
}
```

Other constants:

```json
{
  "approval_code": "599F145B-9E25-4746-A2DA-7B87DB92AD0F",
  "cny_option": "lwpzlrza-zoo84ker6o-0",
  "disclaimer": "This approval was auto-generated by AI reimbursement recognition system. Data was reviewed and confirmed by Finance before submission."
}
```

Widget ids and types copied from `build-approval`:

| Field | id | type |
|---|---|---|
| field list | `widget17661255766760001` | `fieldList` |
| top attachment | `widget17165485097290001` | `attachmentV2` |
| remarks | `widget17667289445210001` | `input` |
| row department | `widget17675914385750001` | `input` |
| row department head | `widget17165475059790001` | `contact` |
| row date | `widget17661256619280001` | `date` |
| row category | `widget17165483685010001` | `radioV2` |
| row purpose | `widget17661277169490001` | `textarea` |
| row currency | `widget17168759377620001` | `radioV2` |
| row amount | `widget17661271904410001` | `amount` |
| row bank card | `widget17239470147730001` | `input` |

Date rule: use the first non-duplicate-independent receipt `date` matching `YYYY-MM-DD`. If none exists, use caller-provided `approvalDate`, `fallbackDate`, or `isoDate`. The n8n workflow used the execution date as fallback; this skill requires that date as input so output stays deterministic.

Purpose rule: use trimmed `purpose`; otherwise use `<default_subbrand or CN> 报销`.

Remarks rule:

- without `reimbursement_form_url`: use the disclaimer only.
- with `reimbursement_form_url`: append `\n\n报销明细表: <url>`.

Approval body shape:

```json
{
  "approval_code": "599F145B-9E25-4746-A2DA-7B87DB92AD0F",
  "user_id": "bfb84d8a",
  "form": "[{\"id\":\"widget17661255766760001\",\"type\":\"fieldList\",\"value\":[...]}]"
}
```

Example input:

```json
{
  "mode": "build_approval_instance",
  "submission_id": "sub_001",
  "open_id": "ou_submitter",
  "user_id": "u_submitter",
  "bank_card": "6214830197221087",
  "receipts": [
    { "message_id": "om_receipt_1", "date": "2026-04-08", "merchant": "Store", "original_currency": "CNY", "original_amount": 123.45 }
  ],
  "actual_cny_total": 123.45,
  "splits": {
    "aelf network": 123.45,
    "AetherLink": 0,
    "Portkey": 0,
    "eBridge": 0
  },
  "category_label": "技术服务费",
  "purpose": "Google Workspace 订阅费",
  "reimbursement_form_url": "https://example.feishu.cn/sheets/shtxxxx",
  "approval_uploads": [
    { "name": "receipt-1.jpg", "code": "file_code_1" }
  ]
}
```

Example output:

```json
{
  "message_type": "lark_approval_instance",
  "open_id": "ou_submitter",
  "submission_id": "sub_001",
  "form": [
    {
      "id": "widget17661255766760001",
      "type": "fieldList",
      "value": [
        [
          { "id": "widget17675914385750001", "type": "input", "value": "aelf network" },
          { "id": "widget17165475059790001", "type": "contact", "value": ["bfb84d8a"] },
          { "id": "widget17661256619280001", "type": "date", "value": "2026-04-08T00:00:00Z" },
          { "id": "widget17165483685010001", "type": "radioV2", "value": "lwkkktxl-xsh7nzjrjb-9" },
          { "id": "widget17661277169490001", "type": "textarea", "value": "Google Workspace 订阅费" },
          { "id": "widget17168759377620001", "type": "radioV2", "value": "lwpzlrza-zoo84ker6o-0" },
          { "id": "widget17661271904410001", "type": "amount", "value": 123.45, "currency": "CNY" },
          { "id": "widget17239470147730001", "type": "input", "value": "6214830197221087" }
        ]
      ]
    },
    { "id": "widget17165485097290001", "type": "attachmentV2", "value": ["file_code_1"] },
    {
      "id": "widget17667289445210001",
      "type": "input",
      "value": "This approval was auto-generated by AI reimbursement recognition system. Data was reviewed and confirmed by Finance before submission.\n\n报销明细表: https://example.feishu.cn/sheets/shtxxxx"
    }
  ],
  "approval_body": {
    "approval_code": "599F145B-9E25-4746-A2DA-7B87DB92AD0F",
    "user_id": "u_submitter",
    "form": "[{\"id\":\"widget17661255766760001\",\"type\":\"fieldList\",\"value\":[[{\"id\":\"widget17675914385750001\",\"type\":\"input\",\"value\":\"aelf network\"},{\"id\":\"widget17165475059790001\",\"type\":\"contact\",\"value\":[\"bfb84d8a\"]},{\"id\":\"widget17661256619280001\",\"type\":\"date\",\"value\":\"2026-04-08T00:00:00Z\"},{\"id\":\"widget17165483685010001\",\"type\":\"radioV2\",\"value\":\"lwkkktxl-xsh7nzjrjb-9\"},{\"id\":\"widget17661277169490001\",\"type\":\"textarea\",\"value\":\"Google Workspace 订阅费\"},{\"id\":\"widget17168759377620001\",\"type\":\"radioV2\",\"value\":\"lwpzlrza-zoo84ker6o-0\"},{\"id\":\"widget17661271904410001\",\"type\":\"amount\",\"value\":123.45,\"currency\":\"CNY\"},{\"id\":\"widget17239470147730001\",\"type\":\"input\",\"value\":\"6214830197221087\"}]]},{\"id\":\"widget17165485097290001\",\"type\":\"attachmentV2\",\"value\":[\"file_code_1\"]},{\"id\":\"widget17667289445210001\",\"type\":\"input\",\"value\":\"This approval was auto-generated by AI reimbursement recognition system. Data was reviewed and confirmed by Finance before submission.\\n\\n报销明细表: https://example.feishu.cn/sheets/shtxxxx\"}]"
  },
  "lark": {
    "path": "/open-apis/approval/v4/instances?user_id_type=user_id",
    "body": {
      "approval_code": "599F145B-9E25-4746-A2DA-7B87DB92AD0F",
      "user_id": "u_submitter",
      "form": "[{\"id\":\"widget17661255766760001\",\"type\":\"fieldList\",\"value\":[[{\"id\":\"widget17675914385750001\",\"type\":\"input\",\"value\":\"aelf network\"},{\"id\":\"widget17165475059790001\",\"type\":\"contact\",\"value\":[\"bfb84d8a\"]},{\"id\":\"widget17661256619280001\",\"type\":\"date\",\"value\":\"2026-04-08T00:00:00Z\"},{\"id\":\"widget17165483685010001\",\"type\":\"radioV2\",\"value\":\"lwkkktxl-xsh7nzjrjb-9\"},{\"id\":\"widget17661277169490001\",\"type\":\"textarea\",\"value\":\"Google Workspace 订阅费\"},{\"id\":\"widget17168759377620001\",\"type\":\"radioV2\",\"value\":\"lwpzlrza-zoo84ker6o-0\"},{\"id\":\"widget17661271904410001\",\"type\":\"amount\",\"value\":123.45,\"currency\":\"CNY\"},{\"id\":\"widget17239470147730001\",\"type\":\"input\",\"value\":\"6214830197221087\"}]]},{\"id\":\"widget17165485097290001\",\"type\":\"attachmentV2\",\"value\":[\"file_code_1\"]},{\"id\":\"widget17667289445210001\",\"type\":\"input\",\"value\":\"This approval was auto-generated by AI reimbursement recognition system. Data was reviewed and confirmed by Finance before submission.\\n\\n报销明细表: https://example.feishu.cn/sheets/shtxxxx\"}]"
    }
  }
}
```

## Mode: build_submitter_link_message

Build the final submitter message from `fetch-cn-serial` and `dm-submitter-link`.

Required inputs:

- `open_id`, `openId`, `receive_id`, or `receiveId`
- `instance_code` or `instanceCode`

Optional inputs:

- `serial_number` or `serialNumber`; default to `instance_code`
- `receipts`
- `totals`

Text rule:

```text
✅ 报销已提交审批！

发票：<non_duplicate_count> 张
金额：<amount currency joined by "、" or N/A>
Lark No：<serial_number>

发票明细：
1. <merchant or 未知商家> · <date if present> · <currency> <amount>
```

Duplicate receipts are excluded from the receipt count and detail lines.

Example input:

```json
{
  "mode": "build_submitter_link_message",
  "open_id": "ou_submitter",
  "instance_code": "F4A7",
  "serial_number": "202604080002",
  "totals": { "CNY": 123.45 },
  "receipts": [
    { "merchant": "Store", "date": "2026-04-08", "original_currency": "CNY", "original_amount": 123.45, "duplicate": false }
  ]
}
```

Example output:

```json
{
  "message_type": "lark_text_message",
  "instance_code": "F4A7",
  "serial_number": "202604080002",
  "lark": {
    "path": "/open-apis/im/v1/messages?receive_id_type=open_id",
    "body": {
      "receive_id": "ou_submitter",
      "msg_type": "text",
      "content": "{\"text\":\"✅ 报销已提交审批！\\n\\n发票：1 张\\n金额：123.45 CNY\\nLark No：202604080002\\n\\n发票明细：\\n1. Store · 2026-04-08 · CNY 123.45\"}"
    }
  }
}
```

## Missing fields

If required fields are absent or empty, return:

```json
{
  "needs_more_information": true,
  "missing": ["user_id", "bank_card"]
}
```

Unsupported modes or statuses return:

```json
{
  "skip": true,
  "reason": "unsupported mode"
}
```
