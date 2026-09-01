# Onboarding email approval contract

This contract defines deterministic behavior for `onboarding-email-approval-payload-builder`.

## Original n8n flow boundary

The original workflow is named `Lark Onboarding - 自动发起邮箱审批`. The workflow file defines:

1. A `POST` webhook at `lark-onboarding-email-approval` — fired by a **Lark Base record-change** (a new hire row is added).
2. A code node `提取并格式化新人信息` that extracts and formats the new-hire info (~1030 chars): `larkName`, `department`, `startDate` (Onboarding Date), `operatorId`, and derives the company email, the request-detail string, and the approval `form` payload.
3. An HTTP node `获取 Lark Tenant Access Token` that fetches a tenant access token from `auth/v3/tenant_access_token/internal`.
4. An HTTP node `发起 Lark 邮箱审批` that `POST`s to `/open-apis/approval/v4/instances` to create the email-account approval.
5. A respond node `返回成功` that returns `{status:"ok", message:"Approval initiated for <larkName>"}`.

This skill ports steps 2 and 4 only. **Step 3 (manual tenant_access_token fetch) is dropped**: on aevatar, `nyxid_proxy` with slug `api-lark-bot` brokers credentials, so the skill never fetches or holds a token. Aevatar remains responsible for the network call, sending, and any card fallback.

### Trigger reshape (Scope)

The n8n trigger was a **Lark Base record-change webhook**, which has **no equivalent trigger on aevatar's current branch**. This skill is therefore reshaped to be **chat-invoked** ("给新人 <name/department/email> 发起入职邮箱审批") or **schedule-polled** (poll the onboarding Bitable via `nyxid_proxy` bitable GET, then call `buildPayload` for each new row). The builder itself is trigger-agnostic — it only turns resolved new-hire fields into the exact approval body.

## Mode

The script reads JSON from stdin and accepts:

```json
{ "mode": "build_approval_instance" }
```

If `mode` is omitted, default to `build_approval_instance`. Any other mode returns `{ "skip": true, "reason": "unknown mode: <mode>" }`.

## Input shape

The caller may pass the new-hire fields directly, or wrap them under `body` (mirroring the n8n node, which read `$input.first().json.body || $input.first().json`). If `body` exists, fields are read from `body`.

### New-hire input fields (with aliases from the source)

Use the first non-empty value in the listed order. The first alias in each row is the Lark Base column name (or snake_case) used by the original `提取并格式化新人信息` node.

| Normalized field | Source fields | Required |
|---|---|---|
| `larkName` | `lark_name`, `larkName`, `Lark Name`, `name`, `Name` | yes |
| `department` | `department`, `Department`, `dept` | no |
| `startDate` | `onboarding_date`, `onboardingDate`, `Onboarding Date`, `start_date`, `startDate` | no |
| `operatorId` | `user_id`, `userId`, `operator_id`, `operatorId`, `open_id`, `openId` | yes (becomes `user_id`) |
| `email` (optional override) | `email`, `Email`, `new_email`, `newEmail` | no — derived if absent |
| `today` (request date) | `today`, `request_date`, `requestDate` | no — defaults to `startDate` |
| `approvalCode` | `approval_code`, `approvalCode` | no — default below |
| `companyDomain` | `company_domain`, `companyDomain` | no — default `aelf.io` |
| `requestDetailWidgetId` | `requestDetailWidgetId`, `request_detail_widget_id` | no — default below |
| `submitterWidgetId` | `submitterWidgetId`, `submitter_widget_id` | no — default below |
| `submitterValue` | `submitter_value`, `submitterValue` | no — default `自动提交` |

### Required fields

After alias normalization, `larkName` and `operatorId` are required. If either is missing or empty, return:

```json
{ "needs_more_information": true, "missing": ["lark_name", "user_id"] }
```

(`missing` lists only the absent ones.)

## Derivations (ported from `提取并格式化新人信息`)

- **email local part**: `larkName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')`.
- **newEmail**: `<localPart>@<companyDomain>` (default domain `aelf.io`), unless an explicit `email` override is supplied.
- **today (Chinese)**: ports `new Date().toLocaleDateString('zh-CN', {year:'numeric',month:'long',day:'numeric'})` → e.g. `2026年6月9日`. To stay deterministic, the value comes from the explicit `today` field; if absent it falls back to `startDate` (and is empty if neither is given). The builder never calls argless `new Date()`.
- **requestDetail**: `申请日期：<today> | 姓名：<larkName>（入职：<startDate>）| 新邮箱：<newEmail>`.

## Defaults copied from workflow config

