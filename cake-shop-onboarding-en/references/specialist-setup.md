# Build the two assistants, grant access, schedule patrols

Use NyxBot's own native tools (create specialist, update specialist, grant access, set skills, set operation scope, create schedule, set channel). For any action that shows a confirmation card, let the owner confirm. Do not work around it.

## 1. Check for duplicates

First list the existing specialists. If the same shop (same shop name) already has a customer specialist or order manager, update it; do not create a second one. Specialists for other shops do not count as duplicates.

## 2. Customer specialist

- Name: the name the owner chose; if none, `{Shop} Order Assistant`.
- Role: the customer specialist template in `role-snippet.md`. Fill in only the shop name and the sheet ID. Do not change a single other character.
- Persona: the customer specialist Persona in `role-snippet.md`.
- Grant `api-google-workspace` with guest level `all`. Customer turns append orders, write customer requests into Notes, and change Awaiting customer to Confirmed. Changing existing rows needs `all`. Guest level is a field in the grant. It is separate from the operation scope below. Set it first.
- Operation scope: read sheet, write sheet, append rows (`GET /v4/spreadsheets/{spreadsheetId}`, `GET …/values/{range}`, `PUT …/values/{range}`, `POST …/values/{range}:append`), for both owner turns and guest turns. If it reads back as all operations already, keep it, and add one line at handover: "The operation scope is currently all operations, wider than needed."
- Bind no skill. Customer turns cannot read skills, so the whole flow is in the Role.

## 3. Order manager

- Name: `{Shop} Order Manager`.
- Role and Persona: the order manager template in `role-snippet.md`.
- Grant `api-google-workspace` with guest level `read` (the order manager is not on any customer channel, so guests cannot reach it anyway). Operation scope: same as the customer specialist.
- Grant `ornn-api`: for owner turns, allow **all** operations in the operation list whose `read_only` is true (about 70). Do not pick just a few, and do not open all operations (`all_operations` is false, and no write operations are included). If only one or two skill-metadata read operations are allowed, `skill_read` fails and the order manager has to work around it to read the skill every time. Guest level `read`. Without it, the order manager cannot read its own bound skill. A grant replaces the whole set, so `api-google-workspace` and `ornn-api` must be written in the same call.
- Skill: follow `private-desk.md` to copy `cake-order-desk-en` into this shop's private skill and bind it. Only if the copy fails, bind the latest version of the public `cake-order-desk-en` directly, and say so at handover.

## 4. Scheduled patrols

Use `nyxid__create_schedule` to create schedules for the order manager, one per report type (patrol, morning report, evening report; the last two only if Settings has a time for them):

- Target: the order manager (not NyxBot). Thread: `dedicated`.
- The instruction is one sentence. Copy it exactly. Do not write a long instruction of your own (the order manager skill decides how reports are written; a long instruction conflicts with the skill and cannot be updated): patrol `Do an order patrol.`, morning report `Do a morning report.`, evening report `Do an evening report.`
- Time: patrols follow Patrol times in Settings, default daily 09:00 and 18:00 (`0 9,18 * * *`). Hourly patrols are `0 9-19 * * *`. Morning and evening reports follow Morning report time and Evening report time in Settings. Time zone follows Settings.
- Delivery `deliver_to`:
  - If the owner has a Telegram (or similar) bot connected to the order manager: use `nyxid__list_channel_chats` to find the owner's private chat with that bot, and deliver there.
  - If not: deliver as a push notification (`push`). The owner reads it in the NyxID mobile app.
- After creating them, read back the next three run times and tell the owner in one sentence. Then run `nyxid__run_schedule_now` once and check that the report arrived.
- When you test a patrol yourself in the background (the result does not reach the owner), use the instruction `Do an order patrol. (Test run: do not write Last patrol.)`. Otherwise the next real patrol treats the updates from this run as old, and the owner misses them.

If the owner later says "change patrols to 8:00 and 20:00 daily" or "pause patrols", use `nyxid__update_schedule`, and update Patrol times in Settings to match.

## 4b. Customer notifications (a NyxBot schedule)

The order manager can only talk in the owner's chat. It cannot reach customers. After the owner quotes, confirms payment or cancels, NyxBot has to send the result back to the customer's chat. Steps:

