# Verification and Troubleshooting

## End-to-End Probe

Construct the same fixed command Aevatar uses and call it through NyxID:

```bash
prompt='Reply exactly CODEX_EXEC_READY. Do not inspect files, run tools, or modify anything.'
encoded_prompt="$(printf '%s' "$prompt" | base64 | tr -d '\n')"
remote_command="p='$encoded_prompt'; { printf '%s' \"\$p\" | base64 --decode 2>/dev/null || printf '%s' \"\$p\" | base64 -D; } | codex exec -"

nyxid ssh exec "$service_slug" \
  --principal "$PRINCIPAL" \
  --output json \
  -- "$remote_command"
```

Expect `exit_code: 0`, `timed_out: false`, and `CODEX_EXEC_READY` in stdout.

Also send `id -un` through the same service. Expect the forced wrapper to reject it with exit code `126`.

## Failure Map

| Symptom | Meaning | Check |
|---|---|---|
| `No NyxID access token available` | Aevatar did not receive the caller token | Log into Aevatar with the same NyxID account |
| node absent from `node list` | Node belongs to another account/profile | Compare account identity and register a new isolated profile |
| `node_offline` | Node daemon is disconnected | `nyxid node daemon status --profile ...` and node logs |
| `No node agent is bound` | Workflow value is wrong or service lacks binding | Pass the SSH service slug, inspect `nyxid service show` |
| `target_not_allowed` | Node SSH allowlist excludes host/port | Fix `[ssh].allowed_targets`, restart profile |
| `SSH key missing` | Credential was stored in another node profile or selector | Match service slug and principal; set `NYXID_PROFILE` while adding |
| host-key mismatch | Target identity changed | Investigate; rotate the pin only after verifying the new fingerprint |
| exit `126` for a Codex request | Wrapper pattern no longer matches | Compare the exact Aevatar command contract and wrapper suffix |
| `codex: command not found` | Noninteractive SSH PATH lacks Codex | Use an absolute `CODEX_BIN` in the wrapper |
| login/auth failure | Target principal lacks valid Codex auth | Run `codex login status` as that principal |
| git repository required | Wrapper workspace is wrong | Set `WORKSPACE` to an absolute git root |
| request times out | NyxID SSH limit reached | Keep synchronous work under 300 seconds or use long-running handoff |
| output truncated | Stream exceeded NyxID capture limit | Store artifacts separately; keep stdout/stderr below 1 MiB each |

## Inspect Without Leaking Secrets

- Read node logs, but redact values beginning with `nyx_` before sharing them.
- Inspect node config structure, but do not print encrypted token/key fields.
- Use `codex login status`; never print `auth.json`.
- Use `nyxid service show`; never publish node registration or SSH private keys.
