# chatgpt-pro-pool — full usage reference

All commands target the pool slug `chatgpt-pro-pool`. Global flags on every
`nyxid oracle` command: `--output json|table`, `--base-url`, `--profile`,
`--access-token` / `--access-token-env`.

## Command catalogue

### ask — submit a prompt (fresh, PDF, or multi-turn)
```
nyxid oracle ask <pool> [PROMPT] [options]
```
| Option | Meaning |
|---|---|
| `--file <path>` | Read the prompt from a file (`-` = stdin). |
| `--pdf <path>` | Attach a PDF; uploaded by the worker on the first turn. |
| `--model <m>` | Model hint forwarded to the worker (default: pool's `chatgpt-5.5-pro`). |
| `--new-conversation` | Start a multi-turn thread; response JSON includes `conversation_id`. |
| `--conversation <id>` | Continue an existing thread (`conv_...`). |
| `--project-url <url>` | Pin this prompt to a ChatGPT Project URL. |
| `--tag <s>` | Free-form tag recorded on the task. |
| `--client-ref <key>` | Submitter idempotency key — safe blind retries. |
| `--wait <secs>` | Max seconds to block for the answer (default 3600). |
| `--no-wait` | Submit and print the task id without waiting. |

### result / cancel / status
```
nyxid oracle result <task_id> --output json     # status, response, assigned_worker, chatgpt_url, model, timing
nyxid oracle cancel <task_id>                    # cancel a queued or in-flight task
nyxid oracle status <pool> --output json         # queue depth, diagnosis, active_workers[].{worker_label,script_version}
```

### Conversations
```
nyxid oracle sessions --pool <pool> --limit 50 --output json   # list your conversations
nyxid oracle session <conv_id> --output json                   # full transcript (turns[])
nyxid oracle close-session <conv_id>                           # block further turns
nyxid oracle attach <pool> "https://chatgpt.com/c/<id>"        # import an existing chat as a session
```

### extract
```
nyxid oracle extract <pool> <url> --output json   # cleaned readable page text; single-shot, no LLM
```
Requires the pool's `allow_extract=true` (chatgpt-pro-pool has it). If disabled the
call returns `403 oracle_extract_disabled`. NOTE: the human-readable form prints a
"Submitted extract task … Waiting for content…" line *before* the JSON — when
scripting, prefer `--no-wait` then `result <task_id>`, or extract the JSON object
from the output.

## Result task shape (from `oracle result --output json`, under `data`)
`task_id`, `pool_id`, `status`, `phase`, `is_followup`, `model`, `queue_position`,
`assigned_worker`, `response`, `response_chars`, `chatgpt_url`, `created_at`,
`dispatched_at`, `completed_at`.

- `assigned_worker` — the worker/account that handled it. Authoritative; use it to
  tell which account answered (do not infer from anything else).
- `model` — the *requested* hint, NOT a guarantee the answer used that model.
- `chatgpt_url` — the `/c/<id>` the worker used. A fresh single-shot ask gets a
  brand-new one (tab isolation); a follow-up reuses the conversation's URL.

## Routing & model deep-dive

- **Dispatch is competitive FIFO**, not round-robin and not account-aware. With
  multiple workers idle, any of them may claim a given task.
- **Multi-turn correctness** depends on the conversation being pinned to the
  worker/account that created it (session→worker affinity). When that affinity is
  active, every turn of a `conv_...` lands on the same `assigned_worker` and context
  is preserved. Verify by checking that all turns share one `assigned_worker` and
  that a memory-dependent recap turn recalls earlier turns.
- **If affinity is NOT active** on the deployment you hit, follow-ups misroute across
  accounts: each capital/fact answer may still look right in isolation, but a
  "list everything I asked" turn returns nothing because no single account holds the
  whole thread. In that case use a **single-account private pool** for multi-turn:
  ```
  nyxid oracle pool create <slug> --name "..." --visibility private \
        --model chatgpt-5.5-pro --max-workers 1
  ```
  (captures a one-time worker token) and run a worker on one ChatGPT account against it.
- **`attach`** is multi-turn-class: the worker that claims the import must be on the
  account that owns the `/c/<id>` URL, or it cannot open it. Same single-account
  requirement as follow-ups.

## Transient failures

- `failed` with `locator.click: Timeout` / waiting for `send-button` or
  `prompt-textarea` → the worker's ChatGPT UI had an overlay (e.g. an image-gen promo
  modal) intercepting the click. Retry the single turn. Persisting → dismiss the modal
  in the worker's browser, or harden the worker's selectors.
- `AUTH FAILED (HTTP 401/403)` in a worker → bad/rotated token or the ChatGPT tab is
  logged out. Not something the submitter can fix; the pool owner re-pairs the worker.
- Task stuck `queued` → no active worker, wrong token, ChatGPT not logged in, or
  `max_workers` saturated. Check `nyxid oracle status <pool>`.

## Pool administration (owner only)
```
nyxid oracle pool show chatgpt-pro-pool --output json
nyxid oracle pool update chatgpt-pro-pool --allow-extract true|false
nyxid oracle pool update chatgpt-pro-pool --max-workers <1-20>
```
Never `rotate-token` on a live shared pool to obtain a token — it invalidates every
paired worker. Reuse the original `nyx_owk_...` token instead.
