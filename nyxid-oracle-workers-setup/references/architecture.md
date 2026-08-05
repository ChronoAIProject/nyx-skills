# Oracle worker architecture & routing rules

Read this before choosing a pool layout. It decides whether multi-turn works.

## The objects (and the one thing that matters)

NyxID has **no "account" entity**. A `pool` does not bind to any ChatGPT account
(the pool doc has owner / visibility / quotas only). What account a task runs on
is decided entirely by **which Chrome profile a worker drives**.

```
worker process = (one pool's token)            # which pool it polls
               × (one Chrome profile/CDP port) # = one ChatGPT account
               × (one slot tab: ?nyx=… + marker) # its private tab in that browser
```

Mapping is many-to-many, glued by worker processes:
- **One account → many pools**: run several workers against the *same* Chrome
  (same CDP port), each with a different pool token + a different slot tab.
- **One pool → many workers**: many workers (even on different machines/accounts)
  poll the same pool.
- **Second account** = second Chrome profile = second CDP port (e.g. 9223) =
  its own worker(s). A worker can only reach the one CDP port it's pointed at.

## How dispatch works (no round-robin, no account awareness)

Workers **poll**; the server hands out the oldest queued task via an atomic claim
(`claim_task`: filter `{pool_id, status:"queued"}`, sort `created_at:1`). It is a
competitive FIFO pull queue — load-balanced by availability, **not** rotation,
and it **does not look at which account owns a conversation**.

- `max_workers` is the **concurrency cap** (max tasks dispatched at once), range
  **1–20**, default 3. It is NOT a limit on how many workers may connect. With 5
  workers but `max_workers=1`, only one task runs at a time; raise it to use them.
- A *dispatched* task is pinned to its `assigned_worker_id` for resume-after-reload,
  but the *initial claim* of a follow-up is free-for-all.

## The multi-turn rule (the whole point)

A follow-up carries a fixed `conversation_id` → the server looks up the session's
`chatgpt_url` (`/c/<id>`) and the worker does `goto(that url)`. But that
conversation **physically lives in one account's ChatGPT**, and the server never
recorded which account/worker created it — so it may hand the follow-up to a
worker on a *different* account, which cannot open that `/c/<id>`.

> **A fixed `conv_id` pins WHICH conversation, not WHICH account/worker.**
> conv_id fixed ≠ worker fixed.

Therefore, judging a pool is one question — **how many accounts are in it:**

| Pool composition | fresh tasks | follow-up / `--conversation` / `attach` |
|---|---|---|
| **Single account** (private pool, or all workers same Chrome profile) | ✅ | ✅ correct |
| **Multiple accounts** (different profiles share one pool) | ✅ load-balanced | ❌ misroutes across accounts |

## Decision guide

- **Private, self-use pool** → one account in it → everything works. Default choice.
- **Shared "compute" pool, fresh-only** → many accounts OK as a load balancer,
  but consumers must only submit single-shot `ask` (no `--conversation`,
  `--new-conversation`, or `attach`). Set `--max-workers` to the worker count.
- **Shared pool that also needs correct multi-turn** → not possible with stock
  routing. Use **one pool per account** instead, or add server-side
  session→worker affinity (a backend change, out of scope for this skill).

## What URL-key isolation (this worker) does / doesn't fix

Fixes: **tab pollution** — each worker pins its own slot tab, and every fresh
task re-navigates to its slot key URL first, so a prompt never lands in another
project's stray `/c/<id>`. Works for any number of same-account workers/tabs.

Does NOT fix: cross-account follow-up routing (that is server-side, above).

## Per-worker invariants (always)

- **Unique label per pool** — two workers sharing a label on one pool steal each
  other's leases.
- **Unique slot** — distinct `?nyx=<slot>` URL and storage marker per worker, so
  workers sharing one Chrome don't fight over a tab.
- **Right token** — each worker uses its pool's token (token is per-pool, shared
  by all that pool's workers — NOT per-account).
