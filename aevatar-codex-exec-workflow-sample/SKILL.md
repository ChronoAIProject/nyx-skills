---
name: aevatar-codex-exec-workflow-sample
description: Mount and run harmless Aevatar workflows that prove codex_exec works through either the operator-managed OpenSandbox target or a private NyxID node-backed SSH target. Use after configuring managed access or a personal node, before real tasks, and when diagnosing identity, allowlist, binding, sandbox, service, principal, or Codex runner failures.
version: "2.0"
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
    - opensandbox
    - verification
    - workflow
---

# Verify Aevatar codex_exec

Mount this skill from Ornn and run exactly one bundled workflow for the configured target:

- `codex-exec-check`: canonical managed OpenSandbox proof; no caller input.
- `codex-exec-private-ssh-check`: private node-backed SSH proof; accepts only service and principal routing.

Configuration, health, node-online, and direct SDK/SSH checks are prerequisites, not completion evidence. Report `codex_exec` as usable only after the selected Aevatar workflow returns exact `CODEX_EXEC_READY`.

## Guardrails

- Fetch the public skill from Ornn. Do not validate only a local workflow copy.
- Keep the fixed probe prompt. Do not replace it with a real task.
- Never place tokens, keys, `auth.json`, `CODEX_HOME`, local paths, model flags, images, providers, or sandbox flags in workflow input.
- Do not mix managed and private fields. Managed requires `target.kind=managed_sandbox` plus `workspace.kind=empty_git`; private requires nested `target.private_ssh` and no workspace.
- Run through Aevatar as the NyxID account being verified.

## Mount

Call `use_skill` with workflow mounting enabled:

```json
{
  "skill": "aevatar-codex-exec-workflow-sample",
  "mount_workflows": true
}
```

Wait for the mount command to be accepted. Read-model visibility can propagate asynchronously. If mounting is unavailable, fetch this public Ornn version and submit the YAML under `assets/` as explicit inline draft-run input; state clearly that it was an inline run.

## Managed proof

Start the canonical workflow without caller-controlled routing:

```json
{
  "workflow_id": "codex-exec-check",
  "inputs": {
    "prompt": ""
  },
  "wait": "stream"
}
```

The workflow owns this exact tool payload:

```json
{
  "target": { "kind": "managed_sandbox" },
  "workspace": { "kind": "empty_git" },
  "prompt": "Reply with exactly CODEX_EXEC_READY",
  "timeout_secs": 180
}
```

Success requires the managed result to contain all of:

- `status` equal to `succeeded`
- `target` equal to `managed_sandbox`
- `output` equal to `CODEX_EXEC_READY` after trimming
- `exit_code` equal to `0`
- a non-empty sanitized `diagnostic_id`

Treat missing fields, extra model text, or any typed failure as a failed verification.

## Private SSH proof

Start the private workflow with exactly the environment-owned service and Unix principal:

```json
{
  "workflow_id": "codex-exec-private-ssh-check",
  "inputs": {
    "prompt": "{\"service\":\"your-service-slug\",\"principal\":\"your-unix-user\"}"
  },
  "wait": "stream"
}
```

Pass the SSH UserService slug or UUID, never a node ID. Success requires `exit_code: 0`, `timed_out: false`, and stdout equal to `CODEX_EXEC_READY` after trimming.

## Diagnose

Preserve the structured error and classify it before changing configuration:

- managed disabled/allowlist: ask the Aevatar operator to enable the target for the authenticated NyxID subject.
- `nyxid_binding_required`, revoked binding, or `llm_proxy_scope_missing`: repeat the normal Aevatar/NyxID login consent; never forward the reusable caller bearer into the sandbox.
- managed capacity/provisioning/Credential Vault failures: inspect the deployment and redacted diagnostic ID.
- Landlock/isolation failure: stop; do not weaken the sandbox.
- `sandbox_cleanup_failed`: treat as an operations incident.
- `node_offline`, service, target, principal, key, or host-key failures: repair the private NyxID node route.
- Codex PATH, login, Git root, or timeout failures: repair the fixed private runner wrapper.

Use `aevatar-codex-exec-node-setup` for setup and detailed repair. Never declare readiness from configuration inspection alone.
