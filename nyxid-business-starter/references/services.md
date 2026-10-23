# Services

Check what is already connected with `nyxid__list_my_services` before creating
connect links. Use the exact instance slug the owner has (for example
`api-notion-3`) everywhere afterwards.

## Notion (`api-notion`) - required

- Connect with `nyx__connect_service`. During Notion consent the owner chooses
  which pages the integration can see. Ask them to share **only** the empty page
  "NyxBot - {business}". Everything the front desk can read, guests can indirectly
  query, so a narrow share is the main privacy control.
- After connecting, find the parent page ID with the Notion search operation
  (query the page title) and confirm the title with the owner.

## CMA (`cma`) - required for setup

- Used once for setup work (hub creation, FAQ research). The owner must be signed
  in to CMA; a 403 such as "sandbox use forbidden" usually means the CMA sign-in
  expired: ask the owner to sign in to CMA again, then retry.
- CMA agents are given NyxID services by catalog slug (`api-notion`,
  `api-firecrawl` or `tools-firecrawl`), not by instance slug.

## Telnyx (`api-telnyx` or `api-telnyx-oauth`) - queue SMS only

- The owner's own Telnyx account: API key (`api-telnyx`) or OAuth
  (`api-telnyx-oauth`). They need a sending number or sender ID, a messaging
  profile, and whatever sender registration their country requires. NyxID does not
  provision numbers.
- NyxID's platform Telnyx offering does not send SMS today. Do not promise
  platform-billed SMS.
- Only `send_message` is used. Never call `dial_call` from this setup.

## Firecrawl (`api-firecrawl` or `tools-firecrawl`) - faq research

- Prefer the owner's own `api-firecrawl` connection: it publishes `scrape`,
  which reads the official site and the Google listing. The platform tool
  `tools-firecrawl` (billed in NyxID credits) currently publishes only `search`;
  research still works through search results but cannot scrape a given URL.
- Pass the chosen slug as FIRECRAWL_SERVICE and include its catalog slug in the
  CMA worker's services. If a Firecrawl call fails with "Service is no longer
  available", the platform tool is not configured; ask the owner to connect
  their own Firecrawl key with `nyx__connect_service` (`api-firecrawl`).
