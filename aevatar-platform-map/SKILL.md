---
name: aevatar-platform-map
description: Entry point, panorama, and router for the entire Aevatar skill family — load this FIRST whenever someone wants to build, run, publish, schedule, externally trigger, or operate anything on Aevatar ("create an agent team", "make a workflow / member", "publish or bind a service", "register it with NyxID", "set up a recurring / cron run", "schedule my team member workflow", "invoke my service"), wants to configure an agent's identity ("create an agent profile", "set my agent's purpose/instructions", "bind a skill to my agent", "limit my agent's tools"), wants to know whether something is even possible ("can Aevatar do X?", "能不能用 aevatar 实现"), or just wants to know what Aevatar can do. It teaches the two independent resource surfaces — build/operate (scope → team → member[workflow|script|gagent] → service → schedule/external trigger) and Agent Profile (ownerHandle/profileSlug → opaque profileId → draft → published snapshot) — NyxID-brokered auth and scope resolution, the two caller modes (client REST vs in-session tools), how to route the three distinct scheduling resources to their right owner, and how to detect a deployment-gated capability before promising it. It routes rather than builds — feasibility-advisor, workflow-authoring, team-builder, service-publisher, scheduler, agent-profile-management, triage, plus probes and the fallback — held together by the `aevatar` tag and published as the versioned `aevatar-platform` Ornn skillset.
version: "1.8"
metadata:
  category: plain
  tag:
    - aevatar
    - control-plane
    - routing
    - nyxid
    - team
    - workflow
    - service
    - schedule
    - agent-profile
    - agent-key
---

# Aevatar control plane — the map

You are the **router and reference** for the Aevatar skill family — you do **not** execute the
work yourself. Your job: orient the agent (object model, auth, caller mode), then hand off to the
*one* companion skill that owns the step the user is on. Read this map first; each spoke is
self-contained, so you can also jump straight in once you know the step.

**What Aevatar is.** A control plane driven entirely over REST at
`https://aevatar-console-backend-api.aevatar.ai`. Everything hangs off your **scope** (your NyxID
subject id), across **two independent resource surfaces**:

```
build & operate :  scope → team → member (workflow | script | gagent) → service → schedule / external trigger
Agent Profile   :  ownerHandle/profileSlug → opaque profileId → draft → published snapshot
```

Most requests walk the first chain. **"Who is this agent and what may it do?"** walks the second —
see *The Agent Profile surface*. They are **not** two phases of one lifecycle: `profileId`,
`workflowId`, `memberId`, `publishedServiceId`, and a conversation actor id are five distinct
identities, and creating a Profile creates no workflow, member, team, service, or schedule.

**Settle four things before you route** (each has a full section below — this is the checklist):
1. **Which surface and which resource owner is this?** Build/operate or Agent Profile — and if it's
   a schedule, *which of the three* scheduling resources owns it (see *Scheduling is three
   resources*). Routing to the wrong owner makes everything downstream wrong.
