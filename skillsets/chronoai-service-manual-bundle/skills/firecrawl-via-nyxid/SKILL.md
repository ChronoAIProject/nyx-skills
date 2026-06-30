---
name: firecrawl-via-nyxid
description: Teach an aevatar agent to run Firecrawl web-research/agent jobs through NyxID (submit, poll, then read the result).
version: "1.1"
metadata:
  category: plain
  tag: [firecrawl, web-scraping, web-research, nyxid, aevatar]
---

# Firecrawl via NyxID

This skill teaches an aevatar agent how to drive **Firecrawl** through **NyxID**. NyxID brokers Firecrawl as a connected service and injects the user's Firecrawl API key automatically, so the agent never handles the raw `fc-...` key.

## What Firecrawl is and when to use it

Firecrawl turns the live web into data. It offers:

- **scrape** — fetch one URL as clean markdown/HTML/structured content.
- **crawl** — walk a whole site and return its pages.
- **search** — web search that returns scraped results.
- **map** — discover all URLs on a site.
- **extract** — pull structured data from pages against a schema.
- **agent** — an *autonomous* web-research worker. You give it a natural-language prompt (optionally a list of `urls` to focus on and a JSON `schema` for structured output) and it browses, searches, and extracts on its own. It can work even without a URL.

Reach for Firecrawl whenever you need **fresh web data** or **structured extraction** that the model cannot answer from its own knowledge — current prices, recent events, competitor pages, documentation lookups, or assembling a structured dataset from across the web. The **agent** operation is the most powerful: hand it a question and it figures out where to look.

This skill focuses on the **agent** operation (async submit -> poll -> result), but the same NyxID service slug reaches every Firecrawl endpoint listed above.

## Prerequisite: the owner must connect Firecrawl in NyxID

Firecrawl is brokered as NyxID service slug **`api-firecrawl`** (base `https://api.firecrawl.dev`, bearer auth). Before any agent can call it, the **scope owner** (a human, not the agent) connects it once with their Firecrawl API key:

```
POST /api/v1/keys
{ "service_slug": "api-firecrawl", "credential": "fc-..." }
```

This is a one-time setup step performed by the owner — **the agent does not do this** and never sees the key. After connecting, NyxID injects the key on every brokered request.

**How the agent checks it is available.** Confirm `api-firecrawl` appears in the connected-services list before calling it:

- Server-side tool: `nyxid_services` with `{"action":"list"}`, or
- REST: `GET /api/v1/services`

Look for an entry whose slug is `api-firecrawl`. If it is **absent**, Firecrawl is not connected yet — the agent cannot call it until the owner connects it (above). Surface that to the user rather than failing silently.

## How to call it

There are two interchangeable ways to invoke Firecrawl. Both go through NyxID; both inject the key automatically.

### (a) Typed tool calls (preferred when present)

NyxID publishes an `x-aevatar-tool` OpenAPI overlay (live at `GET {NYX}/api/v1/catalog-specs/firecrawl/openapi.json`) that aevatar auto-discovers and materializes into typed workflow/agent tools. By the NyxID connected-service naming convention `nyxid_{service_slug}__{operation}`, the two operations become:

- **submit** → `nyxid_api-firecrawl__agent` (writes — `readOnly: false`)
- **poll** → `nyxid_api-firecrawl__agent_status` (read-only — `readOnly: true`)

> Confirm the exact tool names by listing your available tools, since hyphen handling in the slug may be normalized in your environment.

Call `nyxid_api-firecrawl__agent` with the submit arguments, take the returned `id`, then call `nyxid_api-firecrawl__agent_status` with `{ "id": "<id>" }` and repeat until the status is terminal.

### (b) Raw `nyxid_proxy` tool call (always works, name-stable)

When typed tools are not present, or you want a name-stable path, use the generic `nyxid_proxy` tool. It is the most reliable option and reaches **every** Firecrawl endpoint on the same slug.

Submit:

```json
{
  "tool": "nyxid_proxy",
  "arguments": "{\"slug\":\"api-firecrawl\",\"path\":\"/v2/agent\",\"method\":\"POST\",\"body\":{\"prompt\":\"...\",\"model\":\"spark-1-mini\"}}"
}
```

Poll (substitute the `id` returned from submit):

```json
{
  "tool": "nyxid_proxy",
  "arguments": "{\"slug\":\"api-firecrawl\",\"path\":\"/v2/agent/<id>\",\"method\":\"GET\"}"
}
```

The same slug also reaches the other operations for non-agent use — e.g. `path: "/v2/scrape"`, `/v2/crawl`, `/v2/search`, `/v2/map`, `/v2/extract`.

### Request and response shapes (the agent operation)

