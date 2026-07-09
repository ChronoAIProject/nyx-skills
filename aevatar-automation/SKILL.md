---
name: aevatar-automation
description: "Aevatar scheduling & workflow automation: scheduled_agent_creator (cron/one-shot), the long-running task automation playbook, workflow creation semantics (Scope Workflow vs Ornn publish), agent_builder lifecycle, and scheduled-run credential lifetimes (5-minute broker token at fire) with a token_expired triage protocol."
version: "1.1"
metadata:
  category: plain
  tag:
    - aevatar
    - aevatar-system
    - scheduling
    - workflow
    - automation
    - agent-builder
    - credentials
    - token-expired
---

#### scheduled_agent_creator (scheduled Ornn skill agents)

Use `scheduled_agent_creator` to create a new caller-owned scheduled automation agent from an Ornn skill reference, or to create a single delayed reminder.

For recurring automation, set `schedule_mode="cron"` and provide `skill_ref`, `schedule_cron`, and `schedule_timezone`; optional LLM tuning fields are allowed. If the loaded skill body will call connected NyxID services through `nyxid_proxy` beyond Ornn and the Lark outbound channel, include `required_service_slugs` with the exact service slugs from the current connected-services context, for example `["tavily-search", "api-github"]`.

For one-shot delayed reminders such as "remind me in 10 minutes" or "later today tell me ...", set `schedule_mode="one_shot"` and provide exactly one of `delay_seconds` or `run_at_utc`, plus `one_shot_message`. Prefer `delay_seconds` when the user gave a relative delay. Do not use `code_execute` with `sleep`, timers, polling loops, or long-running scripts for delayed one-shot requests; durable delivery must go through `scheduled_agent_creator`. Do not publish an Ornn skill just to send a one-shot natural-language reminder unless the user explicitly asks for reusable automation or the reminder requires a real skill workflow.

Do not provide owner, scope, Lark target, Nyx provider slug, API key, service IDs, inline skill content, or outbound credential fields. This write command does not request remote approval; the tool derives context from the current authenticated/channel turn, mints a scoped NyxID key, and returns only an accepted receipt or a typed tool error.

`skill_ref` must be unversioned for now. A `name@version` reference returns `versioned_skill_ref_not_supported_yet`.

### Scheduled-run credentials: verified lifetimes, not folklore

Scheduled dispatch never persists or replays a user bearer. At every fire, aevatar exchanges the
stored NyxID broker binding for a fresh access token (OAuth token-exchange with
`subject_token_type=urn:nyxid:params:oauth:token-type:binding-id`) and projects that ONE token into
the run as its caller credential. Code path: aevatar
`agents/Aevatar.GAgents.Channel.Identity/Broker/NyxIdRemoteCapabilityBroker.cs` (the exchange) and
`src/platform/Aevatar.GAgentService.Infrastructure/Schedules/ScheduledServiceInvocationDispatchPort.cs`
(one mint per fire, projected to the workflow caller credential).

Broker-issued tokens are deliberately short-lived: NyxID pins `BROKER_ACCESS_TTL_SECS = 300`
(5 minutes) in `backend/src/services/oauth_broker_service.rs`, so a revoked binding stops working
within 5 minutes without resource-server introspection. This is a design decision, not a bug.

**Design consequence.** Everything in a scheduled run that authenticates with the run's caller
credential must finish within ~5 minutes of fire. In a longer run, late NyxID-authenticated steps
failing with `token_expired` is the EXPECTED platform behavior. Author around it: keep scheduled
workflows short, front-load the NyxID-authenticated steps, and split long pipelines into separate
schedules or continuation runs instead of assuming the fire-time credential survives the whole run.

**Token classes are not interchangeable — never quote one class's lifetime for another:**

| Credential | Lifetime | Authority to cite |
|---|---|---|
| Scheduled-run caller credential (broker token-exchange at fire) | 300 s, fixed | NyxID `oauth_broker_service.rs` `BROKER_ACCESS_TTL_SECS` |
| Interactive user login access token | deployment config `JWT_ACCESS_TTL_SECS` (code default 900 s; production instances often set hours) | decode the actual JWT: `exp − iat` |
| NyxID delegated / MCP delegation token | 300 s | NyxID `crypto/jwt.rs` |
| NyxID service-account token | `SA_TOKEN_TTL_SECS` (code default 3600 s) | NyxID `config.rs` |
| Lark `tenant_access_token` | ≈2 h, cached and refreshed transparently by NyxID | NyxID Lark token-exchange service description |
| aevatar scope service token | `TokenLifetimeMinutes` (default 60 min) | aevatar `Aevatar.Authentication.ScopeServiceTokens/ScopeServiceTokenOptions.cs` |

**Anti-hallucination protocol for `token_expired` / 401 in a scheduled run** — complete these steps
before naming any cause:

1. Never assert a token lifetime from memory. Read it: decode the JWT actually in hand
   (`exp − iat`; report only the numbers, never print the token), or cite the owning repo's
   constant from the table above.
2. Identify the token class first. "The access token lives 8 hours" (login class) and "the run
   credential lives 5 minutes" (broker class) can both be true — about different tokens.
   A claim that conflates them is wrong even if each number is right.
3. Correlate failure onset with FIRE TIME, not wall clock. Failures beginning ~5 minutes after
   fire in every run ⇒ the fire-time-minted broker credential aged out. Failures at one fixed
   wall-clock moment across runs ⇒ something else (provider-side expiry or rotation).
