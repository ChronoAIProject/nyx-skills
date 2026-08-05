# Security model & audit rationale

This skill provisions a **credentialed background daemon that automates a
logged-in browser**. By design it reads a secret, talks to the network, injects
DOM-extraction code into a page, and installs itself as a service — so a static
trust auditor will (correctly) flag those capabilities. This document explains
exactly what each behavior is, how it is scoped, and why it is safe in the
intended deployment, so the findings can be read as *intended and minimized*
rather than *unexplained*.

## Audit findings, mapped

### 🔴 Credential access
- **What:** the worker reads one secret — the **pool worker token** (`nyx_owk_…`),
  a bearer token scoped to a single oracle pool.
- **Source:** `NYXID_WORKER_TOKEN_FILE` (preferred) or `NYXID_WORKER_TOKEN`.
  The setup script writes the token to a `0600` file (`umask 077` + `chmod 600`)
  and **never prints it**; the launchd plist stores the file *path*, not the
  token, so it is not exposed in `ps`, `/proc/<pid>/environ`, or the plist.
- **No other credentials** are read. The worker never touches ChatGPT
  credentials — it drives an already-logged-in Chrome over CDP; the login lives
  in the user's own Chrome profile, never handled by this code.
- **Never logged:** `log()` only emits task ids, phases, sizes, and model labels
  — never the token or prompt/answer bodies.

### 🔴 Credential-to-network dataflow
- **What:** the worker token is sent as `Authorization: Bearer …` to the NyxID
  relay so the worker can poll for tasks and submit results.
- **Destination is fixed:** only the operator-configured `NYXID_BASE_URL`
  (`…/api/v1/oracle/worker`). The token goes nowhere else.
- **TLS enforced:** the worker **refuses to start** unless `NYXID_BASE_URL` is
  `https://` (loopback `http://localhost` is allowed for local dev only), so the
  bearer token cannot be transmitted in cleartext.
- **Other egress** is the user's own ChatGPT tab (via local CDP) and downloading
  generated images. Image fetches are **restricted to ChatGPT content hosts**
  (`oaiusercontent` / `backend-api` / `blob:`) at the fetch boundary, so an
  untrusted model-emitted `<img src>` can never steer the cookie-bearing fetch at
  an internal/LAN URL (SSRF guard).

### 🟠 Code obfuscation
- **What trips it:** the DOM-extraction helpers (`window.__nyx`) are shipped as a
  source string (`DOM_CORE`) and injected into the ChatGPT page via Playwright's
  standard `page.addInitScript()` / `page.evaluate()`.
- **Why it is not obfuscation:** the code is plain, readable JavaScript, **bundled
  static in this file** — it is never fetched from the network, never built from
  user/model input, and never run through `eval`/`new Function`. The string form
  is required only because it is injected into a *different* JS realm (the page);
  it is fully auditable inline in `assets/worker-tab-isolated.mjs`.

### 🟠 System modification
- **What:** the setup script installs launchd agents and copies the worker into
  the user's home directory.
- **Scope is user-level only:** it writes to `~/Library/LaunchAgents/` and
  `~/Library/Application Support/NyxIDOracleWorkers/` and runs `launchctl … -w`
  as the current user. It needs **no root / sudo**, touches **no** `/System` or
  `/Library` system paths, and starts no setuid/privileged process.
- **Reversible:** removing the two plists (`launchctl bootout` / `unload`) and the
  Application Support directory fully uninstalls it; nothing else on the system is
  changed.

## Data handling
Prompts, answers, and generated images transit the NyxID relay (the operator's
own service). The worker persists nothing locally except metadata-only logs
under `~/Library/Logs/NyxIDOracleWorkers/`. Retention/TTL of bodies is governed
server-side by the relay, not by this skill.

## Residual risk (honest summary)
The two 🔴 findings are **intrinsic** to a relay worker: it must read a token and
send it to an authenticated endpoint. They cannot be removed without removing the
feature. What this skill does instead is **minimize and bound** that risk —
`0600` file-based token, TLS-enforced single destination, no logging, host-locked
image fetches, user-scoped reversible install, and static auditable injected
code.
