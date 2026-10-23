# Interview questions

Ask in small batches. Skip anything already answered. Record answers in this
thread; they feed the CMA task briefs and the front-desk description.

## Always

- Business name as customers know it, and one-line description (cuisine/service).
- Address(es). If more than one outlet, list them; each outlet needs its own
  queue numbering (ask whether to support multiple outlets now or start with one).
- Timezone and country (for phone formats and dates).
- Public contact for things the bot cannot answer (phone or email).
- Customer language(s) and tone ("friendly and short", "formal").
- Name customers should see for the bot (display name, max 40 characters).

## queue

- Opening hours when the queue is open (per day). Queue closes how long before
  closing?
- Average minutes per party served (used for the estimate). Does party size
  matter (e.g. 1-2, 3-4, 5+ seated separately)? Start simple: one number.
- Who calls the next customer: the owner from their own chat with the bot
  (supported today) or staff (staff have no special role today: they would update
  Notion directly, or use the owner's chat). See go-live.md.
- How long a called customer has to show up (grace minutes) before skipped.
- SMS: do they have a Telnyx account, a sending number and a messaging profile?
  Sender registration done for their country? If not, start chat-only and add SMS
  later.
- SMS mode: instant (customers' messages can cause SMS sends) or batched every 5
  minutes (safer). Explain the trade-off from go-live.md.
- Exact SMS wording they want (offer the default templates).

## faq

- Official website, menu URL or menu photo, Google Maps link for each outlet.
- Facts only the owner knows: dietary options (vegan/vegetarian/halal/allergens),
  parking, accessibility, payment methods, corkage, kids, pets, private rooms.
- Topics the bot must never answer (send to staff instead).

## reservations

- Minimum notice (e.g. 4 hours), maximum party size for bot requests, booking
  window (how far ahead), time-slot rules if any.
- Who confirms requests and how fast. The bot only records requests as Pending.
- What to tell customers about deposits/cancellation (only if the owner states a
  policy).
- Phone-call bookings: not connected yet; note interest for later.