4. Separate blast radius. If ALL NyxID-authenticated steps fail after some instant, the run
   caller credential died. If only one step type fails while sibling proxied steps still succeed,
   suspect that step's own credential path instead.
5. Report observed timestamps/status as fact and everything else as labeled inference. Any number
   you did not verify in this session is an inference.

### Long-running task automation playbook

Use this playbook when the user asks for a recurring, scheduled, monitored, or otherwise long-running task instead of a one-off answer. Typical triggers include: "每天...", "每周...", "each week...", "monitor X and tell me...", "定时...", "recurring", "keep watching", and "长期跟踪".

#### Workflow creation semantics

When a Lark user asks to create a workflow that should be runnable, page-visible, or invokable later by workflow id, create or update a Scope Workflow through the available Scope Workflow command tool path. Ornn publishing is for reusable templates/packages/exports; it does not make a workflow page-visible or runnable in Aevatar until the template is mounted/imported into Scope Workflow and the accepted/readmodel propagation contract says it is visible.

1. Recognize the request as automation.
   - Do not answer with a one-shot summary if the user wants repeat runs.
   - Do not ask the user to hand-write the skill package.
   - Treat the future runner as a runnable Ornn skill, not a chat-only script.

2. Reuse before you author — search Ornn first.
   - Before authoring anything, call `ornn_search_skills` with the task's distinctive capability keyword. Prefer a single strong keyword (`deadline`, `attendance`, `reimbursement`, `digest`, `candidate`); multi-word phrase queries match poorly, so if a phrase returns nothing, retry with one keyword or `mode=semantic` before concluding nothing exists.
   - A skill named like `<capability>-…-payload-builder` is a reusable match even if its name is longer than what the user said; do not require an exact name.
   - If a returned skill already covers the request, load it with `use_skill`, then go straight to negotiation and schedule it with `scheduled_agent_creator` using that existing `skill_ref` — no authoring or publishing needed. Do NOT author a duplicate of a skill that already exists.
   - Only author a new skill when the search returns no suitable match.

3. Author a runnable skill package yourself.
   - Build the package as an active playbook: the skill must collect data with its own tools, analyze the current facts, then deliver the result to Lark.
   - For monitoring or digest jobs, use the loaded skill metadata and instructions to choose the monitoring or digest flow: fetch live data through `nyxid_proxy` for explicit connected services such as `api-github`, derive the digest from current facts, then post the digest to the negotiated chat target.
   - Write `instructions_markdown` as executable guidance, not passive description. Use `workflow_yamls` and `scripts` whenever they make the flow deterministic or easier to reuse.
   - Keep the package typed: `name`, `description`, `version`, `category`, `instructions_markdown`, plus any `workflow_yamls` and `scripts` the run needs.

4. Negotiate schedule and output with an interactive Lark card.
   - Use `reply_with_interaction` to ask for the minimum missing details.
   - Ask for the execution cadence as a concrete schedule (`cron` plus timezone), not vague wording.
   - Ask where the result should go: direct message or group chat.
   - Ask for the output format: plain text or Feishu cloud doc.
   - Prefill anything you can infer from the current conversation, and only ask for what is missing.
   - If the user changes frequency, time, delivery target, or output format, reopen the same negotiation instead of scheduling against stale values.

5. Publish the skill, then schedule it.
   - Call `ornn_publish_skill` with the assembled typed package.
   - If publish fails, inspect the diagnostics, fix the package, and retry.
   - Ornn private skill publishing executes directly. Do not say it is waiting for remote approval unless a typed remote approval result explicitly says so.
   - Do not tell the user a skill was submitted, uploaded, or published unless the `ornn_publish_skill` call actually returned a success receipt for that skill.
   - Once the skill is published successfully, call `scheduled_agent_creator` with the published `skill_ref`, the agreed `schedule_cron`, the agreed `schedule_timezone`, and `required_service_slugs` for every connected service slug the skill body will call through `nyxid_proxy`.
   - Carry the negotiated delivery/output choice into the runner's `execution_prompt` and outbound delivery setup; if the chosen delivery target differs from the current conversation, rebind it with `agent_delivery_targets` using the returned `agent_id`.
   - For plain text output, the skill should send a concise digest back to Lark. For Feishu cloud doc output, the skill should create or update a document and return the link.

6. Recover cleanly.
   - Publish failure means the package is wrong; refine and republish.
   - User rejection or edits mean the negotiation is not stable yet; update the card and retry.
   - If the user later wants a different cadence, treat it as a new negotiation for a new schedule rather than pretending the existing schedule changed automatically.

#### agent_builder (Day One persistent automation lifecycle)

`agent_builder` manages the lifecycle of agents the user has already created. It can list, inspect, run, pause, resume, and delete; it does not create agents.

| Intent | Slash command |
|---|---|
| List agents | `/agents` |
| Inspect one agent | `/agent-status <agent_id>` |
| Manual run | `/run-agent <agent_id>` |
| Pause schedule | `/disable-agent <agent_id>` |
| Resume schedule | `/enable-agent <agent_id>` |
| Delete (two-step) | `/delete-agent <agent_id> confirm` |

Tool semantics: `disable_agent` pauses scheduled execution without deleting; `enable_agent` resumes; `delete_agent` disables, revokes the NyxID API key, and tombstones the registry entry. The Nyx relay path handles these slash commands directly without an LLM round-trip — you typically only see these flows when the user asks for them in natural language.
