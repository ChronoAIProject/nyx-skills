# Petty cash approval contract

This contract defines deterministic behavior for `petty-cash-approval-payload-builder`.

## Original n8n flow boundary

The original workflow is named `P4 Petty Cash - Alex DM v2`. The workflow file defines:

1. A `POST` webhook at `p4-im-v2`.
2. Lark URL verification routing.
3. Lark event routing for `im.message.receive_v1`, `card.action.trigger`, and `approval_instance`.
4. P2P message parsing for allowlisted open ids.
5. Sheet reads, image download, drive upload, OCR, balance/session/PVC calculation, card updates, approval callback handling, and other Lark/NyxID I/O.

The workflow JSON in `_workflows/petty-cash-approval-payload-builder.json` contains references to later send nodes in `connections`, but those node definitions are not present in the `nodes` array. This skill therefore implements only the outbound approval body fields that are explicitly recoverable from the workflow config and Lark approval API shape: `approval_code`, `user_id`, and `form`. Aevatar remains responsible for token fetch, network calls, message sending, card sending/updating, approval submission, sheet reads/writes, image download, drive upload, OCR, and callback handling.

## Modes

The script reads JSON from stdin and accepts:

```json
{ "mode": "parse_event" }
```

or:

```json
{ "mode": "build_approval_instance" }
```

If `mode` is omitted, default to `parse_event`.

## Input shape

For both modes, the caller may pass the event body or fields directly, or wrap them under `body`. If `body` exists, workflow event parsing reads the Lark event from `body`; approval building reads field aliases from `body`.

## parse_event behavior

This mode mirrors the workflow nodes `lark-router v2` and `parse-event v2`.

### Verification and routing

If the body has `type: "url_verification"` or a `challenge`, return:

```json
{
  "skip": true,
  "routeKind": "verify",
  "is_challenge": true,
  "challenge": "<challenge>"
}
```

Use `body.header.event_type` for routing:

| Header event type | `routeKind` |
|---|---|
| `im.message.receive_v1` | `im` |
| `card.action.trigger` | `card.action` |
| `approval_instance` | `approval` |

Only `im` events are parsed further by this mode. Other routed events return `skip: true`.

### Defaults copied from workflow config

```json
{
  "alexOpenId": "ou_6cb891b9d89fe1ac1ba6c09c2a19d688",
  "allowedOpenIds": [
    "ou_6cb891b9d89fe1ac1ba6c09c2a19d688",
    "ou_e3a4a55f04b0a6c84d2b5e0ec0c8054d",
    "ou_dc1bba3aa2ddc537804f7716d271fcf5",
    "ou_8d2645a83e22201403fe5e492d01b3e9"
  ],
  "claimers": ["Kong", "Alex", "Michael", "John", "Stephan", "Zoe", "Wang", "Ada"],
  "properties": ["2 COVE WAY", "48A JLAN KG CHANTEK", "26E PIERCE ROAD"]
}
```

Callers may override `allowedOpenIds`, `allowed_open_ids`, `claimers`, or `properties`.

### Message filters

Return:

```json
{ "skip": true, "reason": "not_p2p" }
```

unless `body.event.message.chat_type` is `p2p`.

Return:

```json
{ "skip": true, "reason": "not_whitelisted", "senderOpenId": "<sender open id>" }
```

unless `body.event.sender.sender_id.open_id` is in `allowedOpenIds`.

Return:

```json
{ "skip": true, "reason": "unsupported_message_type" }
```

for message types other than `image` and `text`.

### Parsed output

Base fields:

```json
{
  "skip": false,
  "messageId": "<message.message_id>",
  "chatId": "<message.chat_id>",
  "senderOpenId": "<sender open_id>"
}
```

Image message output:

```json
{
  "skip": false,
  "messageId": "<message.message_id>",
  "chatId": "<message.chat_id>",
  "senderOpenId": "<sender open_id>",
  "kind": "image",
  "imageKey": "<content.image_key>"
}
```

Text is read from `JSON.parse(message.content).text`, trimmed.

Supported text commands:

