---
name: nyxid-oracle-workers-setup
description: Provision a NyxID Oracle CDP worker on a macOS machine with URL-key tab isolation (script_version cdp-1.3-url-key-image), running under launchd and pinned to its own slot tab so fresh tasks never reuse another project's ChatGPT conversation. Make sure to use this skill whenever the user wants to set up / add / register / onboard a ChatGPT Oracle worker on a Mac, connect a Mac to a NyxID oracle pool, run a CDP worker as a background service, add a second ChatGPT account/worker, or replicate the same worker on another MacBook — even if they don't name the skill. Includes the pool-vs-account routing rules that decide whether multi-turn works.
compatibility: macOS; Node 18+; Google Chrome or Chromium; the `nyxid` CLI logged in (for verification/admin). Internet access to install playwright-core if no local clone exists.
version: "1.1"
metadata:
  category: runtime-based
  output-type: text
  runtime:
    - bash
    - node
  runtime-dependency:
    - playwright-core
  runtime-env-var:
    - NYXID_ORACLE_WORKER_TOKEN
  tag:
    - nyxid
    - oracle
    - chatgpt
    - cdp-worker
    - macos
    - launchd
---

# Create a NyxID Oracle CDP worker (macOS, URL-key isolation)

Sets up one worker that polls a NyxID oracle pool, drives a logged-in ChatGPT tab
over the Chrome DevTools Protocol, and is **pinned to its own slot tab**: every
fresh task first navigates to the worker's own slot key URL (so a prompt never
lands in a stray `/c/<id>` from another project), and follow-ups go only to the
server-provided `conversation_url`. Runs under launchd (auto-start + restart) and
survives Chrome restarts (auto-reconnect).

The heavy lifting is `scripts/setup-macos-worker.sh`; the worker itself is bundled
at `assets/worker-tab-isolated.mjs` (self-contained, needs only `playwright-core`).

**New in 0.7–0.8 (`cdp-1.3-url-key-image`):** the worker now extracts ChatGPT-generated
images (downloaded through the logged-in browser session) and returns them on the
task — `oracle ask … --out <file>` saves the image to disk. It also adds a
no-output idle guard: an image-only or otherwise unextractable turn fails fast
instead of wedging a slot for hours. Image **delivery** additionally requires a
NyxID backend new enough to accept the `images[]` result field; against an older
backend the worker still no longer wedges (the turn just fails fast). 0.8 hardens
this: image extraction only fetches ChatGPT's own content hosts (never an
arbitrary model-emitted `<img src>`), dedupes multi-resolution copies by file id,
and the PDF-attach path is guarded to first turns only. **1.0** enforces
**HTTPS** for the worker token (the worker refuses to start if `NYXID_BASE_URL`
is plain `http://` other than localhost) so the bearer token is never sent in
cleartext. See **`references/security.md`** for the full security model and a
mapping of every trust-audit finding (what credential, where it goes, why the
injected DOM code is static/auditable, and that the launchd install is
user-scoped + reversible). **1.1** adds **input-file upload**: when a task
carries an attachment the worker uploads it to the composer on the first turn
(mime inferred from the filename — image / pdf / ...), so `oracle ask …
--attach-file <path>` lets the model answer questions about a file. Requires a
NyxID backend new enough to forward the attachment; older backends just omit it.

## Step 1 — Decide the pool layout (do this first)

The pool choice determines whether multi-turn works. **Read
`references/architecture.md`** and apply the one rule:

> A pool is correct for multi-turn only if it contains **one ChatGPT account**.
> Multiple accounts in one shared pool → fresh tasks work, but follow-ups
> (`--conversation` / `--new-conversation` / `attach`) misroute across accounts.

So:
- **Private, self-use worker** → its own private pool (one account) → all good.
- **Contributing an account to a shared "compute" pool** → only safe for
  single-shot `ask`; tell the user multi-turn won't be correct there.
- **Several accounts that each need correct multi-turn** → one pool per account.

If a suitable pool/token doesn't exist yet, an org admin creates it first:
`nyxid oracle pool create <slug> --visibility private --model chatgpt-5.5-pro --max-workers 1 --output json`
— capture `worker_token` straight into a 0600 file (do not print it). For N
concurrent workers on one pool, set `--max-workers N` (1–20).

