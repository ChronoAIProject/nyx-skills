# FAQ research

## How to read sources

Read the web only through published Firecrawl operations with
`python3 notion_hub.py call {FIRECRAWL_SERVICE}__{operation} --args '{...}'`.
FIRECRAWL_SERVICE is in the task.

- Own key (`api-firecrawl...`): `scrape` with
  `{"url":"...","formats":["markdown"],"onlyMainContent":false,"waitFor":5000,"timeout":60000}`.
- Platform tool (`tools-firecrawl`): only `search` is published. Use
  `{"query":"...","limit":5,"scrapeOptions":{"formats":["markdown"]}}`; results
  include page content. Target pages with queries such as `site:{domain}`,
  `{name} {address} opening hours`, `{name} menu`.
- Google listing (scrape only): always scrape
  `https://www.google.com/maps/search/?api=1&query={GOOGLE_QUERY}&hl=en`
  (URL-encode spaces as `+`), even when the task also gives a Google link.
  Never scrape `share.google`, `goo.gl` or `maps.app.goo.gl` short links: they
  fail. Keep `hl=en`. Read hours per day, phone, rating and review count, price
  level and listed attributes (for example "serves vegetarian dishes").
- Reviews and editorial mentions (required, both searches): `search` with
  `{"query":"{name} {area} review","limit":5}`, then
  `{"query":"{name} {area} vegetarian OR vegan","limit":5}`. Summarize up to five
  recurring themes under "Reviews say"; if nothing usable comes back, omit that
  section and say so in the final message.
- Menu images: download the official menu image if one is linked, convert it to
  PNG if needed (for example AVIF with Pillow) and read it. If it stays
  unreadable, add an open question asking the owner to send the menu as a photo
  or PDF in chat; NyxBot transcribes it.

## Source priority

1. OWNER_FACTS (always wins; cite as "owner").
2. Official website, official menu, official booking/ordering pages.
3. The Google listing for hours, address and phone.
4. Other listings and editorial reviews (label them).
5. Customer reviews: recurring experiences only, never policies, prices or
   hours.

## What to extract

- Hours per day, last orders, breaks, known holiday exceptions.
- Address, phone, email, map link; parking and accessibility if stated.
- Menu link and signature dishes; prices only with their source and channel
  (dine-in vs online kept separate); market-price items marked as such.
- Dietary: only what sources literally state about vegetarian, vegan, halal,
  allergens, spice. Never infer suitability from dish names.
- Reservation and queue policies only if the owner or an official page states
  them.
- Up to five recurring review themes, labelled "reviews say".

## FAQ page format (customer-facing)

The FAQ page is read by the front desk while it answers customers. Keep it short
and factual:

- Headings (`## `) in this order: Hours, Location and contact, Menu, Dietary,
  Reservations, Queue, Payment, Parking and access, Reviews say, Other
  questions.
- One line per fact: `- fact (source, YYYY-MM-DD)`. Source is a short label:
  owner, website, Google, booking page, ordering page, reviews.
- Where sources conflict, one line stating both values and "ask staff".
- Unknowns a customer is likely to ask about: one line "Not confirmed yet; ask
  staff".
- At most about 60 lines. No tables, no research logs, no extraction
  diagnostics, no URLs except the public menu/booking/ordering links, no notes
  about this setup.

Put source URLs, unreadable sources, extraction notes and the "Open questions
for owner" list in your final message only, never in the FAQ page.
