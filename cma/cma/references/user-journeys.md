# CMA non-admin user stories and flows

This inventory covers the implemented end-user product and public contracts as
reviewed on 2026-09-24. It excludes platform administration, raw provider-binding
management, gateway credential records, infrastructure and database operations.
Availability depends on the deployment and the caller's exact capabilities.
These are contract and UI flows, not a claim that every journey was exercised
in production during this documentation pass.

## User types and access

| User type | What determines the available flows |
| --- | --- |
| Signed-out visitor | Can view available public landing/Trigger information and begin NyxID sign-in or registration when enabled. Cannot create anonymous Agents. |
| Trigger visitor | Has `cma:trigger:launch` without direct Sandbox creation. Can launch and use/delete their own resulting resources as permitted; cannot manage profiles, publish Triggers or administer CMA. |
| Personal user | `cma:sandbox:create`, `cma:sandbox:use` and `cma:sandbox:delete` govern creation, use and removal. Resource ownership and state still matter. |
| Profile author | `cma:profile:manage` permits the profile and Event Worker Profile flows. |
| Trigger publisher | `cma:trigger:publish` permits owner publishing and placement management. |
| Bot owner | `cma:bot:manage` permits owned Bot management when the feature and required connections are available. |
| Share recipient / organization member | Current resource grants and membership determine visibility. A view-only grant stays read-only. Members/viewers do not inherit interactive control merely by joining. |
| Organization admin | Not necessarily a CMA platform admin. May interact/manage where `org_roles` sharing, isolation and effective capabilities allow; a view-only grant remains view-only. |
| API client acting for a user | Uses that user's supported credential and permissions. Global NyxID auto-connection does not increase authority. |

The same person can occupy several rows. Roles' display names are not permission
checks. Consult current effective access for actions on shared resources.

## A. Account and access

| ID | User story | User flow and outcome |
| --- | --- | --- |
| A1 | As a user, I want to sign in and return to my work. | Open CMA → Sign in → complete NyxID authorization → return to CMA → restore accessible inventory and the selected Agent. A login return does not itself start new work. |
| A2 | As a new visitor, I want to create an account when registration is available. | Open sign-up options → choose an enabled NyxID registration method → satisfy any invitation requirement → complete sign-in → return to the retained destination. Registration belongs to NyxID. |
| A3 | As an owner, I want to connect the services/model account my environment requires. | Select a profile or open a blocked resource → review connection requirements → use the hosted connection flow or supported manual handoff → complete authorization → let CMA verify the connection → continue the original action. A redirect alone does not prove readiness. |
| A4 | As a user, I want to control my local account experience. | Open the bottom-left account menu → select appearance or sign out. Sign-out ends the browser login; it is not a request to pause or delete the user's work. |

## B. Discover and navigate work

| ID | User story | User flow and outcome |
| --- | --- | --- |
| B1 | As a user, I want to find my Agents and their environments. | Choose Personal in the upper sidebar scope selector → browse Sandbox → Workspace → Agent, or open Agents inventory → open the desired conversation. IDs and conversation continuity are retained. |
| B2 | As a recipient, I want to find work shared with me. | Choose Shared with me → browse authorized Sandboxes or use All authorized Agents for narrow Agent shares → open a resource → see only the permitted projection. A narrow Agent share does not expose its parents. |
| B3 | As an organization participant, I want a scoped view of team resources. | Select a current organization → browse the authorized hierarchy/inventory → open an Agent → read or act according to effective access. Organization scope does not create or transfer ownership. |
| B4 | As a user, I want to understand where an Agent came from and export its inventory entry. | Open Agents inventory/details → inspect creation origin and safe channel-use indicators → apply available inventory filters → export the current authorized page. Export contains safe inventory metadata, not transcripts or a full filesystem. |

## C. Create a working environment

