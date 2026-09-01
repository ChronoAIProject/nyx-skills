# Resume screening contract

This contract defines deterministic behavior for `resume-screening-payload-builder`.

## Original flow boundary

The original n8n workflow has these steps:

1. Receive an n8n hosted Form submission with `Candidate Name`, `Email`, `Job Title`, `Resume`, and `Job Description`.
2. Extract text from the uploaded PDF resume.
3. Build a Groq request and call `POST /chat/completions` through NyxID.
4. Parse the model JSON into screening fields.
5. If `score >= 60`, upload the resume file to Lark Drive and receive `file_token`.
6. Create a Lark Bitable record with `POST /open-apis/bitable/v1/apps/FSl0bCi9raBuLbsdTbHlgb0agwf/tables/tblgZgSqmeBag2na/records`.
7. The workflow JSON also contains an unconnected update node that uses `PUT /open-apis/bitable/v1/apps/FSl0bCi9raBuLbsdTbHlgb0agwf/tables/tblgZgSqmeBag2na/records/{recordId}` with the same `fields` object.

This skill implements only step 6 and the update-node payload shape from step 7. Form intake, PDF extraction, Groq calls, token handling, file upload, record search, and HTTP submission stay in Aevatar/NyxID. The caller passes model output, `file_token`, and `uploadDateMs` as inputs.

## Input shape

The caller may pass the event body directly or wrap it in `body`. If `body` exists, read fields from `body`; otherwise read fields from the root object.

## Modes

| Mode | Behavior |
|---|---|
| `create_record` | Build the Lark Bitable create-record body and path. |
| `update_record` | Build the Lark Bitable update-record body and path. Requires `recordId`. |
| `build_record` or omitted | Build create-record by default; build update-record if `recordId` is present. |

Unsupported modes return:

```json
{ "skip": true, "reason": "unsupported mode: <mode>" }
```

## Field aliases

Use the first non-empty value in the listed order.

| Normalized field | Source fields |
|---|---|
| `mode` | `mode` |
| `score` | `score`, `ai.score`, `modelOutput.score`, `screeningResult.score`, model JSON `score` |
| `candidateName` | `candidateName`, `candidate_name`, `Candidate Name`, `formName`, `meta.formName`, `name`, model JSON `candidate_name`, model JSON `candidateName` |
| `email` | `email`, `Email`, `meta.email` |
| `jobTitle` | `jobTitle`, `job_title`, `Job Title`, `meta.jobTitle` |
| `strengths` | `strengths`, model JSON `strengths` |
| `gaps` | `gaps`, model JSON `gaps` |
| `recommendation` | `recommendation`, model JSON `recommendation` |
| `screenerRemarks` | `screenerRemarks`, `screener_remarks`, `TA Notes`, `taNotes` |
| `uploadDateMs` | `uploadDateMs`, `upload_date_ms`, `uploadDate`, `Upload Date` |
| `file_token` | `file_token`, `fileToken`, `resumeFileToken`, `Resume.file_token` |
| `recordId` | `record_id`, `recordId`, `Record ID` |

## Model output input

The model output may be supplied as:

- direct normalized fields such as `score`, `candidateName`, `strengths`, `gaps`, and `recommendation`;
- an object under `ai`, `modelOutput`, or `screeningResult`;
- a Groq-style object under `groqResponse` or `response`, where `choices[0].message.content` contains the model JSON;
- a JSON string or fenced JSON string under those same model-output keys.

