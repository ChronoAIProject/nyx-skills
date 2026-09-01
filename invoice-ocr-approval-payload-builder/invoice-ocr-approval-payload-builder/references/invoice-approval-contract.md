# Invoice approval contract

This contract defines deterministic behavior for `invoice-ocr-approval-payload-builder`.

## Original flow boundary

The original n8n workflow has these linear steps:

1. Receive an n8n hosted form submission with `Submitter Email` and `Invoice File`.
2. Build a GPT-4o OCR request for each file.
3. Parse OCR responses into `invoices`.
4. Upload invoice files to Lark and collect approval file tokens.
5. Query related Lark approvals for review context.
6. Show a human review form.
7. Look up the applicant and department head in Lark contacts.
8. Build `approval_body`.
9. Call `POST /open-apis/approval/v4/instances?user_id_type=user_id`.
10. Verify and query the created approval instance.

This skill implements step 8 only. OCR, file upload, token exchange, contact lookup, related approval serial lookup, API submission, and post-submit verification stay in Aevatar or NyxID.

## Input shape

The caller may pass the event body directly or wrap it in `body`. If `body` exists, read fields from `body`; otherwise read fields from the root object.

The default and only supported mode is:

```json
{ "mode": "build_approval" }
```

If `mode` is absent, use `build_approval`.

## Field aliases

Use the first non-empty value in the listed order.

| Normalized field | Source fields |
|---|---|
| `invoices` | `invoices`, `parsed.invoices`, `ocr.invoices`, single object `invoice` |
| `applicantOpenId` | `applicantOpenId`, `applicant_open_id`, `applicantUserId`, `applicant_user_id`, `open_id`, `openId`, `user_id`, `userId`, `applicant.open_id`, `applicant.user_id`, `lookupApplicant.data.user_list[0].open_id`, `lookupApplicant.data.user_list[0].user_id` |
| `department` | review field `Department`, `department`, `Department` |
| `deptHeadId` | `deptHeadId`, `dept_head_id`, `departmentHeadId`, `department_head_id`, `departmentHeadOpenId`, `department_head_open_id`, `leader_user_id`, `leaderUserId`, `departmentHead.open_id`, `departmentHead.user_id` |
| `deptHeadSource` | `deptHeadSource`, `dept_head_source` |
| `approvalCode` | `approvalCode`, `approval_code` |
| `executionDate` | `executionDate`, `execution_date`, `today` |
| `attachments` | `attachments`, `upload.attachments`, `uploadInvoiceToLark.attachments`, `upload_invoice_to_lark.attachments` |
| `relatedApprovalId` | `relatedApprovalId`, `related_approval_id`, `relatedApprovalInstanceCode`, `related_approval_instance_code`, `relatedInstanceCode`, `related_instance_code`, review field `Related Approval ID`, review field `Related Approval` when it is already a UUID instance id |
| `remark` | review field `Remark`, `remark`, `Remark`, `parsed.remark` |

Review fields may be passed in `review`, `reviewRaw`, `review_raw`, `reviewFields`, `review_fields`, or at the root. Labels use the same variants as the n8n `build-approval` code: exact label, lowercase, spaces changed to `_`, spaces changed to `-`, and spaces removed.

The original review form includes `Invoice Date` and `Invoice Number`, but the original `build-approval` node does not read those review fields. This skill follows the outbound node and reads `invoice.date` and `invoice.invoice_number` from normalized OCR input.

## Required data

Required after alias normalization:

```json
{
  "invoices": [],
  "applicantOpenId": "ou_xxx",
  "department": "DevOps"
}
```

Each invoice row also requires:

| Invoice field | Rule |
|---|---|
| `amount` | Required unless a reviewed `Amount` value is supplied for that row |
| `date` | Required unless `executionDate` is supplied explicitly |
| `vendor` | Required unless reviewed `Vendor` is supplied |