These are the shapes the typed tools and the proxy wrap. Match them exactly.

**Submit** — `POST /v2/agent`:

```json
{
  "prompt": "<string, REQUIRED, <= 10000 chars>",
  "model": "spark-1-mini",            // default, cheaper | "spark-1-pro"
  "urls": ["<string>"],                // optional — focus/constrain the search
  "schema": { "<JSON schema>": "..." },// optional — structured output
  "maxCredits": 2500,                   // optional, default 2500
  "strictConstrainToURLs": false        // optional
}
```

Returns:

```json
{ "success": true, "id": "<jobId, a UUID>", "status": "processing" }
```

**Poll** — `GET /v2/agent/{id}`:

```json
{
  "success": true,
  "status": "processing",        // "processing" | "completed" | "failed" | "cancelled"
  "data": { },                    // present when status == "completed"
  "creditsUsed": 0,
  "expiresAt": "<iso timestamp>"
}
```

Keep polling while `status` is `processing`. Stop on the terminal states `completed` (read `data`), `failed`, or `cancelled`. Results are retained for roughly **24 hours**.

## The async submit → poll pattern

The Firecrawl agent is **asynchronous**: a submit returns immediately with a job `id`, and the job finishes in **minutes — sometimes longer**. You must submit once, then poll the status until it reaches a terminal state.

### In a single agent turn

1. Call `nyxid_api-firecrawl__agent` (or the `nyxid_proxy` submit) with your prompt → get `id`.
2. Call `nyxid_api-firecrawl__agent_status` (or the `nyxid_proxy` poll) with that `id`.
3. If `status` is `processing`, wait briefly and poll again. When `status` is `completed`, read `data`; on `failed`/`cancelled`, report the failure.

### In an aevatar workflow

Model it as: a `tool_call` submit → a `while` loop that polls with a `delay` between iterations → a `switch` on `status` to a terminal branch. **Do not hand-roll the loop from memory** — the engine's exact step syntax is easy to get wrong. Start from the canonical templates below and adapt them.

The one shape worth memorizing is the NyxID call itself. In real aevatar DSL a `tool_call` step puts `tool`/`arguments` **under `parameters:`**, interpolation uses `${...}`, and you read a JSON field of a prior step's result with `${steps.<id>.json.<field>}`:

```yaml
- id: submit
  type: tool_call
  parameters:
    tool: nyxid_proxy
    arguments: '{"slug":"api-firecrawl","path":"/v2/agent","method":"POST","body":{"prompt":"Find ACME Cloud pricing tiers","model":"spark-1-mini","maxCredits":2500}}'
  next: poll
# the submitted job id is then available as ${steps.submit.json.id}
```

Other real-DSL facts you will need: branching is `switch` with `parameters: { on: "...", branch.<key>: <step-id> }` plus a `branches:` map; `delay` takes `parameters: { duration_ms: "5000" }` (string value); a poll step's path interpolates the id, e.g. `"/v2/agent/${steps.submit.json.id}"`. For the **full** submit → poll-loop → branch wiring, reuse the canonical templates rather than rewriting the loop.

### Canonical templates and engine caps

aevatar already ships canonical templates for exactly this pattern, registered in its `WorkflowDefinitionCatalog` — **prefer them** over hand-rolling:

- `firecrawl_agent_async_submit.yaml`
- `firecrawl_agent_async_poll.yaml`

Engine caps to respect: `delay` ≤ **5 minutes** (`duration_ms`), `while` ≤ **1,000,000 iterations**, `wait_signal` ≤ **24 hours**. For **multi-hour** jobs that could exceed a single run's budget, do not block — decompose the wait across runs with `self_reschedule`.

## Cost guidance

- A **submit spends Firecrawl credits** (default cap **2500 per job** via `maxCredits`). **Status polling is free** — poll as needed.
- Prefer **`spark-1-mini`** (the default): it is roughly **60% cheaper** than `spark-1-pro`. Only reach for `spark-1-pro` when a job genuinely needs the stronger model.
- Always set a **sane `maxCredits`** to cap spend per job.

## Quick recap

1. Owner connects `api-firecrawl` once in NyxID (`POST /api/v1/keys`).
2. Agent confirms `api-firecrawl` is in the connected-services list.
3. Submit a natural-language prompt (`model: spark-1-mini`, a `maxCredits` cap, optional `urls`/`schema`) → get `id`.
4. Poll `agent_status` / `GET /v2/agent/{id}` until `status` is terminal; read `data` on `completed`.
5. In workflows, use a `tool_call` submit → `while` + `delay` poll → `switch` on `status`, or reuse the canonical `firecrawl_agent_async_*` templates.