| Text | Output |
|---|---|
| `提交` or `submit` | `kind: "submit"` |
| `申请充值 <amount> <CURRENCY> [note]` | `kind: "request_cash_in"`, numeric `amount`, uppercase `currency`, string `note` |
| `清空` or `clear` | `kind: "reset_remark"` |
| `新批次` or `new batch` | `kind: "new_batch"` |
| `关闭`, `结束`, or `close` | `kind: "close_row"` |
| `清空备注` or `reset remark` | `kind: "reset_remark"` |
| `备注 <text>` or `remark <text>` | `kind: "add_remark"`, `remark` |
| `换 <claimer> <property token>` | `kind: "switch_session"` when both tokens resolve |
| `建tab <yyyy> <Chinese month>` | `kind: "ensure_tab"`, `target_year`, `target_month_cn` |

Property matching lowercases and removes whitespace; a token matches when it is a prefix or substring of a configured property. Claimer matching is case-insensitive exact match.

Invalid switch output:

```json
{
  "kind": "switch_session_invalid",
  "reason": "claimer=<claimer or null> property=<property or null>"
}
```

For `建tab` without explicit year and month, this skill returns:

```json
{
  "needs_more_information": true,
  "missing": ["target_year", "target_month_cn"]
}
```

because the n8n workflow used `Date.now()` for this branch and this skill must remain deterministic.

## build_approval_instance behavior

This mode builds the connector-ready body for:

```text
POST /open-apis/approval/v4/instances
```

### Field aliases

Use the first non-empty value in the listed order.

| Normalized field | Source fields |
|---|---|
| `amount` | `amount`, `Amount`, `rechargeAmount`, `recharge_amount` |
| `currency` | `currency`, `Currency` |
| `reason` | `reason`, `Reason`, `note`, `Note`, `remark`, `Remark` |
| `sheetUrl` | `sheetUrl`, `sheet_url`, `sheetURL`, `sheet_url_value`, `url` |
| `userId` | `user_id`, `userId`, `open_id`, `openId`, `senderOpenId`, `operatorId` |
| `approvalCode` | `approval_code`, `approvalCode` |
| `reasonWidgetId` | `reasonWidgetId`, `reason_widget_id` |
| `amountWidgetId` | `amountWidgetId`, `amount_widget_id` |
| `sheetUrlWidgetId` | `sheetUrlWidgetId`, `sheet_url_widget_id` |

### Required fields

Required after alias normalization:

- `amount`
- `currency`
- `reason`
- `sheetUrl`
- `userId`

If any required field is missing or empty, return:

```json
{
  "needs_more_information": true,
  "missing": ["amount", "currency", "reason", "sheetUrl", "userId"]
}
```

### Defaults copied from workflow config

```json
{
  "approvalCode": "A258D96B-567C-4327-9C5B-C53500C0AED2",
  "widgetIds": {
    "reason": "widget17167786766400001",
    "amount": "widget17167786834600001",
    "sheet_url": "widget17167786925010001"
  },
  "currencyRange": ["SGD", "USD", "CNY"]
}
```

### Lark form

Build `form` as this array:

```json
[
  { "id": "widget17167786766400001", "type": "textarea", "value": "<reason>" },
  {
    "id": "widget17167786834600001",
    "type": "amount",
    "value": 3000,
    "currency": "SGD",
    "ext": { "currency": "SGD", "currencyRange": ["SGD", "USD", "CNY"] }
  },
  { "id": "widget17167786925010001", "type": "input", "value": "<sheetUrl>" }
]
```

The `form` field in the Lark approval body is `JSON.stringify(form)`.

### Output shape

Return:

```json
{
  "message_type": "lark_approval_instance",
  "summary": "Petty cash recharge approval for <currency> <amount>",
  "request": {
    "amount": 3000,
    "currency": "SGD",
    "reason": "<reason>",
    "sheetUrl": "<sheetUrl>",
    "userId": "<userId>"
  },
  "form": [
    { "id": "widget17167786766400001", "type": "textarea", "value": "<reason>" },
    {
      "id": "widget17167786834600001",
      "type": "amount",
      "value": 3000,
      "currency": "SGD",
      "ext": { "currency": "SGD", "currencyRange": ["SGD", "USD", "CNY"] }
    },
    { "id": "widget17167786925010001", "type": "input", "value": "<sheetUrl>" }
  ],
  "lark": {
    "path": "/open-apis/approval/v4/instances",
    "body": {
      "approval_code": "A258D96B-567C-4327-9C5B-C53500C0AED2",
      "user_id": "<userId>",
      "form": "<JSON string form>"
    }
  }
}
```

