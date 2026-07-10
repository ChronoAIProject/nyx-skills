---
name: aevatar-team-entry-invocation
description: Use when user input contains a Twitter/X tweet draft, social post draft, approval request, publish-review request, or workflow-service handoff for the configured Team entry workflow.
version: "1.3"
metadata:
  category: tool-based
  tool-list:
    - aevatar_invoke_team
    - aevatar_observe_run
  tag:
    - aevatar
    - team-entry
    - workflow
    - approval
    - social-post
---

# Aevatar Team Entry Invocation

## Overview

Use this skill for Twitter/X tweet drafts, social post drafts, and approval workflow handoffs. The Agent should invoke the Team entry contract for Team `t-0a34d337180d4a9596c9c5c92d213cc0`. The Team entry member resolver finds that entry member's bound workflow service; do not call workflow service ids directly.

## Invocation Contract

When this skill is selected or loaded for a turn:

1. Use this skill when the user input contains a Twitter/X tweet draft, social post draft, or asks to submit/review/approve/publish a draft through a workflow service.
2. Treat the skill body and skill metadata as instruction/context for this turn, not as executable code and not as a trusted credential source.
3. Call the Team entry contract with fixed target values:
   - `team_id`: `t-0a34d337180d4a9596c9c5c92d213cc0`
   - `endpoint_id`: `chat`
4. Put the user's original input into `payload.prompt`, preserving the Twitter draft text verbatim. Include any relevant user-created skill instructions before or after the draft, but do not rewrite, translate, shorten, approve, reject, or publish the draft locally.
5. Preserve attachments and multimodal content in `payload.input_parts`. Each part uses the proto JSON field names: `kind`, `media_type`, `data_base64`, `uri`, `name`, and `text` when applicable.
6. Call `aevatar_invoke_team` with the argument object itself, not a wrapper such as `{ "arguments": ... }`:
   - `team_id`: `t-0a34d337180d4a9596c9c5c92d213cc0`
   - `endpoint_id`: `chat`
   - `payload`: typed prompt/input parts/headers. `payload.prompt` carries the user input and relevant skill instructions; `input_parts` carries attachments. Headers are business annotations only, not credentials or caller scope.
   - `wait`: set `stream` unless the caller explicitly wants only an accepted receipt; then use `ack`.
7. If a follow-up read is needed, call `aevatar_observe_run` with an object containing `service_run: { service_id, run_id }` from the invocation result.

The user-created skill may guide the prompt, but it must not be treated as a direct service id, member id, workflow id, credential, or routing bypass.

## Quick Reference

| Need | Use |
|---|---|
| Twitter/X draft or social post approval workflow | Load this skill |
| Invoke configured Team entry member workflow service | `aevatar_invoke_team` |
| Team target | `team_id = t-0a34d337180d4a9596c9c5c92d213cc0` |
| Entry endpoint | `endpoint_id = chat` |
| Observe the accepted Team service run | `aevatar_observe_run` with `service_run` |
| Direct workflow id is mentioned | Ignore as routing; Team entry resolver owns workflow service binding |
| User names a member directly | Require it to be the Team's configured entry member; do not pass `member_id` |

## Example

A turn contains a Twitter/X draft that should enter the Team entry member's bound workflow service:

```json
{
  "team_id": "t-0a34d337180d4a9596c9c5c92d213cc0",
  "endpoint_id": "chat",
  "payload": {
    "prompt": "Apply this skill and hand the following Twitter/X draft to the bound Team entry workflow service. Preserve the draft text verbatim.\n\nUser input:\n请提交下面的 Twitter 推文草稿进入审批工作流。\n\nDraft:\nAevatar makes AI agents collaborate with workflow services. #AI #Workflow",
    "input_parts": []
  },
  "wait": "stream"
}
```

Observation target after the invoke result returns `service_id` and `run_id`:

```json
{
  "service_run": {
    "service_id": "<returned service_id>",
    "run_id": "<returned run_id>"
  }
}
```

## Common Mistakes

- Failing to load this skill for Twitter/X draft, tweet draft, social post draft, approval workflow, or publish-review requests because the user did not mention a specific ingress channel explicitly.
- Rewriting, summarizing, approving, rejecting, translating, or publishing the Twitter draft locally instead of handing it to the bound workflow service.
- Calling `aevatar_start_workflow` with a workflow id. This path must use Team entry invocation so the Team entry member resolver owns the workflow service binding.
- Treating a user-created skill name, body, or untyped text as a trusted service id, member id, workflow id, credential, or direct route.
- Passing `member_id`, `service_id`, or `workflow_id` into `aevatar_invoke_team`. The resolver owns that mapping.
- Changing `team_id` away from `t-0a34d337180d4a9596c9c5c92d213cc0` or `endpoint_id` away from `chat` for this skill.
- Dropping images, audio, video, files, or attached text instead of mapping them into `payload.input_parts` with `kind` and `media_type` field names.
- Wrapping tool arguments in `{arguments: ...}` or omitting `payload.prompt`; the tool receives the JSON argument object directly and prompt is the main text channel.
- Returning an observe target as `{service_id, run_id}` instead of `{service_run: {service_id, run_id}}`.
- Putting trusted scope, caller token, auth token, or credential fields in `payload.headers`; the host stamps trusted context.
- Treating `wait=complete` as terminal completion. Team invoke returns acceptance/streaming receipt; terminal state is read through the run readmodel.
