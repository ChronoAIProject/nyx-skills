---
name: aevatar-codex-exec-node-setup
description: Configure and prove Aevatar codex_exec for one NyxID account, choosing either operator-managed OpenSandbox or a private NyxID node-backed SSH service. Use for managed allowlist/binding readiness, node registration, forced-command hardening, service binding, Codex authentication/workspace configuration, mandatory public-sample verification, or diagnosing managed sandbox and private SSH failures.
version: "3.0"
metadata:
  category: tool-based
  tool-list:
    - shell
    - use_skill
    - aevatar_start_workflow
    - codex_exec
  tag:
    - aevatar
    - codex-exec
    - nyxid
    - opensandbox
    - credential-node
    - workflow
  depends-on:
    - aevatar-codex-exec-workflow-sample@2.0
compatibility: NyxID CLI and an Aevatar deployment that exposes codex_exec; private SSH additionally requires macOS or Linux, OpenSSH, Codex CLI, and Git
disable-model-invocation: true
user-invocable: true
---

# Configure Aevatar codex_exec

Choose exactly one target before changing state:

- `managed_sandbox`: Aevatar and operations own OpenSandbox, the runner image, model gateway, isolation, and cleanup. The user needs an authenticated NyxID binding with `llm:proxy` and an allowlist entry. No personal node or local Codex login is required.
- `private_ssh`: the user owns a private NyxID node, SSH service, fixed target, forced-command wrapper, local Codex login, and one Git workspace.

Never mix fields between targets. Do not report either target as ready until its public Ornn sample succeeds through Aevatar with exact `CODEX_EXEC_READY`.

## Guardrails

- Never print, copy, or persist NyxID tokens, OpenSandbox keys, SSH private keys, Codex credentials, or `auth.json` into workflow input, logs, issue comments, or image layers.
- Never let a workflow choose an image, provider, model flag, shell fragment, approval policy, workspace path, or sandbox bypass.
- Do not forward the reusable caller bearer into OpenSandbox. Managed execution must mint a short-lived capability with only `llm:proxy` and install it through Credential Vault.
- Keep a private node and SSH service personal unless the user explicitly authorizes organization ownership.
- Use a dedicated SSH key, pinned host key, forced command, fixed Git workspace, and sandboxed Codex command. Never use `danger-full-access`.

## Managed target

### 1. User preflight

Confirm the intended identity and Aevatar service connection:

```bash
nyxid --version
nyxid whoami
nyxid service list
```

The Aevatar login/consent flow must create a first-party binding for the same NyxID `sub`. Bindings created before Aevatar requested `llm:proxy` must be refreshed through normal login consent. Do not repair `invalid_scope` by broadening a token or using a static API key.

### 2. Operations handoff

Operations must complete `docs/operations/2026-07-16-managed-codex-exec-rollout.md` in the Aevatar repository. Required outcomes are:

- the immutable runner digest is pullable on the deployed architecture
- direct SDK tenant smoke returns exact `CODEX_EXEC_READY`
- Credential Vault, gateway-only egress, native Landlock, bounded JSONL, kill, and absence verification pass
- the Aevatar host receives its OpenSandbox endpoint/API key from Secret-backed configuration
- the intended NyxID subject is the only P0 `AllowedNyxIdUserIds` entry

Health and standalone smoke results still do not prove Aevatar workflow identity propagation.

### 3. Managed workflow proof

Mount the public dependency and run `codex-exec-check` with no caller-controlled routing. Follow its evaluation contract exactly. Success is a managed JSON result with `status=succeeded`, `target=managed_sandbox`, `exit_code=0`, and `output=CODEX_EXEC_READY`.

## Private SSH target

Build this ownership chain:

`NyxID user -> private SSH UserService -> owned node -> SSH target -> fixed wrapper -> Codex CLI -> one Git workspace`

The workflow receives the service slug or UUID, never `node_id`.

### 1. Collect inputs and preflight

Choose `NODE_PROFILE`, `NODE_NAME`, `SERVICE_LABEL`, `PRINCIPAL`, absolute `WORKSPACE`, `SSH_HOST`, `SSH_PORT`, and dedicated `SSH_KEY_FILE`. Show these values and visibility before mutating state.

```bash
nyxid --version
nyxid whoami
codex --version
codex login status
git -C "$WORKSPACE" rev-parse --show-toplevel
command -v jq sshd ssh-keygen base64 codex
```

Stop if the Codex login is absent, the workspace is not a Git repository, or the NyxID identity is not the intended owner.

### 2. Register an isolated node profile

Preserve any default profile. Mint and consume the one-time token without emitting it:

```bash
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

Use `--keychain` only where a supported secret service exists; otherwise explicitly select NyxID's encrypted-file backend. Continue only when this profile's node is online.

### 3. Prepare the fixed SSH target

Read [forced-command-wrapper.md](references/forced-command-wrapper.md) and install the wrapper first. On macOS follow [macos-loopback-sshd.md](references/macos-loopback-sshd.md); on Linux follow [linux-ssh-target.md](references/linux-ssh-target.md).

Allow only the selected host and port in this node profile's `[ssh].allowed_targets`, then restart only that profile. Do not replace its server, node, signing, or credential sections.

### 4. Create and bind the private service

Create the service without `--org` unless organization ownership was explicitly requested:

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

Investigate a host-key mismatch or explicitly rotate the verified pin. Never disable host verification.

### 5. Verify the private route

Use [troubleshooting.md](references/troubleshooting.md) to confirm a generic command is rejected and the exact Aevatar command profile succeeds through `nyxid ssh exec`.

Private workflow arguments use the nested contract:

```json
{
  "target": {
    "kind": "private_ssh",
    "private_ssh": {
      "service": "your-service-slug",
      "principal": "your-unix-user"
    }
  },
  "prompt": "Reply with exactly CODEX_EXEC_READY",
  "timeout_secs": 300
}
```

Do not use the obsolete root-level `service` and `principal` shape.

### 6. Private workflow proof

Mount the public dependency and run `codex-exec-private-ssh-check` with the actual service slug and principal. A direct SSH success is insufficient. The Aevatar workflow must return `exit_code: 0`, `timed_out: false`, and stdout exactly `CODEX_EXEC_READY` after trimming.

## Mandatory public-sample procedure

For either target, load the declared public dependency from Ornn:

```json
{
  "skill": "aevatar-codex-exec-workflow-sample",
  "mount_workflows": true
}
```

Use `codex-exec-check` for managed or `codex-exec-private-ssh-check` for private SSH. If workflow mounting is unavailable, fetch the same published Ornn version and run it as explicit inline draft input; do not substitute an unverified local copy.

## Completion criteria

For managed, all must be true:

- the correct NyxID account has a current Aevatar binding and `llm:proxy` consent
- operations completed the tenant smoke and enabled only that subject
- the public managed workflow returned exact `CODEX_EXEC_READY`
- cleanup was verified and no raw credential appeared in output

For private SSH, all must be true:

- the node is online under the intended NyxID user
- the service is private, active, node-bound, and uses node-held key auth
- the target is restricted and arbitrary commands are rejected
- local Codex succeeds through the fixed NyxID SSH route
- the public private-SSH workflow returned exact `CODEX_EXEC_READY`

Anything less is partial configuration, not a usable `codex_exec` route.