| ID | User story | User flow and outcome |
| --- | --- | --- |
| C1 | As a personal user, I want to start an Agent with minimal setup. | New agent → choose the offered existing/new environment path and published profiles/defaults → enter an optional first message → review requirements → create → follow preparation until the Agent is ready and the first-message outcome is known. |
| C2 | As an owner, I want a new isolated Sandbox. | Select a published Sandbox Profile → inspect resources, model access, services, software and nested profiles → satisfy connections/trust → create once → follow durable provisioning. Nested Workspaces/Agents may already be created by the profile. |
| C3 | As an owner, I want another Workspace inside an existing Sandbox. | Open a usable Sandbox → add a published Workspace Profile → review public repository/custom-directory and setup configuration → approve required trust → create → follow Workspace preparation. Limits apply to the existing pinned Sandbox. |
| C4 | As an owner, I want parallel Agents working independently in one Workspace. | Open the ready Workspace → add an Agent with a published Agent Profile and title → CMA creates its dedicated Worktree/branch → open that Agent. Each Worktree has one Agent; the main checkout is not their shared working directory. |
| C5 | As a user, I want to reuse suitable existing resources. | Find the intended existing Sandbox/Workspace/Agent → select it during creation or open it directly → add only the missing child. Trigger reuse additionally follows the Trigger's recorded policy. Reuse is by authorized identity, not matching display names. |
| C6 | As a user, I want to know whether provisioning is progressing or blocked. | Open the retained resource/progress view → inspect current step, connection requirements, quota/capacity and typed failure → complete a supported corrective action → continue the original intent. Do not create duplicate Sandboxes to retry an uncertain admission. |

## D. Work with an Agent

| ID | User story | User flow and outcome |
| --- | --- | --- |
| D1 | As an authorized user, I want an Agent to perform a task. | Open the Agent → enter text → submit once → observe queued/admitted, delivered, running and terminal states → read the result. Queued input is not a completed answer. |
| D2 | As a user, I want to understand live progress. | Keep the conversation open → observe available assistant text, reasoning, tool activity and lifecycle state → distinguish live fragments from durable messages. A stream interruption does not mean the task failed. |
| D3 | As a user, I want to continue the same conversation later. | Return to the same Agent → load its retained history → catch up from a valid durable cursor → submit a new task if desired. Reopening never resends the previous task. |
| D4 | As an authorized user, I want to redirect an active turn. | Inspect the active turn/control availability → submit a steering message → follow its receipt and the same turn. Steering does not create an unrelated conversation. |
| D5 | As an authorized user, I want to interrupt or cancel work. | Observe the current response → use its supported cancel/interrupt action, or cancel a queued unbound response → retain the command identity → confirm the terminal result. Control is tied to the observed turn. |
| D6 | As an authorized user, I want to decide a pending tool approval. | Read the actual approval request → choose allow, deny or abort as supported → submit for that exact request → observe resolution. Sharing must explicitly permit approval control. |
| D7 | As an owner, I want to use a Trigger's prepared follow-up prompts. | Open an Agent whose source exposes published quick messages → inspect/select one → deliberately submit it. Source reads and newly published shortcuts never send messages automatically. |
| D8 | As a user, I want to inspect conversation and resource usage. | Open Agent details/resources → read supported token/context/usage information and, with independent Sandbox access, environment metrics → account for missing or stale observations. These readings are not a billing interface. |

## E. Environment lifecycle and connections

| ID | User story | User flow and outcome |
| --- | --- | --- |
| E1 | As an authorized manager, I want to pause and later revive an environment. | Select the exact Sandbox → explicitly pause → observe checkpoint/pausing until Paused → later revive or admit eligible work → follow restore until ready. Preserve existing identifiers, history and work. |
| E2 | As an owner, I want to give an existing Sandbox access to another service. | Identify the desired service and owner connection → explicitly pause the Sandbox and wait for Paused → append allowed service access → revive → verify readiness. Editing a profile does not silently expand existing Sandbox grants. |
| E3 | As an owner, I want to stop or remove one Agent. | Choose stop to end its runtime while retaining history, or explicitly choose deletion to remove the Agent and clean up its dedicated Worktree/home → observe the recorded outcome. Stop is distinct from cancelling one turn. |
| E4 | As an owner, I want to remove a Workspace or Sandbox I no longer need. | Review the exact target and affected children → confirm removal → retain the admitted operation → follow teardown/cleanup to completion. A 202 or Deleting state is not completed deletion. |
| E5 | As an owner, I want to download a saved environment snapshot. | Inspect the Sandbox's latest completed snapshot → request its authorized download → receive the archive. This exports a saved snapshot, not an arbitrary live filesystem; sharing metadata does not grant whole-home export. |

## F. Reusable profiles and marketplace

Entry point: bottom-left account menu → Profiles. The unified library contains
My profiles, Marketplace and Event workers.

