# CMA hand-off

CMA does the Notion hub build and the FAQ research for the owner, using only NyxID's
published operations (for example `notion_create_database`). It suits work that
is long-running (FAQ research). One worker agent per business; reuse it for both
tasks.

## Create the worker

Call the CMA create-agent operation (`POST /api/v1/agents`) with:

- `Idempotency-Key`: `setup-{business-slug}-v1` (reuse on retry; never a new key
  for the same attempt)
- `name`: `setup-{business-slug}`
- `profile.skills`: `[{"id": "0d0e247f-ee1e-4304-95fd-27990d269a26"}]` (Ornn skill
  `nyxid-business-setup-worker`; omit `version` to use its latest)
- `profile.permissions.services`: `api-notion`, plus `tools-firecrawl` or
  `api-firecrawl` when the faq module is chosen
- `profile.system_prompt`: "You are a setup worker for one small business. Follow
  the nyxid-business-setup-worker skill exactly. Never contact customers."

NyxID shows a CMA card and wakes this thread when the agent is ready. End your
turn instead of polling.

## Send a task

Use the agent input operation (`POST /api/v1/agents/{id}/input`) with a new
`Idempotency-Key` per task and `text` containing exactly one task block, filled
in, and nothing else. The worker's own skill holds the procedure and the safety
rules (published NyxID operations only, never raw proxy calls); do not restate,
add or override rules, and do not pass Google short links (`share.google`):
give GOOGLE_QUERY instead.

```
TASK: notion-hub
BUSINESS: {name}
TIMEZONE: {tz}
NOTION_SERVICE: {instance slug, e.g. api-notion-3}
PARENT_PAGE_ID: {id}
MODULES: queue, faq, reservations   (only the chosen ones)
RULES:
  minutes_per_party: {n}
  grace_minutes: {n}
  queue_hours: {text}
  reservation_notice: {text}
  max_party: {n}
  booking_window: {text}
  escalation_contact: {text}
  sms_confirm_template: {text}
  sms_call_template: {text}
```

```
TASK: faq-research
BUSINESS: {name}
NOTION_SERVICE: {instance slug}
FIRECRAWL_SERVICE: {firecrawl slug the owner has, e.g. api-firecrawl}
FAQ_PAGE_ID: {id}
WEBSITE: {url or none}
MENU: {url or "owner supplied below"}
GOOGLE_QUERY: {business name and full street address, per outlet; not a link}
OWNER_FACTS: {bullet list of facts the owner stated, with today's date}
```

Never put customer data or secrets in a task.

## Collect the result

The input card reports agent status only, not the answer. When it shows the agent
ready again:

1. Read the worker's final message with `cma__get_api_v1_agents_by_id_transcript`
   (last turn, last agent message) and find the `SETUP_RESULT` JSON. The
   completion event itself carries no result; do not page through raw events.
2. Verify independently: list the parent page children, retrieve each database
   and compare properties with references/notion-hub.md; read the FAQ page.
3. If the result says `database_create_unavailable`, use the manual fallback.

When setup is finished, ask the owner whether to delete the CMA worker; it is not
needed for daily operation.