`relatedApprovalId` is optional. If a 12-digit serial number is passed, the script returns `needs_more_information` because the original workflow resolved serial numbers with Lark network calls.

## Defaults

```json
{
  "approvalCode": "F640097D-0A68-47C1-A7BC-86659BC4B06F",
  "currency": "SGD",
  "paymentEntity": "ChronoAI Pte Ltd (法币支付)",
  "deptHeadId": "same as applicantOpenId when absent",
  "deptHeadSource": "self when deptHeadId defaults, otherwise input"
}
```

If an invoice lacks `bank_name`, `bank_account`, or `swift_code`, preserve the original workflow placeholders:

```json
{
  "bank_name": "TBD - please fill",
  "bank_account": "TBD - please fill",
  "swift_code": "TBD"
}
```

## Payment entity option ids

```json
{
  "ChronoAI Pte Ltd (法币支付)": "lwpsdr33-27z0rv3m3t4-0",
  "ECHO AI Pte Ltd（法币支付）": "m985jjql-nv5p6wxbf3-1",
  "Portkey Singapore Entity (法币支付)": "lwpsdr33-1ogx09m8w4w-0",
  "Eregion Labs Pte Ltd（法币支付）": "lwpu4gg8-7utwc7j0g5-1",
  "AELF INVEST": "lwpsdr33-zgezrnen1e-0",
  "DigitalAsset Payment": "lwpsqbd0-edoqopnuje7-1"
}
```

Other fixed option ids:

```json
{
  "NO_MARKETING": "m1er13p8-jy4c1eb1le-0",
  "NO_HR": "miig2pwk-4bx8l7d96pf-0",
  "NO_CONTRACT": "lwpsq1d7-72ixwmka1jh-0",
  "YES_CONTRACT": "lwpsq1d7-v8f220gwhp-0",
  "WAY_BANK_TRANSFER": "lwpsti1z-5ogmo0ul3vb-0"
}
```

For `DigitalAsset Payment`, add widget `widget17241241332240001` with:

```text
amount < 5000      -> m01uzre5-3vbzwd8wl3b-0
amount <= 50000    -> m01uzre5-pjmscdzhzbr-0
amount > 50000     -> m01uzre5-xcbztagc13-0
```

## Per-invoice row

For each invoice, build one row inside field list widget `widget17168633868040001`.

Base row fields:

```json
[
  { "id": "widget17168644567560001", "type": "contact", "value": ["<deptHeadId>"] },
  { "id": "widget17168638060470001", "type": "radioV2", "value": "<paymentType>" },
  { "id": "widget17270803199920001", "type": "radioV2", "value": "m1er13p8-jy4c1eb1le-0" },
  { "id": "widget17643090840670001", "type": "radioV2", "value": "miig2pwk-4bx8l7d96pf-0" },
  { "id": "widget17168643792430001", "type": "radioV2", "value": "<contractOption>" }
]
```

If `relatedApprovalId` exists, append:

```json
{ "id": "widget17168655594420001", "type": "connect", "value": ["<relatedApprovalId>"] }
```

Then append:

```json
[
  { "id": "widget17168645326090001", "type": "textarea", "value": "<finalDesc> (Invoice: <invoice_number or N/A>)" },
  { "id": "widget17168645408360001", "type": "radioV2", "value": "lwpsti1z-5ogmo0ul3vb-0" }
]
```

For normal fiat entities, append:

```json
{
  "id": "widget17168648705100001",
  "type": "amount",
  "value": 1280.5,
  "currency": "SGD",
  "ext": {
    "currency": "SGD",
    "currencyRange": ["USD", "CNY", "SGD"]
  }
}
```

For `AELF INVEST` or `DigitalAsset Payment`, append:

```json
{ "id": "widget17168648709360001", "type": "number", "value": "1280.5" }
```

For `DigitalAsset Payment`, also append the threshold widget described above.

Then append:

