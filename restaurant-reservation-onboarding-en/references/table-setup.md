# Table setup rules

Table information is used at two levels:

1. A per-table list, in the Tables tab of the reservations sheet, for front-of-house seating and for the formulas.
2. A table-type summary, computed from Tables by the Lookup formulas: for each day and session, the party range and the free tables (with tags) for each table type. When a guest asks "Do you have a table for 4 tonight?", the specialist reads that day's row to answer, and assigns a table number directly at confirmation. Not written into the Role.

## Per-table list (Tables)

| Column | Header | Content |
|---|---|---|
| A | Table | The owner's table number; if none is given, number by the rules below |
| B | Area | The owner's names for areas (window side, hall, level 2, rooms); if none, group by table type |
| C | Max guests | A number. For rooms, the top of the range |
| D | Kind | `Hall` or `Room` |
| E | Default duration (min) | 90 for 2 to 4 guests, 120 for 6- to 8-seat round tables, 150 for rooms, unless the owner sets otherwise |
| F | Notes | For tables that can be joined, write "Can join X to seat N" |
| G | Table type | `2-seat`, `4-seat`, `6-seat`, `8-seat`, `Small room`, `Large room` and so on. Spell each table type exactly the same way every time. Split rooms into table types by their capacity range; rooms with different ranges cannot share a table type name |
| H | Min guests | A number. Defaults are in `seat-assignment.md`. For rooms, the bottom of the range the owner gives, for example 6 for Small room and 10 for Large room |
| I | Tags | Tags the owner has confirmed, several separated by ", ". Use only these words: window, door, inner, quiet, lively, near kitchen, spacious. Leave empty if the owner has not confirmed |

If the owner gives only a room's maximum and no minimum, ask once: "What is the minimum party size for this room?" If the owner does not answer, set the minimum to half the maximum, rounded up, and list it at handover for the owner to check.

Table numbering rules (when the owner gives none): one letter per table type, followed by a sequence number. 2-seat tables A1, A2…, 4-seat B1…, 6-seat round C1…, 8-seat round D1…. Rooms use the owner's names; if there are none, call them "Small room 1", "Large room 1". Table numbers must be unique within the sheet.

Row 1 of Tables is the header. From row 2, one table per row, no blank rows, rooms last. Note the total table count N; Today needs it.

## Table-type summary (for checking)

Lookup computes the table types and ranges on its own. This summary is only for asking the owner to check the totals in handover item 3. It is not written into the Role:

```
2-seat: 6 tables; 4-seat square: 14 tables (any two can join to seat 8); 6-seat round: 5 tables; 8-seat round: 4 tables;
Small room: 2 rooms (6 to 8 guests); Large room: 3 rooms (10 to 15 guests). Hall seats 130; rooms seat up to 61.
Party range per table type: 2-seat 1–2, 4-seat 1–4, 6-seat round 4–6, 8-seat round 6–8, Small room 6–8, Large room 10–15.
```

Total seats = the sum of table count × seats for each table type. Write "can be joined" details into column F (Notes) of Tables; the desk skill (`restaurant-reservation-desk-en`) reads it when the owner says "join tables".

## If the owner gives only a total seat count

Ask once for the count of each table type. If the owner cannot answer, suggest a mix based on what is usual for the cuisine and have the owner confirm it (for home-style Chinese food, mostly 4-seat tables, with a few 2-seat tables and 6- to 8-seat round tables). Build the sheet only after confirmation. Do not decide for the owner without asking.

## No private rooms

Tables has no room rows. Do not create the room booking calendar. Leave Room calendar ID in Settings empty. Remove the room table types from the Bookings "Table type" dropdown.
