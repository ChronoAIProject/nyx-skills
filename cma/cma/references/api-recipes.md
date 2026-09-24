# CMA public API recipes

These recipes describe the user-facing contract reviewed on 2026-09-24. Resolve
exact schemas from `/openapi.json` on the target deployment. Specialized
supplemental routes, including browser authentication and approved artifacts,
also exist outside the generated operation inventory; use their documented
contracts and discovery rather than inventing paths.

## Authentication and initial discovery

Use an ordinary, valid NyxID user access token made available through the host's
approved credential mechanism. `CMA_BASE_URL` below is either the direct API or
NyxID proxy origin plus `/api/v1/proxy/s/cma`. `NYXID_USER_ACCESS_TOKEN` is an
example environment variable, not a request to obtain or print a secret.

```bash
curl --fail-with-body \
  -H "Authorization: Bearer ${NYXID_USER_ACCESS_TOKEN}" \
  https://nyx-api.chrono-ai.fun/api/v1/keys

curl --fail-with-body \
  -H "Authorization: Bearer ${NYXID_USER_ACCESS_TOKEN}" \
  "${CMA_BASE_URL}/api/v1/defaults"

curl --fail-with-body \
  -H "Authorization: Bearer ${NYXID_USER_ACCESS_TOKEN}" \
  "${CMA_BASE_URL}/api/v1/sandboxes"
```

Never include shell tracing when handling credentials. Retain only sanitized
status, resource IDs, request IDs and relevant error codes in reports.

Browser authentication uses CMA's own `/auth/login`, `/auth/callback`,
`/auth/session` and `/auth/logout` flow. Do not automate an OAuth callback or
turn a browser cookie into a general proxy credential. New Sandbox provisioning
requires the same owner's renewable CMA login as well as permission to create.
Browser connection assistance uses `/auth/connections/check`, `/start` and
`/cancel`; these are cookie-authenticated browser routes, not general bearer API
recipes. Public REST connection handoffs use `/api/v1/service-connections`.

## Resource discovery and selection

| Task | Read |
| --- | --- |
| Exact platform default profile references | `GET /api/v1/defaults` |
| Personal Sandboxes | `GET /api/v1/sandboxes` |
| Current organization choices | `GET /api/v1/organizations` |
| Shared Sandbox inventory | `GET /api/v1/sandboxes?shared=true` |
| One organization's Sandbox inventory | `GET /api/v1/sandboxes?organization={id}` |
| Personal or organization Agents | `GET /api/v1/agents`, optionally `organization={id}` |
| Incoming shared Agents, including narrow shares | `GET /api/v1/agents/provenance?shared=true` |
| Current resource authority | `GET /api/v1/resource-access/{kind}/{id}`, with kind `agent` or `sandbox` |
| Sandbox's Workspaces | `GET /api/v1/sandboxes/{id}/workspaces` |
| Workspace's Worktrees | `GET /api/v1/workspaces/{id}/worktrees` |

Do not combine `shared=true` and `organization`. Continue pages until the
returned continuation is absent, including empty filtered pages with a cursor.
Do not use an Agent-only grant to query hidden parent IDs. A `404` can mean the
resource is unavailable to the caller, not necessarily that it was deleted.

## Create an environment

1. Resolve owned/public published profiles or read `/api/v1/defaults`. Inspect
   nested profile content, service requirements, quotas and any trust disclosure.
2. Check whether the intended Sandbox, Workspace or Agent already exists. A
   Sandbox Profile may already include Workspaces and their Agents; read what
   provisioning created before adding children.
3. If a new Sandbox is needed, send `POST /api/v1/sandboxes` with an
   `Idempotency-Key` and `{ "sandbox_profile": { "id": "<selected id>",
   "revision": 1 }, "name": "<user's name>" }`. The revision is the actual
   selected published revision, not always 1. Supply `trust_confirmed` and the
   server's `commands_digest` only when required and approved.
4. Observe `GET /api/v1/sandboxes/{id}` and `/events`. Wait for a usable
   environment; creation acceptance does not prove readiness.
5. If needed, `POST /api/v1/sandboxes/{id}/workspaces` with
   `{ "workspace_profile": { "id": "<selected id>", "revision": 1 } }`,
   plus the required approved trust evidence. Retain its own idempotency key.
