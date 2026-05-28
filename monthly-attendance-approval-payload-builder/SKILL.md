---
name: monthly-attendance-approval-payload-builder
version: "1.0"
description: Builds Lark monthly attendance approval and reminder payloads from normalized attendance records.
metadata:
  category: plain
  tag:
    - aevatar
    - s-capability
    - attendance
    - lark-approval
    - payload-builder
  clawdbot:
    emoji: "calendar"
    files:
      - "references/*"
      - "scripts/*"
---

# Monthly Attendance Approval Payload Builder

Use this skill after Aevatar has fetched monthly attendance records from Lark Bitable through NyxID.

This skill computes attendance summary statistics and builds connector-ready Lark approval and DM reminder payloads. It does not read Bitable, fetch tenant tokens, send messages, or submit approvals.

## Inputs

Required for approval mode:

- `records`
- `year`
- `month`
- `docUrl`
- `submitterId`
- `approvalCode`

Optional fields include widget ids and notification user id. Defaults are defined in `references/monthly-attendance-contract.md`.

## Output

Return JSON with:

- `stats`
- `description`
- `lark.approvalBody`
- optional `lark.notificationBody`
- optional `lark.reminderBody`

## Determinism requirement

Follow `references/monthly-attendance-contract.md`. If executing code is allowed, use `scripts/build_monthly_attendance_payload.js` as the reference implementation.

Do not invent attendance records, submitter ids, approval definitions, Lark credentials, or receiver ids.