| ID | User story | User flow and outcome |
| --- | --- | --- |
| F1 | As a user with catalogue access, I want to discover reusable configurations. | Profiles → Marketplace → choose Sandbox, Workspace or Agent → search/browse → inspect published content, references and executable setup → choose a permitted revision for use. Public visibility is not a trust endorsement. |
| F2 | As a profile author, I want to customize someone else's published profile. | Open the marketplace entry → fork a usable revision → obtain an owned draft with provenance → edit → publish explicitly. Changes do not modify the source. |
| F3 | As an author, I want reusable Agent behavior. | My profiles → New Agent Profile → choose model, effort, permission level, exact Ornn skills and prompt → save draft → publish a revision. Skills and prompt apply to that Agent's home. |
| F4 | As an author, I want reusable Workspace setup. | Create a Workspace Profile → choose a supported public GitHub repository/reference or custom directory → configure setup → select published Agent Profile references → save and publish. |
| F5 | As an author, I want reusable environment capacity and software. | Create a Sandbox Profile → choose CPU/memory, Codex model access, service scope, nonsecret environment, software, limits and published Workspace references → save and publish. |
| F6 | As an author, I want to evolve a profile without changing existing work. | Open the current draft → edit with its draft version → reconcile any conflict → publish a new immutable revision → select it explicitly for future instances. Existing instances retain pinned content. |
| F7 | As an author, I want to publish, hide or retire my configuration. | Change public/private visibility for discovery, or retire the profile when no longer offered → verify the resulting catalogue state. Existing snapshots and permitted historical pins remain separate from new selection. |
| F8 | As a Sandbox Profile owner, I want faster starts or persistent availability. | Open Availability → for a published public profile, configure warmup of 1–5 Sandboxes; optionally select Always keep alive → save → observe actual availability. Keep alive affects existing and new instances; explicit pause remains possible. |

## G. Event Worker Profiles

| ID | User story | User flow and outcome |
| --- | --- | --- |
| G1 | As a profile author, I want one reusable worker configuration for event-driven Agents. | Profiles → Event workers → create → name/describe the worker → choose published Sandbox, Workspace and Agent revisions → save. CMA composes and stores the complete Event Worker Profile. |
| G2 | As an author, I want to update a worker with traceable versions. | Open its current revision → change authoring fields/references → save against `expected_revision` → inspect the new revision or retrieve history. Conflicting updates are refused; existing Bots retain their snapshot. |
| G3 | As an author, I want to retire an obsolete worker. | Select the worker → retire its current revision → confirm it leaves the active list. Retained revisions and existing Bot configurations remain available under their contracts. |

## H. Telegram Bots

Entry point: bottom-left account menu → Bot settings. The implemented CMA Bot
creation UI selects an owned Telegram bot already registered in NyxID. Arbitrary
gateway sources are a separate CMAEG integration surface.

| ID | User story | User flow and outcome |
| --- | --- | --- |
| H1 | As a Bot owner, I want Telegram messages to reach a CMA Agent. | Register/activate the Telegram bot through NyxID → Bot settings → create → select that owned bot → choose Agent/environment profiles or an Event Worker Profile → configure source admission and replies → review → create → follow provisioning until Active. Existing conflicting routes are refused. |
| H2 | As a Bot owner, I want to control who can trigger work and how it replies. | During creation, choose private-chat access, an explicit sender allowlist or group mention behavior, plus automatic final reply and acknowledgement timing → review the actual policy → create. Do not assume unrestricted groups or an in-place policy editor. |
| H3 | As a Bot owner, I want to verify the integration. | Open Bot details → run its synthetic test → inspect the recorded provider result; when the user authorizes a real chat test, send a message through the chosen Telegram chat and confirm the reply. Synthetic tests do not send external chat messages. |
| H4 | As a Bot owner, I want to suspend and restore event intake. | Disable the Bot → observe Disabled → later enable → observe Active. This changes source admission; it is not a blanket pause/delete operation on unrelated Agents. |
| H5 | As a Bot owner, I want to rotate integration credentials. | Select Rotate keys → follow the durable rotation and cleanup → confirm the Bot's final state. Use the managed flow instead of exposing or manually replacing keys. |
| H6 | As a Bot owner, I want to remove an integration. | Review the exact Bot → delete → follow channel, route and credential cleanup until the Bot disappears. Provider resource lifecycle is reported separately; do not assume deleting the Bot erased every retained user Sandbox. |

