---
name: aevatar-triage
description: Use AFTER something goes wrong while using Aevatar — a user hits an error, failure, or confusing behavior and you must find whether it lives in Aevatar, NyxID, or Ornn, then act. Triggers - "aevatar is erroring", "why did my workflow fail", "my bot does not reply", "connector 401/403", "skill will not pull or upload", "is this an aevatar, nyxid, or ornn bug", "file an issue", "am I using this right". It makes you attribute the failure to the right layer by tracing the request path, pull that layer's real public source for a code-grounded root cause citing file and line, then branch - draft and, only on explicit user confirmation, file a precise GitHub issue when behavior violates the layer's published contract, or explain the correct usage from the code when it is a usage mistake. The after-it-breaks counterpart to aevatar-feasibility-advisor; never auto-files, de-dups first, never claims a root cause without a code citation. Works locally (git + gh) and server-side (nyxid_proxy + api-github).
version: "1.0"
metadata:
  category: plain
  tag:
    - aevatar
    - triage
    - diagnostics
    - debugging
    - root-cause
    - issue
    - nyxid
    - ornn
    - support
---

# Aevatar triage — find the layer, read the code, then report or guide

Something broke (or looks wrong) while using Aevatar. Your job is three honest moves:
**(1) attribute** the failure to the right layer — **Aevatar / NyxID / Ornn** — by tracing the
request path; **(2) read the real code** of that layer until you have a **code-grounded root
cause** (cite `path:line`); **(3) branch**: if it is a genuine **platform defect** (behavior that
violates the layer's *own published contract*), draft and — only on explicit user confirmation —
**file a GitHub issue** to the owning repo; if it is a **usage / config mistake**, give the user an
**authoritative, code-grounded explanation and the correct usage**. This is the *after-it-breaks*
counterpart to `aevatar-feasibility-advisor` (which answers "is it possible, before building").

You make real calls and read real code — **no guessing, no fabricated root cause, no auto-filing.**

## The three layers (and their repos — all public)

| Layer | Repo (stack) | Owns | Canonical symptoms |
|---|---|---|---|
| **Aevatar** | `aevatarAI/aevatar` (C#/.NET) | agent runtime + tool execution, workflow engine, channels, CQRS/projection + readmodels, control-plane REST, scheduler validation | workflow validate / draft-run / run failures, member-team-service binding stuck (async never `succeeded`), the **aevatar side** of a channel bot, stale readmodel / observatory, control-plane 4xx/5xx |
| **NyxID** | `ChronoAIProject/NyxID` (Rust) | credential-broker gateway: proxy + credential injection, OAuth/OIDC/PKCE/MFA, connector vault, NAT relay + SSH, approvals, MCP-from-OpenAPI | `nyxid_proxy` 401/403, "credential not found", connector/slug missing, OAuth/token/MFA failures, **inbound relay not delivering**, approval stuck |
| **Ornn** | `ChronoAIProject/Ornn` (TS/Node) | skills-as-a-service registry: skill search/pull/upload/generate, skillsets, sandbox | skill not found / search / pull / upload fails, `use_skill` cannot find a skill, skillset integrity, generate (SSE) errors |

These three repos and layers are this skill's subject — name them freely. Do **not** hardcode any
user's private business / workflow / skill names.

## Step 1 — Capture the symptom precisely (don't theorize yet)

Collect, verbatim where possible: the **exact error text**; the **operation / surface** (workflow
run, connector call, channel bot, schedule, skill pull/publish, auth, a control-plane REST call);
**minimal repro**; and the **ids** that let you correlate — `run_id`, `scopeId`, connector `slug`,
skill name, `commandId`/`correlationId`, timestamps. Missing ids are themselves a finding.

## Step 2 — Attribute to a layer (trace the request path, eliminate)

**Main rule: follow the request path and find the *first boundary* that breaks.** A user request
typically flows `your agent -> Aevatar runtime -> NyxID proxy -> third-party`, and skills flow
`Aevatar use_skill -> Ornn`. Map the symptom to where that chain first fails:

| Symptom | Most likely layer | Disambiguating evidence to gather |
|---|---|---|
| `401` / `403` on a connector/tool call | **NyxID** (auth/vault) | is the `slug` in `GET {NYX}/api/v1/services`? token expired? OAuth scope present? |
| "credential not found" / connector slug missing | **NyxID** (vault / not connected) | catalog vs services; was it ever connected for *this* identity? |
| `404` on a thing you reference | **whichever registry owns it** | skill -> Ornn; connector/service -> NyxID; team/member/scope -> Aevatar |
| `502` / timeout on an external call | **proxy chain** | which hop? Aevatar tool layer vs NyxID proxy vs the target itself |
| workflow won't validate / run stalls / binding never `succeeded` | **Aevatar** (engine/runtime) | draft-run error body; run timeline / observatory; binding-run status |
| readmodel stale / observatory missing data | **Aevatar** (projection) | is the projection subscription live? event stream flowing? authoritative version vs readmodel |
| **inbound bot doesn't reply** (Lark/Telegram) | **cross-layer — walk it** | did NyxID relay webhook fire? is the bot connector connected? did the Aevatar channel run start (observatory)? credential = the *sender's* NyxID, present? |
| approval prompt stuck | **NyxID approvals + Aevatar suspension** | NyxID approval request id; Aevatar workflow wait/suspend state |
| skill search/pull/upload/generate fails | **Ornn** | which `/api/v1/skill...` route? validator violations? version format? |

**Do not stop at the first match.** Gather the disambiguating evidence and *eliminate* — a plausible
first guess that you haven't excluded the alternatives for is not an attribution.

## Step 3 — Pull the repo and reach a code-grounded root cause

Get the suspected layer's real source (paths below) and read until you can point at the code that
produces the behavior. **Anchors are subsystem/directory altitude — confirm exact files by reading;
the tree evolves.**

- **Aevatar** (`aevatarAI/aevatar`): tool execution + LLM dispatch in `src/Aevatar.AI.Core`;
  connector adapters in `src/Aevatar.AI.ToolProviders.*` (incl. NyxId, Ornn); readmodels in
  `src/Aevatar.CQRS.Projection.*`; engine + HTTP/OpenAPI in `src/workflow/`; **contract** in
  `src/Aevatar.AI.Abstractions` + `docs/canon/`; errors as workflow exceptions + control-plane 4xx/5xx.
- **NyxID** (`ChronoAIProject/NyxID`): endpoint handlers in `backend/src/handlers/` (proxy, auth,
  oauth, approvals, mcp, node/ssh); vault logic in `backend/src/services/`; **all error variants +
  numeric codes in `backend/src/errors/`** (observed ranges — confirm: ~2000 auth, ~3000 approval,
  ~4000 ssh, ~5000 service, ~8000 credential-node); **contract** in `backend/src/api_docs.rs`
  (OpenAPI) + `README.md`.
- **Ornn** (`ChronoAIProject/Ornn`): registry + skillsets in `ornn-api/src/domains/`; NyxID/sandbox
  integration in `ornn-api/src/clients/`; **global error handler in `ornn-api/src/middleware/`**;
  **contract** in `ornn-api/src/openapi/` + `README.md`.

**Discipline:** the root-cause claim must cite `repo path:line` (+ commit/ref you read). **No
citation -> no verdict** — downgrade to *inconclusive* (Step 4c). Never fabricate a path, a line, a
version, or a slug.

**The contract test (this decides the branch):** does the layer's *current behavior* violate its
**own published contract** (README / OpenAPI / proto / `docs/canon`)? **Yes -> defect** (Step 4a).
**No** — the contract says it should behave this way and we drove it wrong **-> usage** (Step 4b).

## Step 4 — Branch on the verdict

### 4a. Platform defect -> file an issue (confirmation-gated)

1. **De-dup first.** Search existing issues (open *and* closed) on the owning repo before drafting.
   If one exists, point the user to it — do not file a duplicate.
2. **Draft** with this shape:
   - **Title:** `[<layer>] <one-line symptom>`
   - **Body:** environment + version/commit; minimal repro steps; **expected vs actual**; the
     offending **`path:line`** and why it violates the published contract; correlation ids / logs.
3. **Show the user the draft. File only on an explicit "yes."** Route to the **owning repo**
   (`aevatarAI/aevatar` | `ChronoAIProject/NyxID` | `ChronoAIProject/Ornn`). If the cause spans
   layers, file in the layer that first breaks the contract and **cross-link** the others.
4. The bar for an external-repo issue is **"behavior violates its published contract"** — not "we
   wish it worked differently." If it's a feature gap, say so; don't file a defect.

### 4b. Usage / config mistake -> authoritative guidance (no issue)

Explain **grounded in the code/contract you just read** — *why* it behaves this way and *what the
correct usage is* — not generic advice. Then point the user at the right next step **generically**
(e.g. "author the workflow", "publish the service", "connect the connector in NyxID", "check
feasibility first") and hand off to the sibling skill that owns it via `aevatar-platform-map`.

### 4c. Inconclusive -> name the missing evidence and the next probe

State exactly what you could not determine and the cheapest probe to get there: a minimal repro;
a capability check; **live platform logs if you have access to them**; an observatory run-timeline /
readmodel-version check; or re-pulling the relevant code at the exact deployed commit.

## Execution paths (pick by the tools you actually have)

### Local coding agent — preferred for deep RCA
```bash
# read the suspected layer (shallow clone; reuse an existing clone if present)
gh repo clone aevatarAI/aevatar        # or ChronoAIProject/NyxID , ChronoAIProject/Ornn
#   git clone --depth=1 https://github.com/<owner>/<repo>
# de-dup before drafting
gh issue list  -R <owner>/<repo> --search "<keywords> in:title,body"
gh search issues "<keywords>" --repo <owner>/<repo>
# file ONLY after the user confirms the draft
gh issue create -R <owner>/<repo> --title "[<layer>] ..." --body "..."
```

### Server-side, in an aevatar session — constrained fallback
Use the runtime **`nyxid_proxy` tool** (not the `nyxid` CLI), `slug=api-github`, base
`https://api.github.com`:
- read code: `GET /repos/{owner}/{repo}/contents/{path}` , `GET /search/code?q=...+repo:owner/repo`
  (repos are public; raw fetch also works).
- de-dup: `GET /search/issues?q=repo:owner/repo+is:issue+<keywords>`.
- file (confirmed only): `POST /repos/{owner}/{repo}/issues`.

**Credential reality — be honest about it.** Under a relayed/in-session call, every tool runs on the
**sender's own NyxID identity**, not the bot owner's. So filing an issue operates the **sender's**
GitHub, and it requires: the sender has connected **`api-github`** in their own NyxID (check
`GET {NYX}/api/v1/services`) with an OAuth scope that allows writing issues (`repo` / `public_repo`).
**Writes have no owner fallback** — without a live sender token you get `credential_denied`. Deep
multi-file reading over the API is clunky; prefer the local path for RCA and use this to fetch
specific files, search code, and de-dup/file.

**Neither available?** Don't fake it — hand the original problem back to the calling agent with the
evidence you gathered (the family's `fallback-to-calling-agent` ethos), so it can finish with its
own local tools.

## Honesty & safety rails

- **Never auto-file.** Always: de-dup -> draft -> explicit user confirmation -> file.
- **No `path:line`, no root cause.** An unverified hypothesis is reported as inconclusive.
- **Never fabricate** a root cause, an issue link, a version, or a connector slug.
- **External-repo issues only when behavior violates the layer's published contract.**
- **Attribute by reading + elimination**, not first-match — exclude the alternatives.
- **Server-side writes act as the sender** — verify the connector and scope before promising a file.

## Report shape

End with a straight, evidence-bearing summary:

> **Layer:** NyxID — *evidence: 403 from `nyxid_proxy`, slug present in `/services`, OAuth scope
> missing.* **Root cause:** `backend/src/handlers/proxy.rs:NN` rejects when the granted scope lacks
> `repo` (commit `abc123`). **Verdict:** usage. **Action:** guidance — reconnect `api-github` with
> the `repo` scope; no issue filed.

Name the layer, cite the code, state the verdict (defect | usage | inconclusive), and the action
(issue drafted, awaiting confirm | guidance given | next probe).