```json
[
  { "id": "widget16487160384360001", "type": "date", "value": "<invoice.date>T00:00:00Z" },
  { "id": "widget17168661650480001", "type": "input", "value": "<reviewed Vendor or invoice.vendor>" },
  { "id": "widget17168661652050001", "type": "input", "value": "<bank_name or TBD - please fill>" },
  { "id": "widget17168661653930001", "type": "input", "value": "<bank_account or TBD - please fill>" },
  { "id": "widget17168661664870001", "type": "input", "value": "<swift_code or TBD>" },
  { "id": "widget17168769083410001", "type": "textarea", "value": "<finalDesc>" },
  { "id": "widget17168764909530001", "type": "date", "value": "<invoice.date plus 30 days>T00:00:00Z" }
]
```

`finalDesc` is review field `Description N`, otherwise `invoice.description`, otherwise `Payment to <invoice.vendor>`.

## Form data

Build `form` as this array:

```json
[
  {
    "id": "widget17168633868040001",
    "type": "fieldList",
    "value": ["<one row array per invoice>"]
  },
  {
    "id": "widget16487161419060001",
    "type": "attachmentV2",
    "value": ["<file_token>"]
  },
  {
    "id": "widget16487161430270001",
    "type": "textarea",
    "value": "<remark plus AI disclaimer>"
  }
]
```

Omit the attachment widget when there are no file tokens.

The AI disclaimer is always:

```text
This approval was auto-generated by AI invoice recognition system. Data was reviewed and confirmed by the submitter before submission.
```

If `remark` is present, the remark widget value is:

```text
<remark>

This approval was auto-generated by AI invoice recognition system. Data was reviewed and confirmed by the submitter before submission.
```

Otherwise it is only the disclaimer.

## Lark approval body

Build the connector-ready request body as:

```json
{
  "approval_code": "<approvalCode>",
  "user_id": "<applicantOpenId>",
  "form": "<JSON string form>"
}
```

The workflow node named `Create Lark Approval` sends this body to:

```text
POST /open-apis/approval/v4/instances?user_id_type=user_id
```

## Output shape

Return:

```json
{
  "message_type": "lark_approval_instance",
  "summary": "Invoice approval for 1 invoice",
  "invoice_count": 1,
  "applicant_open_id": "<applicantOpenId>",
  "dept_head_id": "<deptHeadId>",
  "dept_head_source": "input",
  "department": "DevOps",
  "shared_currency": "SGD",
  "shared_entity": "ChronoAI Pte Ltd (法币支付)",
  "related_approval_id": null,
  "form": ["<parsed form array>"],
  "approval_body": "{\"approval_code\":\"F640097D-0A68-47C1-A7BC-86659BC4B06F\",\"user_id\":\"<applicantOpenId>\",\"form\":\"<JSON string form>\"}",
  "lark": {
    "path": "/open-apis/approval/v4/instances?user_id_type=user_id",
    "body": {
      "approval_code": "F640097D-0A68-47C1-A7BC-86659BC4B06F",
      "user_id": "<applicantOpenId>",
      "form": "<JSON string form>"
    }
  }
}
```

`approval_body` is included for exact n8n parity because the original node returned `$json.approval_body` as a JSON string. `lark.body` is the parsed connector-ready body.

## Example

Input:

```json
{
  "mode": "build_approval",
  "applicantOpenId": "ou_applicant_001",
  "deptHeadId": "ou_leader_002",
  "deptHeadSource": "input",
  "department": "DevOps",
  "review": {
    "Vendor": "ACME Pte Ltd",
    "Amount": "1280.50",
    "Currency": "SGD",
    "Payment Entity": "ChronoAI Pte Ltd (法币支付)",
    "Description 1": "Cloud hosting for May",
    "Remark": "Urgent vendor payment"
  },
  "invoices": [
    {
      "vendor": "ACME Pte Ltd",
      "amount": "1280.50",
      "currency": "SGD",
      "date": "2026-05-28",
      "invoice_number": "INV-2026-0528",
      "description": "Cloud hosting",
      "bank_name": "DBS Bank Ltd",
      "bank_account": "001-234567-8",
      "swift_code": "DBSSSGSG"
    }
  ],
  "attachments": [
    { "file_token": "file_token_abc" }
  ]
}
```