## I. Triggers and visitor launches

| ID | User story | User flow and outcome |
| --- | --- | --- |
| I1 | As a publisher, I want a reusable public entry point to an Agent experience. | Account menu → CMA Trigger → choose public usable profile revisions → select new/reuse behavior → configure presentation, first message, optional quick messages and review requirements → save a draft. |
| I2 | As a publisher, I want to place the launch button on approved sites. | Add HTTPS source placements → explicitly publish the draft version → select a placement in Embed → copy the returned link, Markdown, HTML or script snippet → install it on the chosen page. Publishing the Trigger does not itself edit that page. |
| I3 | As a publisher, I want to maintain and measure the experience. | Read revisions/stats and placement attribution → edit/save/publish a new revision when needed → retire a placement or the Trigger to stop new use. Delete an eligible unused draft if appropriate. Existing user resources are retained. |
| I4 | As a visitor, I want to understand what a public button will start. | Open the public Trigger preview → inspect purpose, profiles, setup disclosure, reuse behavior and first-message excerpt → sign in if required → deliberately choose to launch. Preview and navigation do not provision. |
| I5 | As a visitor, I want a working Agent of my own. | Click the launch action → authenticate as myself → satisfy missing connections/review/trust → start the retained Launch → follow preparation → enter my own ready Agent and inspect its first-message result. Never enter the publisher's Agent by implication. |
| I6 | As a returning visitor, I want predictable reuse. | Launch the same published experience → review the server's reuse/repeat choice → reuse/create the Sandbox, Workspace or Agent according to the recorded policy → continue with the returned Agent. Explicit no-review click intent can continue through login without another start click. |
| I7 | As a visitor, I want to recover or cancel a Launch. | Reopen the existing Launch → read requirements and progress → complete a missing connection and continue the same intent, or request supported cancellation → inspect the recorded result and any already-created resources. Reloading never starts a duplicate Launch. |

## J. Sharing and collaboration

| ID | User story | User flow and outcome |
| --- | --- | --- |
| J1 | As an owner, I want colleagues to read one Agent. | Agent Details → Sharing → select a current organization → keep narrow Agent scope and View only → review exposure → create → verify the grant. Parent paths, sibling Agents and filesystem access are not included. |
| J2 | As an owner, I want to share a whole environment. | Open Sandbox Sharing or explicitly select Whole Sandbox → choose organization and mode → acknowledge current and future children → create → verify. The broader scope must be deliberate. |
| J3 | As an owner, I want organization roles to control collaboration. | Inspect the chosen grant → select Use organization roles → review effective control and isolation requirements → save against the current revision. Organization admins may interact where allowed; members/viewers remain read-only. A refused narrow interactive grant is not silently widened. |
| J4 | As an owner, I want to change or withdraw a share. | Open current grants → change mode or revoke using its current revision → verify the receipt and current list. On conflict, review fresh state before another action. Recipients cannot reshare. |
| J5 | As a recipient, I want to use only the access the owner granted. | Open the shared Agent/hierarchy → read effective capabilities → view history/artifacts or use permitted interaction/lifecycle controls → refresh when access changes. A view grant never confers ownership, retirement or unrestricted export. |

## K. Outputs and retained records

| ID | User story | User flow and outcome |
| --- | --- | --- |
| K1 | As a user, I want to inspect the durable conversation record. | Open an authorized Agent → read transcript or paginated event history → apply messages in durable order → preserve redacted sequence markers in shared views. Readable history survives a temporary runtime/stream outage. |
| K2 | As an owner with sharing authority, I want to publish a selected result as an artifact. | Open Agent artifacts → explicitly choose a supported local file → review the content → publish immutable bytes → receive metadata and digest. The artifact registry does not browse or expose the runtime filesystem. |
| K3 | As an authorized reader, I want to download an approved artifact. | List the Agent's authorized artifacts → inspect name/type/size → download the exact artifact → verify size/hash. Artifact access does not imply Sandbox snapshot access; already-downloaded copies cannot be recalled. |

## L. Integration through the public API