6. In the ready Workspace, `POST /api/v1/workspaces/{id}/agents` with
   `{ "agent_profile": { "id": "<selected id>", "revision": 1 },
   "title": "<task title>", "first_message": "<authorized task>" }`.
   `first_message` is optional. CMA reserves the Worktree and Agent together.
7. Follow the Agent state and first-message outcome. If creation included the
   first message, do not submit it again as a separate input.

There is no independent Worktree-create operation. Use the returned hierarchy;
do not reconstruct paths or branch names. Missing connections require the owner
to complete the supported handoff and a fresh server check, not another Sandbox.

## Send a conversation turn and recover it

For a new client, use the Responses v2 contract with an existing authorized
Agent. Read `/api/v2` for the supported subset. Retain `CMA_COMMAND_KEY` before
the first attempt and keep it with the exact request.

```bash
curl --fail-with-body --no-buffer \
  -H "Authorization: Bearer ${NYXID_USER_ACCESS_TOKEN}" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: ${CMA_COMMAND_KEY}" \
  --data-binary @request.json \
  "${CMA_BASE_URL}/api/v2/responses"
```

`request.json` contains no credential:

```json
{
  "conversation": "<existing authorized Agent ID>",
  "input": "<the user's requested task>",
  "stream": true
}
```

The Agent Profile controls execution configuration. Do not add `instructions`,
`tools`, `reasoning`, media parts or a nonnull `previous_response_id`. A supplied
model must agree with the profile. `stream` must be `true`.

Read the returned response and command identities. `200 text/event-stream`
means admission, not successful completion. Poll `GET /api/v2/responses/{id}`
or `GET /api/v2/commands/{id}` when needed. Recover output through
`GET /api/v2/responses/{id}/events` with `starting_after` or `Last-Event-ID`.
Use only that stream's acknowledged durable cursor. Live fragments are not
durable, and reconnecting does not recreate them.

For rich Agent replay, use `GET /api/v2/agents/{id}/events/snapshot`, then the
Agent `/events` stream and its `after_cursor`. Responses event sequence numbers,
Agent cursors, Sandbox sequences and Launch cursors are different contracts.
Bound replay observation by time/bytes; a transport failure does not prove turn
failure. Inspect current state instead of repeatedly replaying large histories.

AG-UI is also supported: `POST /api/v1/agui/run` uses `threadId=AgentId` and its
own documented input shape. Do not mix v1 and v2 continuation rules. The simpler
REST `POST /api/v1/agents/{id}/input` accepts `{ "text": "..." }` and returns
queued acceptance; use a separate event read for output.

For response-targeted steering, cancellation and approval, read then submit the
v2 response `/controls` contract with the returned identity and revision. For a
queued but unbound turn use `/queued-cancellation`. REST `/steer`, `/interrupt`
and `/approvals/{request_id}` remain supported for their active-turn semantics.
Do not invent an approval, answer an old request, or cancel a later turn.

## Profiles, marketplace and Event Worker Profiles

The three profile collections are `/api/v1/agent-profiles`,
`/api/v1/workspace-profiles` and `/api/v1/sandbox-profiles`.

| Intent | Request shape |
| --- | --- |
| Create a draft | `POST` collection with `{name, description?, content}` and an idempotency key |
| Save | `PUT /{id}` with `{draft_version, content, name?, description?}` |
| Publish an immutable revision | `POST /{id}/revisions` with `{draft_version}` |
| Discover revisions | `GET /{id}/revisions` and `GET /{id}/revisions/{revision}` |
| Change discovery visibility | `PUT /{id}/visibility` with `{visibility:"public"}` or `"private"` |
| Retire | `POST /{id}/retire`; existing pinned instances retain their configuration |

Use the mutation keys specified by the live schema. Author Agent Profiles first,
then Workspaces that reference their published revisions, then Sandboxes that
reference published Workspaces. Use `/api/v1/profile-authoring/bounds`,
`/services` and `/skills` for selectable resources, services and exact Ornn skill
versions. Resolve public repositories with
`POST /api/v1/profile-authoring/repositories/resolve` and `{url, reference?}`.

Marketplace list paths use `sandbox-profiles`, `workspace-profiles` and
`agent-profiles`. Marketplace detail/fork routes use the schema's singular
`kind`: `sandbox`, `workspace`, or `agent`. Inspect the returned operation
before forking; a fork creates a caller-owned draft with provenance.