Output has this shape:

```json
{
  "message_type": "lark_approval_instance",
  "summary": "Invoice approval for 1 invoice",
  "invoice_count": 1,
  "applicant_open_id": "ou_applicant_001",
  "dept_head_id": "ou_leader_002",
  "dept_head_source": "input",
  "department": "DevOps",
  "shared_currency": "SGD",
  "shared_entity": "ChronoAI Pte Ltd (法币支付)",
  "related_approval_id": null,
  "form": [
    {
      "id": "widget17168633868040001",
      "type": "fieldList",
      "value": [
        [
          { "id": "widget17168644567560001", "type": "contact", "value": ["ou_leader_002"] },
          { "id": "widget17168638060470001", "type": "radioV2", "value": "lwpsdr33-27z0rv3m3t4-0" },
          { "id": "widget17270803199920001", "type": "radioV2", "value": "m1er13p8-jy4c1eb1le-0" },
          { "id": "widget17643090840670001", "type": "radioV2", "value": "miig2pwk-4bx8l7d96pf-0" },
          { "id": "widget17168643792430001", "type": "radioV2", "value": "lwpsq1d7-72ixwmka1jh-0" },
          { "id": "widget17168645326090001", "type": "textarea", "value": "Cloud hosting for May (Invoice: INV-2026-0528)" },
          { "id": "widget17168645408360001", "type": "radioV2", "value": "lwpsti1z-5ogmo0ul3vb-0" },
          { "id": "widget17168648705100001", "type": "amount", "value": 1280.5, "currency": "SGD", "ext": { "currency": "SGD", "currencyRange": ["USD", "CNY", "SGD"] } },
          { "id": "widget16487160384360001", "type": "date", "value": "2026-05-28T00:00:00Z" },
          { "id": "widget17168661650480001", "type": "input", "value": "ACME Pte Ltd" },
          { "id": "widget17168661652050001", "type": "input", "value": "DBS Bank Ltd" },
          { "id": "widget17168661653930001", "type": "input", "value": "001-234567-8" },
          { "id": "widget17168661664870001", "type": "input", "value": "DBSSSGSG" },
          { "id": "widget17168769083410001", "type": "textarea", "value": "Cloud hosting for May" },
          { "id": "widget17168764909530001", "type": "date", "value": "2026-06-27T00:00:00Z" }
        ]
      ]
    },
    {
      "id": "widget16487161419060001",
      "type": "attachmentV2",
      "value": ["file_token_abc"]
    },
    {
      "id": "widget16487161430270001",
      "type": "textarea",
      "value": "Urgent vendor payment\n\nThis approval was auto-generated by AI invoice recognition system. Data was reviewed and confirmed by the submitter before submission."
    }
  ],
  "approval_body": "<JSON string of lark.body>",
  "lark": {
    "path": "/open-apis/approval/v4/instances?user_id_type=user_id",
    "body": {
      "approval_code": "F640097D-0A68-47C1-A7BC-86659BC4B06F",
      "user_id": "ou_applicant_001",
      "form": "<JSON string of form>"
    }
  }
}
```

## Missing fields

If required data is missing, return:

```json
{
  "needs_more_information": true,
  "missing": ["applicantOpenId", "invoices[0].amount"]
}
```

If a related approval serial number is passed without an already-resolved instance id, return:

```json
{
  "needs_more_information": true,
  "missing": ["relatedApprovalId"],
  "reason": "related approval serial must be resolved to a Lark instance id before payload building"
}
```