```json
{
  "approvalCode": "9C330885-C70A-4A5D-913A-CBA9A142FFD4",
  "companyDomain": "aelf.io",
  "widgetIds": {
    "request_detail": "widget17163600360780001",
    "submitter": "widget17163600454870001"
  },
  "submitterValue": "自动提交"
}
```

## Form widget mapping

The Lark approval `form` is this array (matching the n8n `formPayload`):

```json
[
  { "id": "widget17163600360780001", "type": "textarea", "value": "<requestDetail>" },
  { "id": "widget17163600454870001", "type": "input", "value": "自动提交" }
]
```

| Widget id | Type | Value source |
|---|---|---|
| `widget17163600360780001` | `textarea` | `requestDetail` (申请日期 / 姓名 / 入职 / 新邮箱) |
| `widget17163600454870001` | `input` | `submitterValue` (hard-coded `自动提交` in the source) |

The `form` field in the approval body is `JSON.stringify(form)`.

## Exact approval body

```text
POST /open-apis/approval/v4/instances
```

Body:

```json
{
  "approval_code": "9C330885-C70A-4A5D-913A-CBA9A142FFD4",
  "user_id": "<operatorId>",
  "form": "<JSON string of the form array>"
}
```

`user_id` is the new-hire approval submitter's id (the `operatorId` from the source), matching the n8n node's `user_id = operatorId`.

## Output shape

```json
{
  "message_type": "lark_onboarding_email_approval",
  "summary": "Onboarding email approval for <larkName> (<newEmail>)",
  "request": {
    "larkName": "<larkName>",
    "department": "<department>",
    "startDate": "<startDate>",
    "newEmail": "<newEmail>",
    "requestDetail": "<requestDetail>",
    "operatorId": "<operatorId>"
  },
  "form": [
    { "id": "widget17163600360780001", "type": "textarea", "value": "<requestDetail>" },
    { "id": "widget17163600454870001", "type": "input", "value": "自动提交" }
  ],
  "approval": {
    "path": "/open-apis/approval/v4/instances",
    "body": {
      "approval_code": "9C330885-C70A-4A5D-913A-CBA9A142FFD4",
      "user_id": "<operatorId>",
      "form": "<JSON string form>"
    }
  }
}
```

## Example: build_approval_instance

Input:

```json
{
  "mode": "build_approval_instance",
  "lark_name": "Jane Doe",
  "department": "Engineering",
  "onboarding_date": "2026-06-16",
  "today": "2026-06-09",
  "user_id": "ou_6cb891b9d89fe1ac1ba6c09c2a19d688"
}
```

Output:

```json
{
  "message_type": "lark_onboarding_email_approval",
  "summary": "Onboarding email approval for Jane Doe (jane.doe@aelf.io)",
  "request": {
    "larkName": "Jane Doe",
    "department": "Engineering",
    "startDate": "2026-06-16",
    "newEmail": "jane.doe@aelf.io",
    "requestDetail": "申请日期：2026年6月9日 | 姓名：Jane Doe（入职：2026-06-16）| 新邮箱：jane.doe@aelf.io",
    "operatorId": "ou_6cb891b9d89fe1ac1ba6c09c2a19d688"
  },
  "form": [
    { "id": "widget17163600360780001", "type": "textarea", "value": "申请日期：2026年6月9日 | 姓名：Jane Doe（入职：2026-06-16）| 新邮箱：jane.doe@aelf.io" },
    { "id": "widget17163600454870001", "type": "input", "value": "自动提交" }
  ],
  "approval": {
    "path": "/open-apis/approval/v4/instances",
    "body": {
      "approval_code": "9C330885-C70A-4A5D-913A-CBA9A142FFD4",
      "user_id": "ou_6cb891b9d89fe1ac1ba6c09c2a19d688",
      "form": "[{\"id\":\"widget17163600360780001\",\"type\":\"textarea\",\"value\":\"申请日期：2026年6月9日 | 姓名：Jane Doe（入职：2026-06-16）| 新邮箱：jane.doe@aelf.io\"},{\"id\":\"widget17163600454870001\",\"type\":\"input\",\"value\":\"自动提交\"}]"
    }
  }
}
```

## Isolation

This skill does not fetch or store Lark tenant access tokens, NyxID bearers, OAuth credentials, or app secrets (the original n8n `app_id`/`app_secret` and the tenant-token fetch are intentionally **not** reproduced — `nyxid_proxy` slug `api-lark-bot` brokers credentials). It does not call network endpoints, read Lark Base, send Lark messages, submit approvals, or invent missing new-hire names, departments, emails, user ids, approval codes, widget ids, or approvers.
