---
name: nyxid-oracle-chatgpt-pro-pool
description: Drive ChatGPT (GPT-5.5 Pro) through the NyxID "chatgpt-pro-pool" oracle via the `nyxid` CLI — single-shot ask, PDF question-answering, readable web-page extraction, and multi-turn conversations. Use whenever the user wants to ask ChatGPT / GPT-5.5 Pro through NyxID, summarize or query a PDF, extract the main text of a web page using a logged-in browser, or hold a multi-turn ChatGPT conversation routed through chatgpt-pro-pool. Encodes the pool's routing, model, and capability caveats so calls are made correctly.
compatibility: Requires the `nyxid` CLI installed and logged in (`nyxid login`) with oracle access to the chatgpt-pro-pool pool. macOS/Linux shell. No runtime deps.
version: "0.1"
license: MIT
metadata:
  category: tool-based
  tool-list:
    - Bash
  tag:
    - nyxid
    - oracle
    - chatgpt
    - gpt-5-5-pro
    - chatgpt-pro-pool
---

# Use the NyxID `chatgpt-pro-pool` oracle

`chatgpt-pro-pool` is a NyxID oracle pool that brokers ChatGPT (model
`chatgpt-5.5-pro`) through logged-in browser workers. You talk to it only through
the `nyxid oracle` CLI — never call ChatGPT directly. Every command takes the pool
slug `chatgpt-pro-pool` and supports `--output json` (parse that, not the table).

## Pool facts (decide routing from these)

- **Model:** `chatgpt-5.5-pro`. The task's `model` field is a *request hint*, not
  proof of what answered — confirm via the worker, not the field.
- **Workers:** more than one, on **different ChatGPT accounts** (it is a shared
  pool). Tasks are claimed FIFO; the answering worker is in the result's
  `assigned_worker` field — always check it.
- **`allow_extract`:** enabled (web extraction permitted on this pool).
- **`per_user_max_inflight`:** 2 — at most two of your tasks run at once; submit in
  small batches or you will get throttled.

## The two-step pattern (use everywhere)

Submit with `--no-wait` to get a `task_id`, then poll `result` until terminal:

```bash
TID=$(nyxid oracle ask chatgpt-pro-pool "your prompt" --no-wait --output json | \
      python3 -c "import sys,json;print(json.load(sys.stdin)['data']['task_id'])")
nyxid oracle result "$TID" --output json   # status: queued|dispatched|completed|failed
```
Terminal states are `completed` and `failed`. The result carries `response`,
`assigned_worker`, `chatgpt_url`, and timing fields. (Plain `ask` without
`--no-wait` blocks up to `--wait` seconds and returns the answer directly.)

## Capabilities

### 1. Single-shot ask — reliable here
```bash
nyxid oracle ask chatgpt-pro-pool "Explain X in 3 bullets."
nyxid oracle ask chatgpt-pro-pool --file ./prompt.txt      # or: echo "..." | ... --file -
```

### 2. PDF question-answering — reliable here
The worker uploads the PDF into the composer on the first turn, then asks your prompt.
```bash
nyxid oracle ask chatgpt-pro-pool "Summarize the attached PDF." --pdf ./report.pdf
```

### 3. Web extraction — reliable here (single-shot, no LLM)
Returns the cleaned, readable main text of a page (worker drives a real logged-in
browser, so it can read JS-rendered / session-walled pages).
```bash
nyxid oracle extract chatgpt-pro-pool "https://example.com/article"
```

### 4. Multi-turn conversation
```bash
CONV=$(nyxid oracle ask chatgpt-pro-pool "Turn 1..." --new-conversation --output json | \
       python3 -c "import sys,json;print(json.load(sys.stdin)['data']['conversation_id'])")
nyxid oracle ask chatgpt-pro-pool "Follow-up..." --conversation "$CONV"
nyxid oracle sessions --pool chatgpt-pro-pool --output json   # list conversations
nyxid oracle session "$CONV" --output json                    # transcript
nyxid oracle close-session "$CONV"                            # block further turns
```
Multi-turn relies on the backend pinning a conversation to the worker/account that
created it (session→worker affinity). If follow-ups come back with lost context or
land on a different `assigned_worker` than turn 1, the affinity is not in effect on
this deployment — fall back to a single-account pool for multi-turn. See
`references/usage.md`.

## Always do
- Parse `--output json`; read `assigned_worker` to know which worker/account answered.
- Keep ≤2 tasks in flight (`per_user_max_inflight`).
- Treat `failed` with a `locator`/click timeout as a transient worker UI error — retry
  the single turn; it is not a routing problem.

## Never do
- Never `nyxid oracle pool rotate-token chatgpt-pro-pool` to "get" a token — it
  invalidates every worker paired to the pool. Reuse the original token.

Full command catalogue, error handling, and the routing/model deep-dive are in
`references/usage.md`.
