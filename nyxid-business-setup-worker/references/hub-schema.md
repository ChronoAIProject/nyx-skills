# Hub schema

Keep in sync with nyxid-business-starter references/notion-hub.md.

## Pages

- `FAQ`: headings (heading_2) Hours, Location and contact, Menu, Dietary,
  Reservations, Queue, Payment, Parking and access, Other questions, Sources,
  Open questions for owner.
- `Bot rules`: headings Queue, Reservations, SMS templates, Escalation.

## Database `Queue`

- `Name` title
- `Phone` phone_number
- `Party size` number (format number)
- `Queue no.` number
- `Status` select: Waiting (blue), Called (yellow), Served (green), No-show (red),
  Left (gray)
- `Service date` date
- `Joined at` date
- `Called at` date
- `Confirmation SMS` checkbox
- `Called SMS` checkbox
- `Source` select: Telegram, Walk-in, Other
- `Notes` rich_text

## Database `Reservations`

- `Name` title
- `Phone` phone_number
- `Party size` number
- `Dining at` date
- `Status` select: Pending (yellow), Confirmed (green), Declined (red),
  Cancelled (gray), Seated (blue), No-show (red)
- `Requests` rich_text
- `Received at` date
- `Decided at` date
- `Source` select: Telegram, Phone, Walk-in, Other
- `Call reference` rich_text
- `Notes` rich_text