When parsing model text, strip leading ```json, leading ```, and trailing ```, then parse the first JSON object in the text.

The model JSON fields from the original prompt are:

```json
{
  "score": 86,
  "candidate_name": "Alice Wang",
  "strengths": "Strong backend and workflow automation",
  "gaps": "Limited HR domain examples",
  "recommendation": "Pass"
}
```

## Screening threshold

The original `Score Check` node only continues when:

```text
score >= 60
```

If `score` is below 60, return:

```json
{
  "skip": true,
  "reason": "score below upload threshold",
  "threshold": 60,
  "score": 52,
  "recommendation": "Fail"
}
```

## Required fields

For `create_record`, these normalized fields are required:

```json
["score", "candidateName", "jobTitle", "uploadDateMs"]
```

For `update_record`, these normalized fields are required:

```json
["score", "candidateName", "jobTitle", "uploadDateMs", "recordId"]
```

If any required field is missing or empty, return:

```json
{
  "needs_more_information": true,
  "missing": ["candidateName"]
}
```

`email`, `strengths`, `gaps`, `recommendation`, `screenerRemarks`, and `file_token` are optional. If `email` is absent, use an empty string. If `file_token` is absent, omit the `Resume` field.

## TA Notes

If `screenerRemarks` is provided, use it as `TA Notes`.

Otherwise build `TA Notes` exactly as:

```text
AI Score: <score>/100 | <recommendation> | Strengths: <strengths> | Gaps: <gaps>
```

## Lark Bitable fields

Build the `fields` object exactly as the workflow's create and update code nodes do:

```json
{
  "Candidate Name": "<candidateName>",
  "Email": "<email or empty string>",
  "Job Title": "<jobTitle>",
  "Upload Date": 1717401600000,
  "Position Status": "Open",
  "Application Stage": "Resume Screening",
  "TA Notes": "<screenerRemarks>"
}
```

When `file_token` is present, also include:

```json
{
  "Resume": [
    { "file_token": "<file_token>" }
  ]
}
```

The original workflow used `Date.now()` for `Upload Date`. This deterministic skill never calls `Date.now()`; callers must pass the intended millisecond timestamp as `uploadDateMs`.

## Create-record output shape

Example input:

```json
{
  "mode": "create_record",
  "meta": {
    "email": "alice@example.com",
    "jobTitle": "Workflow Automation Engineer"
  },
  "modelOutput": {
    "score": 86,
    "candidate_name": "Alice Wang",
    "strengths": "Strong backend and workflow automation",
    "gaps": "Limited HR domain examples",
    "recommendation": "Pass"
  },
  "file_token": "boxcnResumeToken",
  "uploadDateMs": 1717401600000
}
```

Example output:

```json
{
  "message_type": "lark_bitable_record_payload",
  "summary": "Resume screening create record payload for Alice Wang",
  "action": "create",
  "candidate": {
    "candidateName": "Alice Wang",
    "email": "alice@example.com",
    "jobTitle": "Workflow Automation Engineer"
  },
  "screening": {
    "score": 86,
    "threshold": 60,
    "recommendation": "Pass",
    "strengths": "Strong backend and workflow automation",
    "gaps": "Limited HR domain examples",
    "passed": true
  },
  "record": {},
  "screenerRemarks": "AI Score: 86/100 | Pass | Strengths: Strong backend and workflow automation | Gaps: Limited HR domain examples",
  "fields": {
    "Candidate Name": "Alice Wang",
    "Email": "alice@example.com",
    "Job Title": "Workflow Automation Engineer",
    "Upload Date": 1717401600000,
    "Position Status": "Open",
    "Application Stage": "Resume Screening",
    "TA Notes": "AI Score: 86/100 | Pass | Strengths: Strong backend and workflow automation | Gaps: Limited HR domain examples",
    "Resume": [
      { "file_token": "boxcnResumeToken" }
    ]
  },
  "lark": {
    "path": "/open-apis/bitable/v1/apps/FSl0bCi9raBuLbsdTbHlgb0agwf/tables/tblgZgSqmeBag2na/records",
    "method": "POST",
    "body": {
      "fields": {
        "Candidate Name": "Alice Wang",
        "Email": "alice@example.com",
        "Job Title": "Workflow Automation Engineer",
        "Upload Date": 1717401600000,
        "Position Status": "Open",
        "Application Stage": "Resume Screening",
        "TA Notes": "AI Score: 86/100 | Pass | Strengths: Strong backend and workflow automation | Gaps: Limited HR domain examples",
        "Resume": [
          { "file_token": "boxcnResumeToken" }
        ]
      }
    }
  }
}
```

## Update-record output shape

Example input:

```json
{
  "mode": "update_record",
  "recordId": "recABC123",
  "candidateName": "Alice Wang",
  "email": "alice@example.com",
  "jobTitle": "Workflow Automation Engineer",
  "score": 86,
  "strengths": "Strong backend and workflow automation",
  "gaps": "Limited HR domain examples",
  "recommendation": "Pass",
  "file_token": "boxcnResumeToken",
  "uploadDateMs": 1717401600000
}
```

Example output:

```json
{
  "message_type": "lark_bitable_record_payload",
  "summary": "Resume screening update record payload for Alice Wang",
  "action": "update",
  "record": {
    "recordId": "recABC123"
  },
  "lark": {
    "path": "/open-apis/bitable/v1/apps/FSl0bCi9raBuLbsdTbHlgb0agwf/tables/tblgZgSqmeBag2na/records/recABC123",
    "method": "PUT",
    "body": {
      "fields": {
        "Candidate Name": "Alice Wang",
        "Email": "alice@example.com",
        "Job Title": "Workflow Automation Engineer",
        "Upload Date": 1717401600000,
        "Position Status": "Open",
        "Application Stage": "Resume Screening",
        "TA Notes": "AI Score: 86/100 | Pass | Strengths: Strong backend and workflow automation | Gaps: Limited HR domain examples",
        "Resume": [
          { "file_token": "boxcnResumeToken" }
        ]
      }
    }
  }
}
```

The full update output also includes `candidate`, `screening`, `screenerRemarks`, and top-level `fields` with the same meanings as create-record output.

## Default build-record output shape

When `mode` is omitted or set to `build_record`, the script creates a record unless `recordId` is present. This example updates because `recordId` is present.

Example input:

```json
{
  "recordId": "recABC123",
  "candidateName": "Alice Wang",
  "email": "alice@example.com",
  "jobTitle": "Workflow Automation Engineer",
  "score": 86,
  "strengths": "Strong backend and workflow automation",
  "gaps": "Limited HR domain examples",
  "recommendation": "Pass",
  "uploadDateMs": 1717401600000
}
```

Example output excerpt:

```json
{
  "message_type": "lark_bitable_record_payload",
  "summary": "Resume screening update record payload for Alice Wang",
  "action": "update",
  "record": {
    "recordId": "recABC123"
  },
  "lark": {
    "path": "/open-apis/bitable/v1/apps/FSl0bCi9raBuLbsdTbHlgb0agwf/tables/tblgZgSqmeBag2na/records/recABC123",
    "method": "PUT",
    "body": {
      "fields": {
        "Candidate Name": "Alice Wang",
        "Email": "alice@example.com",
        "Job Title": "Workflow Automation Engineer",
        "Upload Date": 1717401600000,
        "Position Status": "Open",
        "Application Stage": "Resume Screening",
        "TA Notes": "AI Score: 86/100 | Pass | Strengths: Strong backend and workflow automation | Gaps: Limited HR domain examples"
      }
    }
  }
}
```