Sandbox availability is a separate mutable policy accepted by Sandbox Profile
creation/update: `availability` has `warmup_enabled`, `warmup_count` (1–5), and
`always_keep_alive`. Warmup requires a published public profile. It does not
guarantee immediate capacity. Always keep alive affects existing and new
Sandboxes from that profile; it still permits explicit manual pause.

Create an Event Worker Profile using `POST /api/v1/event-worker-profiles`, an
idempotency key and:

```json
{
  "name": "<worker name>",
  "description": "<worker purpose>",
  "sandbox_profile": { "id": "<published Sandbox Profile>", "revision": 1 },
  "workspace_profile": { "id": "<published Workspace Profile>", "revision": 1 },
  "agent_profile": { "id": "<published Agent Profile>", "revision": 1 }
}
```

Use the chosen revisions. Creation directly produces revision 1 of the worker
record; it does not have the three base profiles' draft/publish cycle. Its
response contains `source` and the complete composed `profile`. Updates use
`{expected_revision, source}`; retirement is `DELETE /{id}?expected_revision=n`.
Existing Bots keep their pinned worker configuration.

## Bot, Trigger, sharing and lifecycle routes

| Workflow | Starting operations and constraints |
| --- | --- |
| Telegram Bot | `GET /api/v1/bots/nyxid-bots`; select an active owned NyxID Telegram bot, then `POST /api/v1/bots`. Read its exact schema for `profile`, optional environment/worker references, `admission` and `reply`. Follow `GET /api/v1/bots/{bot_id}` until active. |
| Bot operations | `POST /api/v1/bots/{bot_id}/test`, `/disable`, `/enable`, `/rotate-keys`; `DELETE /api/v1/bots/{bot_id}`. Synthetic test does not send a chat message, but can run provider work. |
| Trigger publisher | `POST /api/v1/triggers`; version-checked `PUT /{id}`; `POST /{id}/publish`; placements, `/embed` and `/stats`; `/retire`. All writes keep their own idempotency key. |
| Trigger visitor | Public preview, then authenticated `POST /api/v1/triggers/public/{public_id}/launches`; inspect requirements and follow `/api/v1/launches/{id}`. Start with the Launch's exact consent/trust evidence when required. Navigation alone is not consent. |
| Sharing | Read `/api/v1/resource-access/{kind}/{id}` and `/api/v1/resource-shares/{kind}/{id}`. Create with `{target_org_id, mode:"view"}` or `"org_roles"`; update/revoke with current revision and a retained key. |
| Sandbox pause/revive | Owner routes `/api/v1/sandboxes/{id}/pause` and `/revive`, or durable `/commands` with `{command, expected_revision}`. Poll the command receipt and actual Sandbox state separately. |
| Agent stop/delete | `POST /api/v1/agents/{id}/stop` with `{}`; `DELETE /api/v1/agents/{id}`. Stopping retains history; deletion also cleans up the dedicated Worktree/home. |
| Workspace/Sandbox removal | Use their public `DELETE` operations with keys. Observe cleanup; never delete storage or records directly. |

For exact UI and user intent flows, read [user journeys](user-journeys.md).

## Refusals and verification boundary

| Result | Next action |
| --- | --- |
| `401` | Determine expired/invalid versus unsupported credential. Refresh through the approved login path; an agent key does not become a supported user token by retrying. |
| `403` | Check the caller's named capability and current resource access. Do not borrow stronger credentials. |
| `404` | Recheck selected identity and scope; absent and inaccessible resources can be intentionally indistinguishable. |
| `409` | Preserve uncertain-command keys; inspect current resource/revision or recover the original receipt. Reconcile before a new intent. |
| `429` | Read its code and `Retry-After`; capacity and temporarily unready conversations are different conditions. |
| `503` | Treat authorization/dependency state as unavailable; retain IDs and keys, retry within a reasonable bound, then report the actual blocker. |

Production evidence on 2026-09-24 covers direct/proxy equivalence for ordinary
user-token resource reads, repository-resolution POST, validation/refusal
responses and a bounded Agent SSE observation. One earlier full-history replay
returned 503 both directly and through the proxy. It does not prove every
mutation or every non-admin permission tier against production. Ordinary scoped
agent keys were tested and refused; the temporary test credential was revoked.
