---
name: lark-onboarding-email-approval-payload-builder
description: Build the Lark approval instance payload for an Aevatar-native onboarding email request using normalized employee and mailbox request details.
metadata:
  category: plain
  tag:
    - aevatar
    - s-capability
    - onboarding
    - lark-approval
    - payload-builder
version: "1.0"
---

# Lark Onboarding Email Approval Payload Builder

Use this skill when an Aevatar-native onboarding flow needs to create a Lark approval instance for a new employee email account.

## Input contract

The caller should provide JSON with these fields when available:

- `capability`: `lark-onboarding-email-approval`.
- `employeeName`: legal or preferred display name.
- `department`: department or team.
- `manager`: manager name or identifier.
- `startDate`: onboarding start date.
- `requestedEmail`: requested mailbox address or local part.
- `emailDomain`: target domain when `requestedEmail` is only a local part.
- `role`: job role or title.
- `justification`: reason for the mailbox request.
- `approvalCode`: optional Lark approval definition code.
- `approverOpenIds`: optional explicit approver OpenIDs.
- `metadata`: optional source event metadata.

Normalize obvious aliases such as `name`, `newHireName`, `team`, `owner`, `supervisor`, `mail`, `email`, `domain`, and `reason`.

## Task

1. Validate that employee name, department, start date, and requested email can be derived.
2. Normalize the requested email address. If only a local part is supplied, combine it with `emailDomain`.
3. Build a Lark approval instance payload suitable for a NyxID Lark approval connector call to `/open-apis/approval/v4/instances`.
4. Include a concise summary and all original metadata needed for audit.

## Output contract

Return JSON with this shape:

```json
{
  "approval_code": "<approval definition code if provided>",
  "summary": "Email approval for <employeeName>",
  "employee": {
    "name": "<employeeName>",
    "department": "<department>",
    "role": "<role>",
    "manager": "<manager>",
    "startDate": "<startDate>"
  },
  "emailRequest": {
    "address": "<normalized email>",
    "domain": "<domain>",
    "justification": "<justification>"
  },
  "approvers": ["<approver open id>"],
  "form": [
    { "name": "Employee", "value": "<employeeName>" },
    { "name": "Department", "value": "<department>" },
    { "name": "Requested Email", "value": "<normalized email>" },
    { "name": "Start Date", "value": "<startDate>" },
    { "name": "Justification", "value": "<justification>" }
  ],
  "lark": {
    "approval_code": "<approval definition code if provided>",
    "form": "<JSON string or connector-ready form value>",
    "open_id": "<submitter open id if provided>"
  }
}
```

If required fields are missing, return a JSON object with `needs_more_information: true` and a `missing` array listing the missing fields instead of inventing values.
