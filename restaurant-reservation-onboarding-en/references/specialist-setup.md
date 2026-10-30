# Create the reservation specialist

The last part of onboarding happens in NyxID, with NyxBot's own native tools (create specialist, update specialist, set skills, set channels). For every action that shows a confirmation card, let the owner confirm. Do not work around it.

## 1. Check for duplicates

First list the existing specialists. If there is already a reservation specialist for the same store (same store name), update its Role, grants and skills instead of creating a second one. A reservation specialist for a different store is not a duplicate: create a new one as usual and leave the other alone.

## 2. Create the specialist

- Name: the name the owner chose; otherwise "{Store} Reservation Assistant".
- Role: the fixed template in `role-snippet.md`, with only the store name and reservation sheet ID filled in and nothing else changed (about 2040 characters; the limit is 2048). Guest turns cannot read skills, so the guest flow lives in the Role and the store rules live in Settings.
- Persona: one or two sentences on tone and language habits, no rules.

If creating the specialist fails, read the failure reason: if it says quota or permission is missing, tell the owner exactly that and stop at this step, keeping the files already built. Do not keep retrying with a different tool.

## 3. Grant Google Workspace

Grant the specialist `api-google-workspace`. The default is auto-confirm, so set guest (customer) access to `all`: guest turns append booking rows and also change their own row when a guest reschedules or cancels; changing an existing row needs `all` (appending alone works under `use` since NyxID 0.74.0).

The guest access level is a field on the grant (`guest_access`). It is separate from the "operation scope" below and needs no endpoint IDs. Set the guest access level first, then handle the operation scope. Even if the operation scope is not finished, do not leave guest access at `use`.

| Owner's rule | Guest access | Needs approval in Settings |
|---|---|---|
| Default: confirm automatically when there is availability | `all` | None |
| A certain kind of booking needs the owner's review first (e.g. rooms) | `all` | That kind, e.g. "Rooms", "8+ guests"; everything else is still confirmed automatically |
| The owner clearly says every booking needs their confirmation | `all` | All (every booking is recorded as Pending and changes to Confirmed only after the owner says "approve") |

### Operation scope (required)

After the service is granted, which endpoints the specialist can call on owner turns is also limited by its "operation scope". NyxBot often sets a very narrow scope when creating a specialist (e.g. only a few Sheets endpoints), and then calendar writes fail. Use `get_agent_operations` to read the specialist's scope on `api-google-workspace`, and use `set_agent_operations` to set it to the following (the owner's confirmation card appears as usual). Both owner turns and guest turns must include them:

| Purpose | Endpoints |
|---|---|
| Read sheets | `GET /v4/spreadsheets/{spreadsheetId}`, `GET /v4/spreadsheets/{spreadsheetId}/values/{range}` |
| Write sheets | `PUT /v4/spreadsheets/{spreadsheetId}/values/{range}`, `POST /v4/spreadsheets/{spreadsheetId}/values/{range}:append` |
| Private-room calendar (when there are rooms) | `GET`, `POST /calendar/v3/calendars/{calendarId}/events`; `GET`, `PATCH`, `DELETE /calendar/v3/calendars/{calendarId}/events/{eventId}` |

Do not open deleting sheets, clearing, creating or deleting calendars, or Drive file operations. After setting, read it again and confirm all these endpoints are there.

If it already reads back as "all endpoints" (`all_operations` is true), every endpoint needed is there and it works. If you want to narrow it to the table above but cannot get exact endpoint IDs (list truncated, no paging), keep all endpoints. Do not stop or skip other steps for this; in delivery point 2 write one line: "The operation scope is currently all endpoints, broader than needed."

In the delivery, mention once: guest turns can write to sheets in this Google account, and for long-term use the restaurant should switch to a dedicated restaurant account. This is only a reminder, not a reason to downgrade; do not switch to passing bookings to the owner because of it.

## 4. Bind the operations skill

For the specialist to read its bound skill, it must first be granted the Ornn service (`ornn-api`); otherwise `skill_read` fails and the owner's seated, left, move-table and other commands depend on the Role alone. When granting:

- The grant list includes both `api-google-workspace` and `ornn-api` (grants replace the whole list, so do not drop the former and do not change its guest access level).
- The owner-turn operation scope of `ornn-api` opens only read-only endpoints (read the operation list; those with `read_only` true).
- Set guest access on `ornn-api` to `read`. Guest turns cannot read skills anyway, so no higher level is needed.


Use `search_agent_skills` to find `restaurant-reservation-desk-en`, `preview_agent_skill` to confirm it is the skill with that name, then copy it into the store's private skill per `private-desk.md` section 1, and use `set_agent_skills` to bind the private skill to the reservation specialist (the target is the specialist's ID, not NyxBot). Bind the latest version of the public template directly only if the copy fails.

The Role template already contains the sentence that hands off to the desk skill (it works for both the public and the private version). Do not add it again.

Do not write a separate skill for table operations.

## 5. Channels

Bind channels to the reservation specialist; see SKILL.md Step 6.

## 6. Read back

- List the specialist: name; Role differs from the template only in store name and sheet ID; total characters (no more than 2048); grants include `api-google-workspace`; skills contain only the store's private desk skill (`isPrivate` true), or, if the copy failed, the latest version of `restaurant-reservation-desk-en`.
- Read guest access: the level on `api-google-workspace` matches the table in section 3.
- Read the operation scope (once for owner turns and once for guest turns): read only the `api-google-workspace` service and check it against the "Operation scope" table in section 3 one by one; the sheet read/write and calendar event endpoints must all be there. For `ornn-api`, do not expand the whole operation list (it has more than 70 entries and the result gets truncated); just check that it does not open all operations and has more than 0 entries.
- Have the owner say to the specialist "What bookings do we have today?": a normal answer means the specialist can read the desk skill; if it answers "missing Ornn access", go back to section 4 and add the grant.
- If anything is missing, add it before delivering.