2. **Is it even feasible?** For anything non-trivial, start with **`aevatar-feasibility-advisor`** —
   it says whether the goal is possible and what must be in place first (which NyxID connector to
   configure, what's host-gated, what's simply not deployed, what's impossible + the alternative).
   Don't build something that can't ship.
3. **Which caller mode are you in?** A plain-REST **client** holding a NyxID bearer, or the model
   running **in-session** with server-side tools? Only `aevatar-workflow-authoring` needs the
   server-side tools; everything else is REST either way. See *Two caller modes*.
4. **Carry the honesty rules** into every hand-off — you make real HTTP calls (no magic
   server-side action), most steps are async (read state back, never trust a bare 2xx), and NyxID
   registration is host-gated. See *Honesty rules*.

Then match the user's words to a step in the router below, load that skill, and don't reinvent what
a spoke already owns.

## The object model (one picture)

```
scope  (= your NyxID subject id; your private workspace; everything hangs off it)
  ├── team       a group of members with one "entry member" as its front door
  │     └── member   a callable unit; its implementation is ONE of:
  │            • workflow   (a YAML pipeline of roles + steps)   ← most common
  │            • script     (an app script)
  │            • gagent     (a hosted agent actor)
  ├── service    a member/team published so it can be invoked + (host-gated) registered to NyxID
  ├── schedule   fires a service on a cron, authenticated as you (NyxID)
  └── external trigger  Lark Base / webhook / external cron calls the service invoke path
```

The lifecycle the user almost always wants:
**author a workflow → wrap it in a member → group members into a team → publish as a
service (register to NyxID) → schedule it.**

## The Agent Profile surface (separate from everything above)

An **Agent Profile** defines an agent's *identity and authority ceiling*: display name, purpose,
instructions, an ordered set of **exact** Ornn skill bindings (`{skillGuid, literalVersion,
expectedName, expectedPublisherId}` — never a name, never `latest`), and the **maximum** tool
policy any turn may hold. It has its own lifecycle — `create → get (strong ETag) → mutate draft /
skill bindings → validate → publish snapshot → reread` — and its own concurrency protocol.

Route **all** of it to **`aevatar-agent-profile-management`**: creating or editing a profile,
setting purpose/instructions, binding skills, choosing `ALWAYS` / `ROUTED` /
`DEFAULT_FOR_UNMATCHED_TURN` activation, defining tool ceilings, validating, publishing, or
explaining a profile ETag / validation / publication / binding behavior. Do **not** improvise it
from the team/member/service routes.

**It is deployment-gated — detect before you promise.** Profile management ships in the codebase
but a given deployment may not expose it. Before any profile work: in-session, require the exact
`agent_profiles` tool in your tool list; as a REST client, require the **complete**
`agent-profiles` route family in `GET /api/openapi.json` (a single route, or a 404 on one profile,
proves nothing). If absent, say the deployment does not expose Agent Profile management and
**stop** — never substitute a workflow/member/service to look like you succeeded.

Two honesty facts to carry: **publication is not runtime binding** (a published profile binds only
to *newly created* NyxID direct conversations admitted by a **host-owned** rollout — existing
conversations never hot-upgrade), and **workflows, teams, services, schedules, channels, and
AgentRuns are not profile consumers.**

## Scheduling is three resources, not one

"Run it on a schedule" has three different owners. Route by **who owns the thing being run**, not
by whichever API you already know:

| Scheduling… | Owner | Canonical entry | Credential |
|---|---|---|---|
| An already-bound **Studio Team member** workflow | `scope → team → member` | `aevatar_schedule_member_workflow`, or `/api/scopes/{scopeId}/teams/{teamId}/members/{memberId}/automations` | Dedicated **Agent Key** |
| An independent **scheduled Ornn skill agent** or **one-shot reminder** | Scheduled agent / catalog actors | `scheduled_agent_creator`, then `agent_builder` | Dedicated **Agent Key** |
| A **raw service invocation or actor envelope** | Generic platform schedule actor | Generic `/api/schedules` | Typed source; may be a NyxID binding exchange |

Generic `/api/schedules` remains supported, but it is **not** the canonical path for a Team member
automation and must not be used as a fallback when the owner is a Team member. `aevatar-scheduler`
owns the member-automation and generic paths; `aevatar-automation` owns the scheduled skill agent.

Never convert between identities by route position, prefix, equality, or a familiar-looking string.
`memberId`, draft `workflowId`, `publishedServiceId`, UserService ID, catalog service ID, schedule
ID, Agent Key ID, and `profileId` are all distinct.

## Authenticate (every request)

Drive aevatar **through the NyxID broker** — it forwards your identity **and injects the
`scope_id` claim** that aevatar's backend needs. This is the load-bearing detail: sending a raw
NyxID token straight to `https://aevatar-console-backend-api.aevatar.ai` authenticates but resolves
**no scope** (`scopeResolved:false`, `scopeId:null`), so every studio resource under
`/api/scopes/{scopeId}/…` is unreachable and workflow/team creation fails silently. Always go
through the broker:

- **Prerequisite (once):** the `aevatar` service must be connected in NyxID. Verify with
  `nyxid proxy discover | grep aevatar`; if absent, `nyxid service add aevatar` (no credential —
  it is an admin-mode system service that resolves the caller via NyxID `/me`).
- **Every call is** `nyxid proxy request aevatar "<path>" [-m POST -d '<json>']`. NyxID injects the
  bearer **and** the scope claim; you never read or send the token yourself. (The broker forwards to
  base URL `https://aevatar-console-backend-api.aevatar.ai`; you only ever pass the `<path>`.)
- **Resolve your scope once** — `scopeId` is your NyxID subject id:
  ```bash
  scopeId=$(nyxid proxy request aevatar "api/studio/context" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["scopeId"])')
  ```
  (`api/auth/me` and `api/workflow/observatory/me` also return `scopeId`.) **If `scopeId` comes back
  null / `scopeResolved:false`, you are not going through the broker — fix the transport, do not
  proceed**: nothing under `/api/scopes/{scopeId}/…` will work.
- All studio resources live under `api/scopes/{scopeId}/…`. Account-level service and schedule
  management live under `api/services` and `api/schedules`. Pass these as the `<path>` to
  `nyxid proxy request aevatar`.

**In-session / platform mode:** if you are the model running *inside* an aevatar session with the
nyxid MCP connected, you instead have server-side tools (`aevatar_start_workflow`, `use_skill`,
`nyxid_services`, …) that already run inside your resolved scope — see *Two caller modes*. Reserve
the raw-token-to-backend call only for environments where neither the `nyxid` CLI nor those tools
exist, and expect to handle scope resolution yourself.

## Two caller modes (this matters for the workflow skill)

Most of this family is **plain REST you call as a client** through the NyxID broker above
(`nyxid proxy request aevatar "<path>"`) — that is the
default assumption here and in `team-builder` / `service-publisher` / `scheduler`. The one
exception is **`aevatar-workflow-authoring`**, written for the model running *inside* an aevatar
session with the nyxid MCP connected, where it uses the **server-side tools**
`aevatar_start_workflow` / `ornn_publish_skill` / `use_skill` / `nyxid_services`. If you are an
external client **without** those tools, that skill also documents a full **client REST path**:
dry-run a workflow with `POST /api/scopes/{scopeId}/workflow/draft-run` (body
`{prompt, workflowYamls:[…]}`), and publish the workflow skill to ornn by POSTing a zip to
`…/api/v1/proxy/s/ornn-api/api/v1/skills` (with the workflow YAML under `assets/`). Pick whichever
surface your tool list actually supports — do not try to call the server-side tools as HTTP
endpoints (they are not).

## Which skill for which task (router)

| You want to… | Use the skill | Key endpoints |
|---|---|---|
| **Decide if a goal is even possible** + what must be in place first (use FIRST, before building) | `aevatar-feasibility-advisor` | read-only `GET /api/v1/services`, `GET /api/v1/catalog` (NyxID) |
| **Triage a failure** — is it an aevatar / nyxid / ornn problem? read the code, then file an issue or get authoritative usage guidance (use AFTER something breaks) | `aevatar-triage` | reads repos via `gh` or `nyxid_proxy` `api-github`; `gh issue` |
| Define **who an agent is** — purpose, instructions, exact skill bindings, activation mode, tool ceiling; validate/publish a profile | `aevatar-agent-profile-management` | `/api/scopes/{id}/agent-profiles/*` (`:validate`, `:publish`), `GET /api/agent-profiles/{ownerHandle}/{profileSlug}`, or the in-session `agent_profiles` tool — **detect the surface first** |
| Turn an idea into a runnable **workflow YAML** | `aevatar-workflow-authoring` | server-side tools `aevatar_start_workflow`/`ornn_publish_skill`, **or** client REST `…/workflow/draft-run` + ornn zip publish (see *Two caller modes*) |
| Create a **team**, create **members** (workflow/script/gagent), bind them, set the entry member | `aevatar-team-builder` | `/api/scopes/{id}/teams`, `/members`, `/members/{id}/binding` |
| **Publish** a member/team **as a service** and **register it to NyxID**; verify it | `aevatar-service-publisher` | `/api/scopes/{id}/binding`, `/api/services/*`, `/members/{id}/published-service` |
| Run a **Team member workflow** on a schedule (dedicated Agent Key) | `aevatar-scheduler` | `aevatar_schedule_member_workflow` / `/api/scopes/{id}/teams/{teamId}/members/{memberId}/automations` |
| Run an independent **scheduled skill agent** or one-shot reminder | `aevatar-automation` | `scheduled_agent_creator`, then `agent_builder` |
| Run a **raw service invocation** on a cron (generic platform schedule) | `aevatar-scheduler` | `/api/schedules`, `:run-now`, `:enable`, `:disable` |
| Trigger an existing workflow from an external HTTP sender such as **Lark Base** | `aevatar-feasibility-advisor` first, then `aevatar-service-publisher` | NyxID `/api/v1/proxy/s/aevatar/api/scopes/{scopeId}/members/{memberId}/invoke/...`, host-managed `/api/workflow-webhooks/{routeKey}` if configured |
| **Invoke**, watch **runs**, observe | (this map + service-publisher's invoke section) | `/invoke/{endpointId}`, `/runs/*`, `/api/workflow/observatory/*` |

If a companion skill is not already loaded, find it with an ornn skill search for the
capability (e.g. "aevatar team builder", "aevatar service publisher", "aevatar
scheduler"), then load it. None of them depend on this map at run time — they restate the
minimal bootstrap above.

## The full aevatar skill collection

The family is published as a real, versioned Ornn **skillset**, `aevatar-platform`, whose
immutable revisions pin each member to an exact literal version — and it is *also* held together
by the shared **`aevatar` tag**, so an ornn skill search for **`aevatar`** still returns the set.
Load whichever member you need with `use_skill`. This map is the canonical entry point; the rest
are pulled on demand. (Note the skillset is a *routing* collection — it is **not** the trust
closure of a published Agent Profile, which pins its own exact skill GUIDs and is sealed
server-side at publish time.)

**Scope first — feasibility** (`category: plain`, public)
- `aevatar-feasibility-advisor` — *use before building*: is the goal possible, what are its
  prerequisites (which NyxID connector to configure, what's host-gated), and what's impossible
  + the alternative. Teaches the connector-vs-channel split and the prerequisite matrix.

**Define the agent — Agent Profile** (`category: plain`, public)
- `aevatar-agent-profile-management` — the profile resource surface: purpose, instructions,
  exact Ornn skill bindings, activation modes, tool ceilings, strong-ETag mutation, validate,
  publish. Teaches capability detection first, and that publication is not runtime binding.

**Diagnose & report — triage** (`category: plain`)
- `aevatar-triage` — *use after something breaks*: attribute a failure across aevatar / NyxID /
  Ornn, read the layer's real code for a code-grounded root cause, then file a GitHub issue
  (confirmation-gated) for a genuine platform defect, or give authoritative, code-grounded usage
  guidance for a misuse. The after-it-breaks counterpart to `aevatar-feasibility-advisor`.

**Build & operate — the control-plane family** (client REST, `category: plain`, public)
- `aevatar-platform-map` — *this map*: object model, auth + scope bootstrap, routing.
- `aevatar-team-builder` — create teams; create + bind members (workflow/script/gagent); set the entry member.
- `aevatar-service-publisher` — publish a member/team/workflow as a service; verify NyxID registration; invoke.
- `aevatar-scheduler` — Team member automations (dedicated Agent Key) and generic platform cron schedules.

**Author a workflow** (`category: tool-based`, public)
- `aevatar-workflow-authoring` — turn a request into a validated, persisted workflow YAML
  (server-side `aevatar_start_workflow` / `ornn_publish_skill`, **or** the client REST path —
  `draft-run` + ornn zip publish — see *Two caller modes* above). Its output is the workflow
  a `team-builder` member binds or a `service-publisher` scope binding publishes.

**Diagnose — capability probes** (`category: plain`; currently private/owner-only)
- `aevatar-capability-probe`, `aevatar-workflow-engine-probe`, `aevatar-scripting-probe`,
  `aevatar-vision-probe`, `aevatar-attachment-probe`, `aevatar-file-extract-probe` —
  small self-tests that check whether a given platform capability is available in the
  current scope before you depend on it.

**Safety net — cross-cutting** (`category: plain`, public)
- `fallback-to-calling-agent` — when you genuinely cannot finish a request server-side,
  hand the original problem back to the calling agent instead of failing opaquely. Generic
  (no `aevatar` tag), but part of how this family degrades safely.

## The golden path, end to end

This is the **build/operate** path. Agent Profile work does not enter it at any step — it has its
own lifecycle in `aevatar-agent-profile-management`.

0. **Scope check (do this first)** — confirm the goal is feasible and collect its
   prerequisites (connectors to configure, host-gated pieces, hard limits) —
   `aevatar-feasibility-advisor`. Skip only when the ask is obviously in-scope.
1. **Author** the workflow YAML — `aevatar-workflow-authoring`.
2. **Create team** — `POST /api/scopes/{scopeId}/teams {displayName}`.
3. **Create + bind a workflow member** — `POST /api/scopes/{scopeId}/members`, then
   `PUT /api/scopes/{scopeId}/members/{memberId}/binding` (carries the YAML). The bind is
   async; wait for its binding run to reach `succeeded`. — `aevatar-team-builder`.
4. **Set the team entry member** — `PUT /api/scopes/{scopeId}/teams/{teamId}/entry-member {memberId}`.
5. **Publish as a service + register to NyxID**, then verify the NyxID slug —
   `aevatar-service-publisher`.
6. **Schedule** it on a cron, authenticated as the scope owner — `aevatar-scheduler`; or
   trigger it from an external HTTP system such as Lark Base by calling NyxID's `aevatar`
   proxy with a NyxID API key — `aevatar-service-publisher`.

## Honesty rules (so you never over-promise)

- **You are a client.** Everything here is plain REST you call with the user's NyxID
  bearer token. There is no server-side tool that creates teams/members/services for you —
  you make the HTTP calls.
- **NyxID registration is host-gated.** Publishing a service only results in a NyxID
  connector if the platform host has external exposure enabled (and the service is in
  scope of that policy). You drive publish + verify; you cannot force registration on. If
  the service's `externalExposure` block stays empty, say so: the service is still usable
  in-scope, just not exposed as a NyxID-brokered connector. (Details in
  `aevatar-service-publisher`.)
- **External HTTP trigger is different from externalExposure.** Lark Base / external cron /
  webhook senders can often trigger an existing member/team by calling the NyxID proxy for
  `aevatar` with a NyxID API key and an explicit scope path. Host externalExposure is only
  for turning the Aevatar service itself into a reusable NyxID connector/slug.
- **Many steps are async, and `202` is admission only.** Bindings, deployments, runs, Agent Key
  provisioning, and Profile mutations all settle over time. A `202 Accepted` never proves commit,
  credential issuance, vault write, projection visibility, publication, cron fire, or success —
  read state back (binding run status, a newer authoritative `stateVersion`, invocation readiness,
  run timeline) instead of trusting a bare 2xx.
- **Detect deployment-gated capabilities.** Agent Profile management exists in the codebase but
  may not be exposed by the running deployment. Probe the surface (tool list, or the complete
  route family in `GET /api/openapi.json`) before promising it — and report its absence honestly
  instead of building a different resource.
- **Never hand out or ask for secret material.** Agent Keys are vault-held; skills expose only
  typed references, key IDs, expiry, authorization facts, and generation. Never ask a user to paste
  a key, and never print tokens, vault references, ciphertext, or permission digests.
- **Never fabricate ids.** Always use the ids returned by the create/bind responses. Never treat
  `profileId`, `workflowId`, `memberId`, `publishedServiceId`, a UserService ID, a catalog service
  ID, a schedule ID, an Agent Key ID, or a conversation actor id as interchangeable, and never
  parse an opaque id for meaning.

## If you get stuck

If after a genuine attempt you cannot complete the request server-side (missing
capability, a hard failure, or something that needs the caller's local environment), hand
the original request back to your caller cleanly rather than failing opaquely — see the
fallback skill in this family.
