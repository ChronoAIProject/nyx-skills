---
name: aevatar-codex-exec-node-setup
description: Configure a private NyxID node-backed SSH service so the same NyxID account can run Aevatar workflow codex_exec against a local Codex CLI. Use for node registration, loopback or dedicated SSH target setup, forced-command hardening, service binding, Codex authentication/workspace configuration, end-to-end verification, or diagnosing node_offline, target_not_allowed, missing SSH key, Codex PATH, git-root, and 300-second timeout failures.
version: "1.1"
metadata:
  category: tool-based
  tool-list:
    - shell
  tag:
    - aevatar
    - codex-exec
    - nyxid
    - credential-node
    - workflow
compatibility: macOS or Linux with NyxID CLI, OpenSSH, Codex CLI, and an Aevatar deployment that enables codex_exec
disable-model-invocation: true
user-invocable: true
---

# Configure Aevatar codex_exec

Build this ownership chain and verify every boundary:

`NyxID user -> private SSH UserService -> owned node -> SSH target -> fixed wrapper -> Codex CLI -> one git workspace`

Do not treat `node_id` as the workflow service. The workflow receives the private SSH service slug or UUID.

## Guardrails

- Keep the node and SSH service personal. Do not pass `--org` unless the user explicitly wants every authorized org member to reach the machine.
- Before mutating node, service, daemon, SSH, or startup state, show the chosen owner, profile, target, principal, workspace, and visibility. Continue only when the current user request explicitly authorizes that configuration.
- Never print or persist a node registration token outside the node config. Capture and consume it in one shell process.
- Never put a Codex API key, `auth.json`, `CODEX_HOME`, model flag, or sandbox bypass flag in workflow YAML.
- Restrict the SSH key with a forced-command wrapper. Aevatar may expose `ssh_exec` beside `codex_exec`; the target must reject arbitrary commands independently.
- Use a dedicated SSH key, a pinned host key, a fixed git workspace, and `workspace-write`. Do not use `danger-full-access`.
- Authenticate Aevatar and NyxID as the same user that owns the private service.

## Collect Inputs

Choose these values before changing state:

- `NODE_PROFILE`: local node-agent profile, such as `codex-personal`.
- `NODE_NAME`: NyxID-visible node name.
- `SERVICE_LABEL`: private SSH service label; its returned slug is authoritative.
- `PRINCIPAL`: Unix account that owns the Codex login and workspace.
- `WORKSPACE`: absolute path to one git repository.
- `SSH_HOST` and `SSH_PORT`: target reachable from the node. For a same-machine target, prefer `127.0.0.1` and a high loopback-only port.
- `SSH_KEY_FILE`: dedicated private key stored into the node credential store.

## 1. Preflight

Run:

```bash
nyxid --version
nyxid whoami
codex --version
codex login status
git -C "$WORKSPACE" rev-parse --show-toplevel
command -v jq sshd ssh-keygen base64 codex
```

Stop if the Codex login is absent, the workspace is not a git repository, or the NyxID identity is not the intended owner.

## 2. Register an Isolated Node Profile

Preserve any existing default node profile. Mint and consume the one-time token without emitting it:

```bash
# Use --keychain on macOS or when the Linux secret service is available.
# Set this empty only after selecting NyxID's encrypted-file backend.
NODE_STORAGE_FLAG=--keychain
registration_json="$(nyxid node register-token --name "$NODE_NAME" --terminal --output json)"
registration_token="$(printf '%s' "$registration_json" | jq -r '.token // .registration_token // .data.token // empty')"
test -n "$registration_token"
nyxid node register \
  --token "$registration_token" \
  --url wss://nyx-api.chrono-ai.fun/api/v1/nodes/ws \
  --profile "$NODE_PROFILE" \
  ${NODE_STORAGE_FLAG:+$NODE_STORAGE_FLAG}
unset registration_token registration_json

nyxid node daemon install --profile "$NODE_PROFILE" --log-level info
nyxid node daemon start --profile "$NODE_PROFILE"
nyxid node daemon status --profile "$NODE_PROFILE"
nyxid node list --output json
```

Continue only when the new node is `online` for the current account.

## 3. Prepare the SSH Target

Always read [forced-command-wrapper.md](references/forced-command-wrapper.md) and install its wrapper first.

- On macOS, read [macos-loopback-sshd.md](references/macos-loopback-sshd.md) and prefer a user-owned `sshd` bound only to loopback.
- On Linux, read [linux-ssh-target.md](references/linux-ssh-target.md) and prefer a dedicated Unix account or a similarly isolated user-owned `sshd`.

Add exactly the chosen host and port to the node profile's `[ssh].allowed_targets`, then restart that node profile. Do not replace its `[server]`, `[node]`, `[signing]`, or credential sections.

## 4. Create and Bind the Private SSH Service

Resolve the online node ID, then create the service without `--org`:

```bash
node_id="$(nyxid node list --output json | jq -r --arg name "$NODE_NAME" '.nodes[] | select(.name == $name) | .id')"
test -n "$node_id"

service_json="$(nyxid service add-ssh \
  --label "$SERVICE_LABEL" \
  --host "$SSH_HOST" \
  --port "$SSH_PORT" \
  --via-node "$node_id" \
  --node-key \
  --principals "$PRINCIPAL" \
  --output json)"

service_slug="$(printf '%s' "$service_json" | jq -r '.slug // .service_slug // .data.slug // empty')"
test -n "$service_slug"

NYXID_PROFILE="$NODE_PROFILE" nyxid node ssh-credentials add \
  --service "$service_slug" \
  --principal "$PRINCIPAL" \
  --key-file "$SSH_KEY_FILE" \
  --host "$SSH_HOST" \
  --port "$SSH_PORT"
```

Keep the host-key pin created by `ssh-credentials add`. A mismatch later is a security failure; investigate or explicitly rotate the pin rather than disabling verification.

## 5. Verify the Full Route

First confirm a generic command is rejected by the forced wrapper. Then send the exact command profile used by Aevatar with a harmless prompt. The final result must have `exit_code: 0`, `timed_out: false`, and the expected stdout.

Use [troubleshooting.md](references/troubleshooting.md) for the verification snippet and failure mapping.

## 6. Use the Service in a Workflow

Log in to Aevatar with the same NyxID account. Pass the returned service slug, not the node ID:

```yaml
steps:
  - id: execute
    type: tool_call
    timeout_ms: 320000
    parameters:
      tool: codex_exec
      arguments: '{"service":"codex-host","principal":"runner","prompt":"${json(input.prompt)}","timeout_secs":300}'
```

Keep `service` and `principal` deployment-owned when possible. The caller should normally supply only the task prompt.

The synchronous NyxID SSH boundary is capped at 300 seconds and captures at most 1 MiB per output stream. Use Aevatar's long-running submit/callback workflow for larger tasks.

## Completion Criteria

Finish only when all are true:

- The node appears online under the intended NyxID user.
- The SSH service is private, active, node-bound, and uses `node_key` auth.
- The SSH target listens only on the intended interface and port.
- Arbitrary SSH commands are rejected.
- A harmless Codex prompt succeeds through `nyxid ssh exec`.
- The workflow uses the service slug and matching Unix principal.