## Example: parse_event

Input:

```json
{
  "mode": "parse_event",
  "body": {
    "header": { "event_type": "im.message.receive_v1" },
    "event": {
      "sender": { "sender_id": { "open_id": "ou_6cb891b9d89fe1ac1ba6c09c2a19d688" } },
      "message": {
        "message_id": "om_123",
        "chat_id": "oc_123",
        "chat_type": "p2p",
        "message_type": "text",
        "content": "{\"text\":\"申请充值 3000 SGD 月度备用金补足\"}"
      }
    }
  }
}
```

Output:

```json
{
  "skip": false,
  "messageId": "om_123",
  "chatId": "oc_123",
  "senderOpenId": "ou_6cb891b9d89fe1ac1ba6c09c2a19d688",
  "kind": "request_cash_in",
  "amount": 3000,
  "currency": "SGD",
  "note": "月度备用金补足"
}
```

## Example: build_approval_instance

Input:

```json
{
  "mode": "build_approval_instance",
  "amount": 3000,
  "currency": "SGD",
  "reason": "月度备用金补足",
  "sheetUrl": "https://aelfblockchain.sg.larksuite.com/sheets/NmIisfa2KhgPlHtMWXrlneXFgvb",
  "userId": "ou_6cb891b9d89fe1ac1ba6c09c2a19d688"
}
```

Output:

```json
{
  "message_type": "lark_approval_instance",
  "summary": "Petty cash recharge approval for SGD 3000",
  "request": {
    "amount": 3000,
    "currency": "SGD",
    "reason": "月度备用金补足",
    "sheetUrl": "https://aelfblockchain.sg.larksuite.com/sheets/NmIisfa2KhgPlHtMWXrlneXFgvb",
    "userId": "ou_6cb891b9d89fe1ac1ba6c09c2a19d688"
  },
  "form": [
    { "id": "widget17167786766400001", "type": "textarea", "value": "月度备用金补足" },
    {
      "id": "widget17167786834600001",
      "type": "amount",
      "value": 3000,
      "currency": "SGD",
      "ext": { "currency": "SGD", "currencyRange": ["SGD", "USD", "CNY"] }
    },
    {
      "id": "widget17167786925010001",
      "type": "input",
      "value": "https://aelfblockchain.sg.larksuite.com/sheets/NmIisfa2KhgPlHtMWXrlneXFgvb"
    }
  ],
  "lark": {
    "path": "/open-apis/approval/v4/instances",
    "body": {
      "approval_code": "A258D96B-567C-4327-9C5B-C53500C0AED2",
      "user_id": "ou_6cb891b9d89fe1ac1ba6c09c2a19d688",
      "form": "[{\"id\":\"widget17167786766400001\",\"type\":\"textarea\",\"value\":\"月度备用金补足\"},{\"id\":\"widget17167786834600001\",\"type\":\"amount\",\"value\":3000,\"currency\":\"SGD\",\"ext\":{\"currency\":\"SGD\",\"currencyRange\":[\"SGD\",\"USD\",\"CNY\"]}},{\"id\":\"widget17167786925010001\",\"type\":\"input\",\"value\":\"https://aelfblockchain.sg.larksuite.com/sheets/NmIisfa2KhgPlHtMWXrlneXFgvb\"}]"
    }
  }
}
```

## Isolation

This skill does not fetch or store Lark tenant access tokens, NyxID bearers, OAuth credentials, or app secrets. It does not call network endpoints, read Lark sheets or Bitable, download images, upload files, run OCR, call an LLM, send Lark messages, update interactive cards, submit approvals, or invent missing requester ids, sheet URLs, records, receipt fields, model output, tokens, or approvers.
