---
name: aevatar-codex-exec-workflow-sample
description: Mount and run a harmless Aevatar codex_exec workflow that verifies a NyxID node-backed SSH service can reach an authenticated Codex CLI. Use when checking a new personal node setup, confirming service and principal routing, or diagnosing a failed codex_exec workflow before running real tasks.
version: "1.1"
metadata:
  category: mixed
  output-type: text
  runtime:
    - aevatar-workflow
  tool-list:
    - aevatar_start_workflow
    - codex_exec
  tag:
    - aevatar
    - codex-exec
    - nyxid
    - verification
    - workflow
---

# Verify Aevatar codex_exec

Use the bundled `codex-exec-check` workflow as a read-only route check:

`NyxID account -> private SSH service -> owned node -> SSH principal -> local Codex CLI`

## Guardrails

- Use a private, node-bound SSH service owned by the same NyxID account authenticated to Aevatar.
- Pass the SSH service slug or UUID, never a node ID.
- Pass an allowed Unix principal from that service.
- Never request or place registration tokens, SSH keys, Codex credentials, `auth.json`, or local paths in workflow input.
- Do not change the bundled verification prompt. It forbids tools and file access and asks Codex for one fixed response.

## Run

1. Load this skill with workflow mounting enabled. When calling `use_skill`, set `skill` to `aevatar-codex-exec-workflow-sample` and `mount_workflows` to `true`.
2. Wait for the Scope Workflow mount command to be accepted. Read-model visibility may propagate asynchronously.
3. Start the mounted workflow with `aevatar_start_workflow`:

```json
{
  "workflow_id": "codex-exec-check",
  "inputs": {
    "prompt": "{\"service\":\"your-service-slug\",\"principal\":\"your-unix-user\"}"
  },
  "wait": "stream"
}
```

The prompt must be a JSON object with exactly the environment-owned routing values `service` and `principal`. Do not add a task prompt; the workflow owns the fixed probe.

If workflow mounting is unavailable, use `workflows/codex-exec-check.yaml` only as explicit inline draft-run input and pass the same JSON object as the draft-run prompt. Do not treat an inline draft as a published Scope Workflow.

## Evaluate

Report success only when the `codex_exec` result contains all of:

- `exit_code: 0`
- `timed_out: false`
- stdout equal to `CODEX_EXEC_READY` after trimming whitespace

Treat any other result as a failed verification. Preserve the structured error and classify it before changing configuration:

- `node_offline`: start the intended NyxID node profile and confirm it is online.
- service or target errors: confirm the service slug, node binding, and allowed SSH target.
- principal or key errors: confirm the allowed principal and its node-held SSH credential.
- host-key mismatch: investigate or rotate the pin; never disable host verification.
- Codex command, PATH, login, or git-root errors: repair the target principal's local runner configuration.
- timeout: confirm the fixed probe works directly; do not raise the NyxID limit above 300 seconds.

Use `aevatar-codex-exec-node-setup` for configuration or detailed repair. Do not weaken the forced-command wrapper or enable arbitrary SSH commands to make this check pass.