1. After the customer bot is connected, use `nyxid__update_channel_access` to turn on `private_chat_posts` for that bot, with `apply_to_existing` true.
2. Use `nyxid__create_schedule` to create a schedule for **NyxBot itself**: target NyxBot, thread `dedicated`, no `deliver_to` (the result stays in the web thread and does not disturb the owner), every 15 minutes during business-related hours (for example `*/15 9-21 * * *`, time zone from Settings). Label it `{Shop} | customer notifications (every 15 min)`. Use the instruction below, replacing only the curly-brace parts:

```
Send customer notifications ({Shop}). Read Lookup A1:B1 and the last 300 rows of Orders A:V in order book {Sheet ID}. Find orders whose Source is Telegram, whose Status is Awaiting customer, Awaiting payment, Confirmed or Cancelled, and whose Notes contain neither "Notified: <that status>" nor "Could not notify: <that status>". If there are none, reply only "None". Use nyxid__list_channel_chats to find the private chats of {customer bot}; a chat matches only if its title equals the name after "TG: " in Notes. If none matches, or several have the same name, skip the order and append "(MM-DD HH:mm) Could not notify: <that status>" to Notes. Use nyxid__post_to_chat to send one short notification in the Reply language in Lookup B1 (for Follow customer, judge from this row's Name, Product, Custom notes and Notes: mostly English, send English; mostly Chinese, send Chinese; unclear, send one sentence in English and one in Chinese; language is never a reason not to send). Sound like the shop's front desk, warm and polite: greet the customer by name, give the order # and what the order is (product, size, due date and time, pickup or delivery), and write amounts like S$128. Write by status with this meaning (same tone in Chinese): Awaiting customer "Hi {Name}! The owner has quoted S${Amount} for your order #{Order #} ({Product} {Size}, {Nov 5 14:00} {pickup/delivery}){, including delivery fee S${fee}: delivery orders only}. If that works for you, just reply "Confirm". If you'd like any changes, just tell me 😊", with no payment account; Awaiting payment "Hi {Name}! Order #{Order #} comes to S${Amount}. Please pay by {Payment method} with payment reference "Order {Order #}". Once paid, send me the screenshot. Your order is confirmed as soon as the owner sees the payment."; Confirmed "Hi {Name}! Order #{Order #} is confirmed 🎉 {Nov 5 14:00} {pickup/delivery}. See you then! Tell me anytime if anything changes."; Cancelled "Hi {Name}, order #{Order #} has been cancelled. If you have questions or want to order again, message me anytime.". Say it all in one message, not just the amount. After a successful send, append "(MM-DD HH:mm) Notified: <that status>" to Notes. Only use sheets_update_values on that row's Notes cell; do not use sheets_batch_update_spreadsheet, do not change other columns, and send nothing else.
```

3. After creating it, run `nyxid__run_schedule_now` once. A reply of "None" or a successful notification both pass. If the reply says it did not send, and the reason is not that it could not find the chat, fix the instruction based on the reply and run it again.

Customers who are not on Telegram (for example, who ordered in the NyxID app) get no notification. The next time such a customer sends a message, the customer specialist checks the order's latest status first, as the Role says, and then answers.

## 5. Channels

- Customer specialist: connect the Telegram bot the owner gives customers (see SKILL.md step six). Private chat access must be open to everyone, or customers get "This bot answers only its owner".
- Order manager: optional. If the owner wants patrol reports on Telegram and to reply there to handle them, create a second bot for the owner only and bind it to the order manager. Keep its private chat access limited to the owner.
- After the specialists are built, the owner must first send one message to the customer specialist in the NyxID app. Only then do customer turns work (guest turns reuse the model route the owner set up). Remind the owner at handover.

## 6. Read back

- Both specialists' Roles match the templates character for character, except the shop name and sheet ID (no more than 2048 characters). If one does not match, put the template back, and move any extra shop rules to Settings row 33 and below or to FAQ.
- Customer specialist: `api-google-workspace` guest level `all`, no skill bound.
- Order manager: both `api-google-workspace` and `ornn-api` are there; `ornn-api` allows all read-only operations and no write operations; the only skill is this shop's private order manager skill (`isPrivate` is true). If the private skill is not built, the job is not done; keep building it. Only if it cannot be built, give the reason at handover.
- `nyxid__list_schedules`: the order manager's schedule instructions are the one-sentence ones, with the right times, time zone and delivery. There is also a customer notification schedule that targets NyxBot, and the customer bot's `private_chat_posts` is on.
- Settings Setup status: change it to Live at handover (if the owner says they do not want to take orders yet, keep Building and say so at handover).
- Ask the owner to say "What orders today" to the order manager. If it answers, it can read both the skill and the sheet.
- If anything is missing, fix it before handover.
