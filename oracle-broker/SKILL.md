---
name: oracle-broker
description: Ask ChatGPT Pro through the Chrono oracle broker with the NyxID CLI (`nyxid proxy request oracle ...`) - single-shot questions, multi-turn conversations, file attachments, web-page extraction, generic jobs, pool and worker management. Questions go through the streaming OpenAI-compatible endpoint, one call per answer with no polling. Use whenever the user wants to ask ChatGPT or GPT Pro through NyxID, continue a ChatGPT conversation, query a file, check an oracle pool or its workers, or point an OpenAI client at the oracle. Do not use `nyxid oracle ...` for this; that command talks to the older oracle built into NyxID.
compatibility: Requires the nyxid CLI, logged in with `nyxid login`, and access to the NyxID service `oracle`. Any shell with curl or python3 for parsing. Verified 2026-10-07 against broker 2179320 and pool chrono-chatgpt-pro-pool.
version: "1.1"
license: MIT
metadata:
  category: tool-based
  tool-list:
    - Bash
  tag:
    - nyxid
    - oracle
    - chatgpt
    - chatgpt-pro
    - openai-compatible
---

# Use the oracle broker through NyxID

The oracle broker queues questions for ChatGPT Pro and hands them to browser workers that
are logged in to ChatGPT. It is registered in NyxID as the service `oracle`. Every call goes
through NyxID's proxy:

```bash
nyxid proxy request oracle api/v1/oracle/PATH [--method POST] [--data 'JSON'] [--output json]
```

NyxID checks the user's login and tells the broker who is calling. There is no other key to
manage. Answers are plain JSON objects, not wrapped in `data`.

The default pool is `chrono-chatgpt-pro-pool` (model `chatgpt-6-pro`). Ask the user for another
pool slug only if they name one; list pools with `GET api/v1/oracle/pools`.

## Rules that matter

- **Never use `nyxid oracle ...`.** It talks to the older oracle inside NyxID, with other pools.
- **Ask through the streaming endpoint.** Send questions to the OpenAI-compatible endpoint
  with `"stream": true`, as shown below. It is one call that stays open until the answer
  arrives, so there is nothing to poll. A Pro answer often takes 1 to 5 minutes; keep the
  call open, do not cancel it.
- **Always set `"stream": true`.** Without it the connection stays silent while ChatGPT
  thinks, and Cloudflare in front of NyxID cuts a silent request after 100 seconds.
- **Quota:** a pool limits how many questions one user may have queued or running. A `429`
  means wait for earlier ones to finish, then retry. Do not retry in a tight loop.
- **One question per call.** Do not batch several questions into one prompt.
- **Do not print secrets.** A pool's worker token is shown once at pool creation; write it to
  a file with mode 600, never into chat or logs.
- **Check who answered.** The final chunk's `oracle` object has `observed_model_switcher`
  and `observed_model_effort` (for example `gpt_6_pro`, `pro`), which show the model that
  really answered.

## Ask a question (preferred)

The model is the pool, written `oracle/POOL`. Write the request to a file, send it, and
read the streamed answer:

```bash
cat > ask.json <<'JSON'
{"model": "oracle/chrono-chatgpt-pro-pool", "stream": true,
 "messages": [{"role": "user", "content": "Explain X in three sentences."}]}
JSON

nyxid proxy request oracle api/v1/oracle/openai/v1/chat/completions \
  --method POST --data @ask.json > answer.sse

python3 - answer.sse <<'PY'
import json, sys
text, info = "", {}
for line in open(sys.argv[1]):
    line = line.strip()
    if not line.startswith("data: ") or line == "data: [DONE]":
        continue                       # lines starting with ":" are keep-alives
    chunk = json.loads(line[6:])
    if "error" in chunk:
        sys.exit("error: " + json.dumps(chunk["error"]))
    for choice in chunk.get("choices", []):
        text += (choice.get("delta") or {}).get("content") or ""
    info = chunk.get("oracle") or info
print(text.strip())
print("conversation_id:", info.get("conversation_id"), "task_id:", info.get("task_id"),
      "model:", info.get("observed_model_switcher"), file=sys.stderr)
PY
```

The output is Server-Sent Events: `data: {...}` lines with pieces of the answer, `:` lines
that only keep the connection alive, and `data: [DONE]` at the end. The last data chunk
carries an `oracle` object with `task_id`, `conversation_id` and `chatgpt_url`.

## Multi-turn conversation

1. First turn: add `"metadata": {"conversation_id": "new"}` to the request. Read the new
   `conversation_id` (`conv_...`) from the `oracle` object in the answer.
2. Every later turn: send only the new user message, with
   `"metadata": {"conversation_id": "conv_..."}`. ChatGPT already holds the earlier turns.

```json
{"model": "oracle/chrono-chatgpt-pro-pool", "stream": true,
 "metadata": {"conversation_id": "conv_..."},
 "messages": [{"role": "user", "content": "Follow-up question"}]}
```

Without `metadata.conversation_id` every call is a fresh ChatGPT chat. If you do send the
whole history, only the messages after the last assistant message reach ChatGPT.