| ID | User story | User flow and outcome |
| --- | --- | --- |
| L1 | As a developer, I want to discover and call the same operations used by the UI. | Account menu → Developer or fetch live OpenAPI/conformance → choose REST for resources, Responses v2 or AG-UI for conversation → authenticate as the user → follow schemas, receipts and typed errors. |
| L2 | As a NyxID user, I want to call CMA through my proxy connection. | Refresh NyxID `/api/v1/keys` → find auto-connected `cma` → send an ordinary user access token to the CMA proxy path → receive only my authorized data/actions. General NyxID agent keys are currently refused. |
| L3 | As an integrator, I want retries and reconnects to preserve exactly one intent. | Retain each mutation's key/body and returned receipt → recover uncertain admission with the same request → read/replay output from its own durable cursor → report the recorded outcome. Do not equate connection loss with failure or resend a task with a new key. |

## Main end-to-end journeys

1. **Personal coding/research task:** sign in → select/create profiles → satisfy
   connections and trust → select/create Sandbox and Workspace → create/open
   Agent → submit task → follow output/approvals → continue later or explicitly
   pause/remove the chosen resource.
2. **Reusable public experience:** publish Agent, Workspace and Sandbox Profiles
   → publish Trigger and placements → embed its returned snippet → visitor
   reviews and signs in → visitor consents/connects → Launch provisions or reuses
   the visitor's environment → visitor uses their Agent.
3. **Telegram worker:** publish the three base profiles → save Event Worker
   Profile → register owned Telegram bot in NyxID → configure CMA Bot and source
   policy → follow Active → synthetic test → authorized real-chat test → manage
   intake, credential rotation and deletion through Bot settings.
4. **Team collaboration:** owner selects Agent or whole Sandbox → shares to an
   organization with explicit mode → recipient opens Shared with me/Organization
   → effective access determines view/control → owner can revise/revoke access.
5. **API-controlled task:** establish supported user authentication and any
   required renewable owner login → discover existing resources → create only
   what the task requires → submit a v2 response with a retained key → observe
   receipt and replay → retrieve the final result.

## Current product boundaries

- Non-admin does not mean unrestricted: direct creation, profile authoring,
  Trigger publication and Bot management are separate capabilities.
- Visitors do not gain direct environment creation or profile editing by opening
  a public Trigger. Each authenticated visitor owns their resulting resources.
- Organization inventory, sharing and permitted interaction exist. New
  organization-owned environment creation and its credential provisioning are
  not a supported user flow yet.
- Sharing currently targets organizations, not arbitrary public conversation
  links or direct email/person invitations. An Agent-only view does not expose
  its parent hierarchy. Current interactive isolation rules may require an
  explicitly compatible whole-Sandbox grant.
- Only Codex is supported as an Agent provider. Model access can be managed or
  the owner's connected credentials. Workspace repository profiles use public
  GitHub repositories; custom directories are supported. Do not promise private
  repository profile provisioning.
- Profile edits apply to future selections; they are not live model/prompt/
  software mutations of an existing Agent or Sandbox. Availability is a separate
  mutable policy with the explicitly described effect on existing Sandboxes.
- CMA has no public terminal, native MCP execution interface or A2A task
  execution. NyxID can expose discovered HTTP operations; that does not turn the
  unsupported CMA-native MCP endpoint into a working interface.
- Conversation input currently supports text. General image/file/media input
  is refused. Approved output artifacts and owner snapshot downloads are
  separate supported flows; no general public filesystem browser is implied.
- CMA's owner Bot product currently provisions Telegram integrations. Other
  event sources use separate CMAEG protocols and are not additional CMA Bot UI
  choices. Event Worker Profiles are owned versioned records, not a fourth
  public marketplace publication category.
- General agent API keys do not yet provide user API access. Registered
  CMA-managed Bot keys only serve their bound conversation scope.
- Checkpoint restore, connection checks and deletion are asynchronous. Report
  persistent failure from recorded state; never describe hours of unchanged
  progress as successful completion or hide it with a new resource.

## Source and evidence

This package was reviewed against CMA's public API overview, REST, Responses,
AG-UI, Trigger, model and service-connection contracts, plus the current profile,
sharing, Bot, inventory and connection UI. The public deployed
`https://bot-api.chrono-ai.fun/openapi.json` describes the generated API surface.
The implementation has additional documented authentication, artifact and
resource routes. Consult live effective access and feature availability.

The NyxID proxy was checked in production with a supported user access token for
representative reads, repository resolution, refusal preservation and bounded
SSE observation. These checks are transport evidence, not separate production
acceptance of every story above. No customer resource IDs, account identities,
credentials or private conversation content are included in this public package.
