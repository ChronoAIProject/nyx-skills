# Notion hub

All pages live under the shared parent page "NyxBot - {business}". Create only the
parts for chosen modules. Notion API version 2022-06-28.

## Pages

- **FAQ** (faq module, also used by queue/reservations for hours): headings
  Hours, Location and contact, Menu, Dietary, Reservations, Queue, Payment,
  Parking and access, Other questions, Sources, Open questions for owner. Each
  fact line ends with "(source, YYYY-MM-DD)".
- **Bot rules**: queue rules (open hours, minutes per party, grace minutes, SMS
  templates), reservation rules (notice, max party, booking window, what to say),
  escalation contact. The front desk reads this when its description is not
  enough.

## Queue database "Queue" (queue module)

- `Name` title
- `Phone` phone_number
- `Party size` number
- `Queue no.` number
- `Status` select: Waiting, Called, Served, No-show, Left
- `Service date` date (date only, business timezone)
- `Joined at` date (with time)
- `Called at` date (with time)
- `Confirmation SMS` checkbox
- `Called SMS` checkbox
- `Source` select: Telegram, Walk-in, Other
- `Notes` rich_text

The customer reference is the last 6 characters of the page ID (unique, created by
Notion; no extra write needed). Queue numbers restart each service date; order is
`Queue no.` ascending, ties by `Joined at`.

## Reservations database "Reservations" (reservations module)

- `Name` title
- `Phone` phone_number
- `Party size` number
- `Dining at` date (with time)
- `Status` select: Pending, Confirmed, Declined, Cancelled, Seated, No-show
- `Requests` rich_text
- `Received at` date (with time)
- `Decided at` date (with time)
- `Source` select: Telegram, Phone, Walk-in, Other
- `Call reference` rich_text (reserved for phone bookings later)
- `Notes` rich_text

The customer reference is "R-" plus the last 4 characters of the page ID.

## Manual fallback

If CMA is unavailable or reports an error it cannot resolve, create the pages
with `{notion slug}__notion_create_page` and each database with
`{notion slug}__notion_create_database` (`parent.page_id` = the shared page,
`title`, and `properties` exactly as above; select options as listed). Then
verify each schema with `__notion_retrieve_database` and list any mismatch
precisely. If the operation is refused, ask the owner to create the databases
in Notion with exactly these properties.