A conversation stays on the worker that answered its first turn, because only that worker's
ChatGPT account can open the chat. If that worker is offline, the follow-up waits. Read the
whole conversation with `GET api/v1/oracle/sessions/conv_...`; list them with
`GET api/v1/oracle/sessions?pool=chrono-chatgpt-pro-pool`; end one with
`POST api/v1/oracle/sessions/conv_.../close`.

## Attach a file

Only on a single question or on the first turn of a conversation. One file per request, up
to about 9 MB (12 MB once base64-encoded). Put it in the message as a `file` part:

```bash
python3 - <<'PY' > ask.json
import base64, json
data = base64.b64encode(open("report.pdf", "rb").read()).decode()
print(json.dumps({"model": "oracle/chrono-chatgpt-pro-pool", "stream": True,
    "messages": [{"role": "user", "content": [
        {"type": "text", "text": "Summarise the attached report."},
        {"type": "file", "file": {"filename": "report.pdf", "file_data": data}}]}]}))
PY
```

Then send `ask.json` as above. For an image, use
`{"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}`. Remote URLs are
refused: the worker never downloads files for you.

## When you cannot stream: the task API

Use this only if the tool you call through cannot keep one request open for minutes. It
submits a task, then waits for it in steps of at most 60 seconds:

```bash
TID=$(nyxid proxy request oracle api/v1/oracle/pools/chrono-chatgpt-pro-pool/tasks \
  --method POST --data '{"prompt":"Explain X in three sentences."}' --output json \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["task_id"])')

while :; do
  OUT=$(nyxid proxy request oracle "api/v1/oracle/tasks/$TID?wait=60" --output json)
  STATUS=$(echo "$OUT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["status"])')
  case "$STATUS" in completed|failed|cancelled) break;; esac
done
echo "$OUT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("response") or d.get("failure_reason"))'
```

Never ask for more than `wait=90`. Conversations use `"conversation_id": ""` on the first
task and `"conversation_id": "conv_..."` after. Files go in `attachment_base64` and
`attachment_name`. Generated images and files come back base64 in the task's `images` and
`files`; the streaming endpoint does not return them.

## Other tasks

- **Cancel:** `POST api/v1/oracle/tasks/TASK_ID/cancel` with `--data '{}'`.
- **Import an existing ChatGPT chat:** `POST api/v1/oracle/pools/POOL/attach` with
  `{"chatgpt_url":"https://chatgpt.com/c/..."}`. It returns a `conversation_id` to continue.
- **Read a web page with a worker's browser:** `POST api/v1/oracle/pools/POOL/extract` with
  `{"url":"https://..."}`. Only on pools with `allow_extract`; private addresses are refused.
- **Retry safely:** add `"client_ref":"any-unique-string"` to a submit. Repeating it returns
  the first task instead of creating a second.

## Pool and workers

```bash
nyxid proxy request oracle api/v1/oracle/pools                                    # list
nyxid proxy request oracle api/v1/oracle/pools/chrono-chatgpt-pro-pool/status     # queue, workers
nyxid proxy request oracle api/v1/oracle/pools/chrono-chatgpt-pro-pool/workers    # online, logged in
```

Worker commands, for the pool owner: `POST api/v1/oracle/pools/POOL/workers/LABEL/commands`
with `{"command":"drain"}`. Commands are `drain`, `resume`, `restart`, `relaunch_browser` and
`relogin`. A worker with `logged_in: false` needs someone to log in to ChatGPT on its Mac.

## From an OpenAI SDK or app

The same endpoint works from any OpenAI client library or app, without the nyxid CLI:

- Base URL: `https://nyx-api.chrono-ai.fun/api/v1/proxy/s/oracle/api/v1/oracle/openai/v1`
- API key: a NyxID API key (`nyxid_ag_...`) or the NyxID login token.
- Model: `oracle/chrono-chatgpt-pro-pool`.
- Always stream (`stream=True`), for the 100-second reason above.
- Set a custom `User-Agent` header. Cloudflare answers `403` "error code: 1010" to some
  default agents, Python's urllib among them.
- Conversations: pass `metadata.conversation_id` `"new"` on the first call and the returned
  `oracle.conversation_id` after. On `/responses`, use `previous_response_id`.

## Errors

Errors are JSON: `{"error": "...", "error_code": NNNNN, "message": "..."}`.

| Status | Meaning | What to do |
|---|---|---|
| 400 | Bad request (empty prompt, bad field) | Fix the body |
| 401 | Not logged in, or the login expired | `nyxid login` |
| 403 | No access to this pool or action; or Cloudflare 1010 | Check the pool; set a User-Agent |
| 404 | Unknown pool, task, conversation or worker | Check the id |
| 409 | Conversation closed, or a conflicting change | Start a new conversation |
| 429 | Per-user quota or full queue | Wait for running tasks, then retry |
| 503 | Pool inactive | Ask the pool owner |

A task that ends `failed` has `failure_reason`. `model_unavailable` and `usage_limit_reached`
mean no worker could run Pro right now; try later. `prompt_delivery_uncertain` means the
worker could not tell whether ChatGPT received the prompt; it is never resent automatically,
so check before asking again.

See `references/api.md` for every route and field.