**Never `rotate-token` to obtain a token for an existing pool.** The worker token
is per-pool and shared by *all* its workers; rotating it **invalidates every
worker/tab currently paired to that pool** — on this machine *and* on others —
silently breaking them. To join an existing pool you must get its current token
from whoever provisioned it (reuse the same `nyx_owk_…`). If you cannot obtain it,
**create a new pool instead** — do not rotate a shared/live one. Only rotate when
the explicit goal is to revoke a leaked token and re-pair every worker.

## Step 2 — Gather parameters

Ask the user / determine:
- **pool** slug, and the **worker token** (path to an existing `nyx_owk_…` file, or
  provide it via env `NYXID_ORACLE_WORKER_TOKEN` so the script writes a 0600 file).
- **slot** — a unique id for this worker on the pool, e.g. `share_account_1`. It
  derives the label, slot key URL (`https://chatgpt.com/?nyx=<slot>`), URL match,
  and storage marker. **Must be unique across every worker/machine on that pool.**
- **second account on this Mac?** → it needs a second Chrome profile on a second
  CDP port: pass `--port 9223 --profile ~/.nyxid-chrome-acctB`.

## Step 3 — Run the setup

```bash
# token already in a file:
scripts/setup-macos-worker.sh --pool <slug> --slot <name> --token-file <path>

# or hand the token via env (script writes a 0600 file, never prints it):
NYXID_ORACLE_WORKER_TOKEN='nyx_owk_…' scripts/setup-macos-worker.sh --pool <slug> --slot <name>
```

Useful options: `--port` / `--profile` (second account), `--no-chrome-agent` (you
manage Chrome yourself), `--base-url`, `--smoke` (run a verification task). Run
`scripts/setup-macos-worker.sh` with no args to see all flags.

The script: copies the worker into `~/Library/Application Support/NyxIDOracleWorkers/`,
ensures `playwright-core` (links a local clone's `node_modules` if present, else
`npm install` — no browser download), installs a launchd Chrome agent (unless
`--no-chrome-agent`) and the worker agent, then verifies. **After it launches
Chrome, log into ChatGPT once** in that window (the login persists in the profile).

## Step 4 — Verify

Confirm against `references/troubleshooting.md` "Verify success criteria":
worker label in `active_workers`, `script_version=cdp-1.3-url-key-image`, and a
`--smoke` result whose `chatgpt_url` is a fresh `/c/<id>` (not a pre-existing
conversation).

If an answer comes back as unrelated content (a math paper, newmath, BioReality,
etc.), the worker hit a stray conversation — stop it and follow
`references/troubleshooting.md`.

## Step 5 — Updating an existing worker to a newer version

Installing newer skill files does **not** update a worker that's already running.
The launchd job keeps executing the deployed binary at
`~/Library/Application Support/NyxIDOracleWorkers/worker-tab-isolated.mjs` until
it is replaced *and* the job is restarted. A worker can therefore answer tasks
normally while silently running stale code (no version is visible in
`oracle status` — `script_version` tracks the protocol, not the skill version).

To update, after writing the new skill files, **re-run the setup script with the
same parameters** — it redeploys the worker binary and restarts the launchd agent:

```bash
scripts/setup-macos-worker.sh --pool <slug> --slot <name> --token-file <path>
```

Or do it by hand: copy the new `assets/worker-tab-isolated.mjs` over the deployed
one and `launchctl kickstart -k gui/$(id -u)/com.nyxid.oracle.cdp-worker.<label>`.
Re-running is safe/idempotent: an existing Chrome on the port is left as-is, and
the pool/token are untouched.

## Notes

- Each worker = one pool token + one Chrome profile (account) + one slot tab. One
  account can join many pools (more workers, same port, different slots); a second
  account needs a second profile + port. See `references/architecture.md`.
- Never print, log, screenshot, or commit the worker token.
- The dedicated Chrome profile should be used only for NyxID/ChatGPT (the debug
  port is an unauthenticated local control channel).
