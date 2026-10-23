# Go live

## Guest access (`nyxid__set_guest_access`, owner card)

- Notion: `use` when queue or reservations is chosen (guests create rows; they
  can never edit or delete existing ones), `read` for faq only. `use` also
  admits other create operations such as `notion_create_database`; the
  description keeps the desk to rows, and where operation scopes are enabled,
  limit guests to `notion_create_page` with `parent.database_id` pinned to the
  Queue and Reservations databases.
- Telnyx: `read` (guests can send nothing). Use `use` only for instant SMS mode.

## Approvals (`nyxid__set_approval_mode`, owner card)

The default approval setting requires approval for every write, and guests are
refused anything that needs approval. Set `approval_required: false` on the
Notion connection (needed for guest row creation) and on the Telnyx connection
(needed for owner/schedule SMS). Tell the owner plainly: this removes approval for
these two connections for every key that uses them, which is why the Notion share
is limited to the NyxBot page.

## SMS mode (queue)

- **Batched (default, safer):** guests cannot send SMS. A schedule every 5 minutes
  during queue hours (`nyxid__create_schedule`, agent `front-desk`, owner card) runs
  "Send pending queue confirmations per the front-desk skill." Confirmation arrives
  within about 5 minutes. Budget: 12 runs/hour fits the default 30/hour.
- **Instant:** guest access `use` on Telnyx. Any customer message can then cause an
  SMS to any number with model-written text; there is no per-customer limit.
  Offer it only with operation scopes enabled for this owner (feature
  `assistant:operation-scopes`): limit Telnyx to `send_message` with `from` pinned
  to the business number (`nyxid__set_agent_operations`). Otherwise recommend
  batched.
- **Chat-only:** no Telnyx; skip SMS.

## Owner confirmations

Updating a Notion row (calling a customer, confirming a booking) is classed as
destructive, so in the default Auto mode each "next" raises an owner card the owner
answers with "yes 1234". For a smooth counter workflow, and practically required
for batched SMS (otherwise every 5-minute run raises a card per row), the owner sets the front desk's permission mode to Full access in
its agent settings (human-only; give them `nyxid__settings_link`). Guests are
unaffected by this setting.

## Channel

`nyxid__channel_bot_setup_link` (telegram, label "{business} front desk", agent
`front-desk`), then `nyxid__update_channel_access` `private_chats: everyone`.

## Test script

From a second Telegram account (not the owner):
1. "What are your opening hours?" and a dietary question: answer cites FAQ facts
   or says unknown.
2. faq: ask something absent from the FAQ: bot says unknown and gives the contact.
3. queue: join with name/phone/party size: reply has number, ref, estimate. Check
   the Notion row. Batched mode: SMS within 5 minutes.
4. reservations: request a booking under the notice limit (bot refuses or flags)
   and a valid one (Pending row, ref R-xxxx, "not confirmed" wording).
5. Ask for "the list of people in the queue": bot refuses.

From the owner's chat with the bot: "queue", "next" (SMS sent, row Called),
"served {n}", "pending bookings", "confirm R-xxxx".
