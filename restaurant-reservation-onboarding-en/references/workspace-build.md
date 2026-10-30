# Building the files in Google Workspace

Tool names follow the `api-google-workspace` service bound in NyxID (for example `api-google-workspace__drive_create_file`). Only the fields are listed below. Copy the JSON snippets as they are and replace the curly-brace parts. For every write, create first, then fill, then read back.

There are two coordinate systems. `sheets_get_values` and `sheets_update_values` use A1 notation (`'Bookings'!A1`). `sheets_batch_update_spreadsheet` uses the numeric `sheetId` and zero-based, end-exclusive row and column indexes (rows 2 to 36 are `startRowIndex: 1, endRowIndex: 36`). Colors use `red`, `green`, `blue` from 0 to 1.

## 1. Folder

Check first: `drive_list_files`, with `q` set to `mimeType = 'application/vnd.google-apps.folder' and title contains '{Store}' and trashed = false` and `fields` set to `files(id,name)`. If anything comes back, stop and ask the owner.

Create: `drive_create_file`, `name` `{Store} Restaurant`, `mimeType` `application/vnd.google-apps.folder`, `fields` `id,name,webViewLink`. Note the folder ID.

## 2. Menu sheet

Create: `drive_create_file`, `name` `{Store} Menu`, `mimeType` `application/vnd.google-apps.spreadsheet`, `parents` `["{folder ID}"]`. The first sheet of a new spreadsheet has `sheetId` 0.

Fill: `sheets_update_values`, `range` `A1`, `valueInputOption` `USER_ENTERED`. The first row of `body.values` is the header `No., Category, Dish, Size / Unit, Price (SGD), Notes`, then one row per dish. Write the number and the price as numbers and empty values as `""`. Over 300 rows, write in chunks.

Formatting (one `sheets_batch_update_spreadsheet`, with these `requests` in order):
- `updateSheetProperties`: `properties.sheetId` 0, `title` `Menu`, `gridProperties.frozenRowCount` 1, `fields` `title,gridProperties.frozenRowCount`.
- `updateSpreadsheetProperties`: `properties.timeZone` `Asia/Singapore`, `locale` `en_SG` (or the owner's English locale), `fields` `timeZone,locale`.
- `repeatCell` for the header: row 1, A to F. `cell.userEnteredFormat` is a dark blue background (0.122, 0.22, 0.392), white bold text, centered. `fields` is `userEnteredFormat.backgroundColor,userEnteredFormat.horizontalAlignment,userEnteredFormat.textFormat.bold,userEnteredFormat.textFormat.foregroundColor`.
- `repeatCell` for the price column: column E from row 2 to the last row, `numberFormat` `{"type":"NUMBER","pattern":"$#,##0.00"}`, `fields` `userEnteredFormat.numberFormat`.
- `setBasicFilter`: `filter.range` covers A1 to F on the last row.
- `updateCells` for the note: `rows` `[{"values":[{"note":"Source: …"}]}]`, `fields` `note`, `start` `{"sheetId":0,"rowIndex":0,"columnIndex":0}`.
- `updateDimensionProperties` for column widths: A and B 70, C 200, D 260, E 100, F 260 (`range.dimension` `COLUMNS`, `properties.pixelSize`, `fields` `pixelSize`).

## 3. Restaurant info doc

Create: `drive_create_file`, `name` `{Store} Restaurant Info`, `mimeType` `application/vnd.google-apps.document`, `parents` the folder ID.

Read: `docs_get_document`, `fields` `revisionId`. The body of a new document starts at index 1.

Write (one `docs_batch_update_document`, with `writeControl.requiredRevisionId`):
1. `insertText`: `location.index` 1, `text` is the whole body. Separate paragraphs with newlines. Do not end with a newline. Paragraph order: the title "{Store} Restaurant Info"; "Basic info"; store name, cuisine, address, phone, opening hours (lunch and dinner), languages used, date last updated; "Seating plan"; one paragraph for table-type stock, one for rooms, one for total seats; "Linked files"; one line each for the menu sheet, the reservations sheet, the room booking calendar and the Drive folder.
2. `updateParagraphStyle` on the title paragraph with `namedStyleType` `TITLE`, and on the three section names with `HEADING_1`. `fields` is `namedStyleType,keepWithNext`. Add up paragraph ranges by UTF-16 length: each paragraph's `endIndex` is the previous `endIndex` plus this paragraph's character count plus 1 (the newline). Each Chinese character counts as 1.
3. `updateTextStyle` on the four linked-file lines, with `textStyle.link.url` set to the matching link. The range excludes the newline. `fields` is `link`.

Do not write other branches' phone numbers from the menu, takeaway charges, GST notes or promo lines.

## 4. Reservations sheet

Create: `drive_create_file`, `name` `{Store} Reservations`, `mimeType` spreadsheet, `parents` the folder ID.

### 4.1 Structure (one batch)

- `updateSheetProperties`: rename sheetId 0 to `Bookings`, freeze 1 row.
- `addSheet`: `properties` `{"sheetId":1,"title":"Tables","gridProperties":{"frozenRowCount":1}}`.
- `addSheet`: sheetId 2, `Today`, freeze 4 rows.
- `addSheet`: sheetId 3, `Capacity`, freeze 3 rows.
- `addSheet`: sheetId 4, `Guide`.
- `addSheet`: sheetId 5, `Settings`, freeze 1 row.
- `addSheet`: sheetId 6, `Lookup`, freeze 2 rows.
- `updateSpreadsheetProperties`: time zone and locale, same as the menu sheet.

### 4.2 Tables (sheetId 1)

`sheets_update_values` to `'Tables'!A1`: the header `Table, Area, Max guests, Kind, Default duration (min), Notes, Table type, Min guests, Tags`, then one row per table as in `table-setup.md`. Note the table count N. Data fills rows 2 to N+1.

### 4.3 Bookings (sheetId 0)

`sheets_update_values` to `'Bookings'!A1`, two rows:

Header: `Date, Session, Table, Name, Phone, Party size, Table type, ETA, Duration (min), Est. leave, Arrived at, Left at, Deposit, Source, Status, Notes, Entered by, Special requests, Occasion`

Sample row: `2026-11-01, Dinner, {a 4-seat table number}, Mr Wang (sample), '9123 4567, 4, 4-seat, 18:00, 90, =ARRAYFORMULA(IF(LEN(H2:H)*LEN(I2:I), H2:H+I2:I/1440, )), 18:05, 19:20, Waived, Phone, Completed, Sample row; you may clear it but keep the J formula, {owner name}, One child needs a high chair, Birthday`

Put a straight single quote before the phone number to keep the leading 0 and the spaces. The array formula in J2 fills Est. leave for the whole column. Columns R and S go last so columns A to Q keep their positions. If the owner turned one of them off, still create it; the specialist just does not ask.

### 4.4 Today (sheetId 2)

`sheets_update_values` to `'Today'!A1`, five rows:

```
Board date        | =TODAY() |  | Change the date to see that day
Now        | =NOW()   |  | In File › Settings › Calculation, set recalculation to "On change and every minute"
Walk-in minimum (min) | 90   |  | When the next arrival is fewer than this many minutes away, show "Held"
Table | Area | Seats | Status | Seated (min) | Next arrival | Next party | Walk-in OK? | Helper: dining count | Helper: next (time) | Helper: seated (time)
Row 5 formulas (see below)
```

Row 5, A to K:

```
A5  ='Tables'!A2
B5  =VLOOKUP($A5,'Tables'!$A:$C,2,FALSE)
C5  =VLOOKUP($A5,'Tables'!$A:$C,3,FALSE)
D5  =IF($I5>0,"Dining",IF(AND($J5>0,($J5-MOD(NOW(),1))*1440<$B$3),"Held","Free"))
E5  =IF($I5>0,INT((MOD(NOW(),1)-$K5)*1440),"")
F5  =IF($J5>0,TEXT($J5,"HH:mm"),"None")
G5  =IF($J5>0,SUMIFS('Bookings'!$F:$F,'Bookings'!$A:$A,$B$1,'Bookings'!$C:$C,$A5,'Bookings'!$H:$H,$J5,'Bookings'!$O:$O,"Confirmed"),"")
H5  =IF($D5<>"Free","No",IF($J5>0,"Free, leave by "&TEXT($J5-TIME(0,15,0),"HH:mm"),"Free"))
I5  =COUNTIFS('Bookings'!$A:$A,$B$1,'Bookings'!$C:$C,$A5,'Bookings'!$K:$K,"<>",'Bookings'!$L:$L,"")
J5  =MINIFS('Bookings'!$H:$H,'Bookings'!$A:$A,$B$1,'Bookings'!$C:$C,$A5,'Bookings'!$O:$O,"Confirmed",'Bookings'!$H:$H,">"&MOD(NOW(),1))
K5  =MAXIFS('Bookings'!$K:$K,'Bookings'!$A:$A,$B$1,'Bookings'!$C:$C,$A5,'Bookings'!$L:$L,"")
```

Then, in a batch, use `copyPaste` to copy row 5 to rows 6 through N+4: `source` `{"sheetId":2,"startRowIndex":4,"endRowIndex":5,"startColumnIndex":0,"endColumnIndex":11}`, `destination` `{"sheetId":2,"startRowIndex":5,"endRowIndex":{N+4},"startColumnIndex":0,"endColumnIndex":11}`, `pasteType` `PASTE_FORMULA`. Relative references shift down on their own.

### 4.5 Capacity (sheetId 3)

This is the capacity view for the owner. Change the date in B1 to check another day. The specialist neither reads nor edits this tab; it reads the Lookup tab in 4.9. Column A of this tab (table types) is where Lookup gets its table types. `sheets_update_values` to `'Capacity'!A1`:

```
Date | =TODAY() |  | Change the date to check another day
(blank row)
Table type | Stock | Lunch booked | Lunch left | Dinner booked | Dinner left
2-seat | =COUNTIF('Tables'!$G:$G,$A4) | C4 formula | =B4-C4 | E4 formula | =B4-E4
4-seat | same formula | … | … | … | …
6-seat | same formula | … | … | … | …
8-seat | same formula | … | … | … | …
Small room | same formula | … | … | … | …
Large room | same formula | … | … | … | …
```

Column A has one table type per row: every table type that appears in column G of Tables, from smallest to largest, rooms last. The row count follows the restaurant's actual table types; call it T. Then write "Party range" in H3, and in H4 write `=MINIFS('Tables'!$H:$H,'Tables'!$G:$G,$A4)&"–"&MAXIFS('Tables'!$C:$C,'Tables'!$G:$G,$A4)`, so that anyone reading the capacity also sees how many guests each table type seats.

```
```

C4 (Lunch booked):
```
=COUNTIFS('Bookings'!$A:$A,$B$1,'Bookings'!$B:$B,"Lunch",'Bookings'!$G:$G,$A4,'Bookings'!$O:$O,"Confirmed")+COUNTIFS('Bookings'!$A:$A,$B$1,'Bookings'!$B:$B,"Lunch",'Bookings'!$G:$G,$A4,'Bookings'!$O:$O,"Arrived")+COUNTIFS('Bookings'!$A:$A,$B$1,'Bookings'!$B:$B,"Lunch",'Bookings'!$G:$G,$A4,'Bookings'!$O:$O,"Dining")+COUNTIFS('Bookings'!$A:$A,$B$1,'Bookings'!$B:$B,"Lunch",'Bookings'!$G:$G,$A4,'Bookings'!$O:$O,"Pending")
```
E4 is the same with `"Lunch"` replaced by `"Dinner"` (the session text must match the Session dropdown in Bookings exactly; do not point it at the header cell, which says "Lunch booked" and would never match). Then write "Lunch free tables" and "Dinner free tables" in I3 and J3. Put the formula below in I4; in J4 replace its `"Lunch"` with `"Dinner"`:

```
=IFERROR(TEXTJOIN(", ",TRUE,FILTER('Tables'!$A$2:$A,'Tables'!$G$2:$G=$A4,ISNA(MATCH('Tables'!$A$2:$A,FILTER('Bookings'!$C$2:$C,'Bookings'!$A$2:$A=$B$1,'Bookings'!$B$2:$B="Lunch",REGEXMATCH('Bookings'!$O$2:$O&"","^(Pending|Confirmed|Arrived|Dining)$")),0)))),"None")
```

It lists the tables of this type that are not yet taken in that session on the B1 date. After B4 to F4 and H4 to J4 are written, use `copyPaste` to copy them to rows 5 through T+3. Table type names must match the Bookings "Table type" dropdown exactly. For restaurants with two dinner seatings, split "Dinner" into two column groups, "Dinner 1" and "Dinner 2", and add both to the Session dropdown.

### 4.6 Guide (sheetId 4)

One column of text, one item per row. Content follows the Step 1 group D rules in SKILL.md, plus: what each of the six tabs is for (Bookings, Tables, Today, Capacity, Settings, Lookup); to change a rule, edit only column B of Settings (it takes effect from the next booking, no need to ask the specialist); Lookup is all formulas, do not edit it by hand; how to fill each Bookings column; the statuses (Pending, Confirmed, Arrived, Dining, Completed, No-show, Cancelled); what the red double-booking highlight means; the Today colors; how to change the Tags in Tables; room bookings sync to the room booking calendar; the few phrases the owner uses with the specialist day to day; check table turnover and average dining time each week. Column A width 900, wrap text.

### 4.7 Formatting, dropdowns, conditional formatting (one batch)

- The four header rows (Bookings row 1 A to S, Tables row 1 A to I, Today row 4 A to K, Capacity row 3 A to J): same dark blue, white bold text as the menu sheet. Add `wrapStrategy: WRAP` to the Bookings and Today headers.
- Bookings number formats: column A `DATE` `yyyy-mm-dd`; columns H, J, K, L `TIME` `HH:mm`; column E `TEXT`. Range is rows 2 to 1000.
- Today: B1 `DATE`, B2 `TIME` `HH:mm`, columns J and K `TIME`. B1 and B3 in blue font (inputs). Columns I to K in gray font, collapsed with `addDimensionGroup`.
- `setDataValidation` (all on Bookings rows 2 to 1000, `showCustomUi: true`):
  - B Session `ONE_OF_LIST`: Lunch, Dinner (restaurants with two seatings change it as in 4.5).
  - C Table `ONE_OF_RANGE`: `='Tables'!$A$2:$A${N+1}`.
  - G Table type `ONE_OF_LIST`: exactly the table types in column A of Capacity (for example 2-seat, 4-seat, 6-seat, 8-seat, Small room, Large room). Write the table type actually assigned, not the guest's words.
  - I Duration `ONE_OF_LIST`: 60, 90, 120, 150, 180.
  - M Deposit `ONE_OF_LIST`: Unpaid, Paid, Waived.
  - N Source `ONE_OF_LIST`: Telegram, WhatsApp, NyxID, Phone, Walk-in (add or remove to match the owner's channels; any value the specialist writes must be in the list).
  - O Status `ONE_OF_LIST`, `strict: true`: Pending, Confirmed, Arrived, Dining, Completed, No-show, Cancelled. "Pending" is used only when the owner wants to review a kind of booking first. It counts as a taken table.
- `addConditionalFormatRule` (Bookings A2 to S1000, `CUSTOM_FORMULA`):
  - Double booking in red: `=AND($C2<>"",$H2<>"",COUNTIFS($A:$A,$A2,$C:$C,$C2,$H:$H,"<"&$J2,$J:$J,">"&$H2)>1)`, background (0.96, 0.8, 0.8).
  - Dining: `=$O2="Dining"`, background (0.85, 0.94, 0.83).
  - No-show or Cancelled: `=OR($O2="No-show",$O2="Cancelled")`, gray font (0.6, 0.6, 0.6).
- Today D5 to D{N+4}, `TEXT_EQ`: Dining green background (0.72, 0.88, 0.7), Held yellow background (1, 0.9, 0.6), Free blue background (0.8, 0.89, 0.97), all bold.
- Column widths: Bookings default 95, Name 130, Notes 260, Special requests 220, Occasion 110; Tables 120, Notes 240, Table type 100, Min guests 90, Tags 160; Capacity 110, the two free-tables columns 260 each; Today default 110, Table 170, Status 170, Walk-in OK? 220.

### 4.8 Settings (sheetId 5)

All store facts and rules live here. The specialist reads them once per booking (through B1 in 4.9). From now on the owner changes rules only in column B. `sheets_update_values` to `'Settings'!A1`, with `valueInputOption` `RAW` (so the "–" in opening hours and the numbers are not read as formulas or dates):

| A Setting | B Value | C Default (used when B is empty) | D Notes |
|---|---|---|---|
| Store name | {Store} | | |
| Address | {address} | | |
| Phone | {phone} | | |
| Time zone | {tz} | {tz} | |
| Closed days | {closed days from Step 1 group D; "None" if there are none} | None | Weekday names, e.g. "Monday"; several separated by ", " |
| Lunch | {e.g. 11:00–16:59} | | Arrival times in this range count as Lunch |
| Dinner | {e.g. 17:00–23:00} | | Arrival times in this range count as Dinner |
| Time limit | {No limit or Timed} | No limit | No limit: one party per table per session; Timed: turn tables by default duration |
| Default duration | {e.g. 2–4 guests 90 min; 6–8 guests 120 min; rooms 150 min} | 2–4 guests 90 min; 6–8 guests 120 min; rooms 150 min | Written to Bookings column I |
| Deposit | {None or the rule} | None | e.g. "S$100 per room" |
| Ask special requests | {Yes/No} | Yes | Yes or No |
| Ask occasion | {Yes/No} | Yes | Yes or No |
| Occasion perks | {e.g. Birthday: free longevity noodles; leave empty if none} | None | e.g. "Birthday: free longevity noodles" |
| Large room for small parties | {No or Yes: condition} | No | No; or "Yes: minimum spend S$500" |
| Needs approval | {None or the categories} | None | Bookings the owner reviews first, e.g. "Rooms", "8+ guests"; everything else is confirmed automatically |
| Room calendar ID | {calendar ID from section 5; leave empty if there are no rooms} | | Empty means no room calendar |
| Menu sheet ID | {menu sheet ID, or leave empty} | | Empty means menu questions are not answered |

Keep the rows in the order above; section 5 writes the calendar ID into B17 by row number. The specialist and the desk skill (`restaurant-reservation-desk-en`) look values up by key, so rows the owner adds later do not affect them. Convert Lunch and Dinner from the Step 1 group D opening hours into arrival-time ranges. Restaurants open all day still get two ranges (split at 17:00 by default); do not merge them into one. With No limit, each table takes one party per session, so a single merged range would mean each table can be booked only once a day. Only a restaurant that truly opens for lunch only or dinner only writes "Closed" in the other row. Formatting: header in dark blue, white bold text; column A width 130, B 420, C 260, D 360; wrap text in B and D; column B background light yellow (1, 0.97, 0.8) to show it is editable; column C in gray font.

### 4.9 Lookup (sheetId 6)

This is the only place the specialist reads. Row 1 flattens Settings into one cell. From row 3 there is one row per day for the next 60 days, one column per session, listing the free tables and their tags by table type. In one round the specialist reads `A1:B1` and that day's `A{n}:D{n}` in parallel (n = days between that day and today + 3). It does not edit any cell.

First use `sheets_update_values` (`USER_ENTERED`) to write rows 1 to 3:

```
A1  Settings
B1  =TEXTJOIN("; ",TRUE,ARRAYFORMULA(IF('Settings'!A2:A40="","",'Settings'!A2:A40&"="&IF('Settings'!B2:B40="",'Settings'!C2:C40,'Settings'!B2:B40))))
A2  Date    B2  Weekday    C2  Lunch free tables (table[tags])    D2  Dinner free tables (table[tags])
A3  =TODAY()
B3  =TEXT(A3,"dddd")
```

C3 (Lunch):

```
=TEXTJOIN("; ",TRUE,MAP(FILTER('Capacity'!$A$4:$A$20,'Capacity'!$A$4:$A$20<>""),LAMBDA(t,t&" ("&MINIFS('Tables'!$H:$H,'Tables'!$G:$G,t)&"–"&MAXIFS('Tables'!$C:$C,'Tables'!$G:$G,t)&" guests): "&IFERROR(TEXTJOIN(", ",TRUE,FILTER('Tables'!$A$2:$A&IF('Tables'!$I$2:$I<>"","["&'Tables'!$I$2:$I&"]",""),'Tables'!$G$2:$G=t,'Tables'!$A$2:$A<>"",ISNA(MATCH('Tables'!$A$2:$A,FILTER('Bookings'!$C$2:$C,TEXT('Bookings'!$A$2:$A,"yyyy-mm-dd")=TEXT($A3,"yyyy-mm-dd"),'Bookings'!$B$2:$B="Lunch",REGEXMATCH('Bookings'!$O$2:$O&"","^(Pending|Confirmed|Arrived|Dining)$")),0)))),"Full"))))
```

In D3, replace `"Lunch"` with `"Dinner"`. Both sides of the date comparison use `TEXT(…,"yyyy-mm-dd")` because the specialist sometimes writes a date into Bookings as text (RAW write). A plain `=` comparison would then miss it, the table would keep showing as free, and the result is a double booking. Write `=A3+1` in A4. Then one batch with two `copyPaste` requests (`PASTE_FORMULA`): A4 to A5:A62 (`source` `{"sheetId":6,"startRowIndex":3,"endRowIndex":4,"startColumnIndex":0,"endColumnIndex":1}`, `destination` with `startRowIndex` 4 and `endRowIndex` 62); B3:D3 to B4:D62 (`source` rows 2 to 3, columns 1 to 4; `destination` rows 3 to 62, columns 1 to 4).

A resulting cell looks like this: `2-seat (1–2 guests): A01[window], A02; 4-seat (3–4 guests): B01, B02[quiet]; Small room (6–8 guests): Full`. Table types come from column A of Capacity, smallest to largest, rooms last. Party ranges come from columns H and C of Tables. For restaurants with two dinner seatings, column D becomes "Dinner 1", add "Dinner 2" in column E, change the session text in the formulas to match, and change the read range in the Role to `A{n}:E{n}`.

Formatting: column A `DATE` `yyyy-mm-dd`; header row 2 in dark blue, white bold text; column A width 100, B 80, C and D 600 with text wrap; B1 in gray font, no wrap.

## 5. Room booking calendar

Create it only if the restaurant has private rooms. `calendar_create_calendar`: `summary` `{Store} Private Rooms`, `timeZone` the owner's time zone, `location` the restaurant address, `description` the event title format "arrival time, name, party size, room name" and how many guests each room seats. Note the returned calendar ID and write it to `'Settings'!B17` (Room calendar ID) and to the Linked files in the restaurant info doc. The specialist and the desk skill both take this ID from Settings; it is not written in the Role.

## 6. Checklist

- `sheets_get_values` on `'Menu'!A1:F3` and the last three rows; check the row count.
- Read `'Today'!A1:H8`: B2 shows the owner's local time (the time zone is set right); from row 5 the table numbers come from Tables; status is "Free".
- Read `'Bookings'!A1:S2`: J2 shows 19:30.
- Read `'Capacity'!A3:J`: the Stock column equals the count of each table type in Tables; party ranges match Tables; Small room and Large room are on separate rows; columns I and J list every table (a new sheet has no bookings). B1 is `=TODAY()`.
- Read `'Settings'!A1:D18`: all 17 settings are there; column B matches the owner's answers to Step 1 group D; if there are rooms, B17 is the calendar ID.
- Read `'Lookup'!A1:D4`: B1 is a string of "Key=Value" items separated by "; ", and empty settings show the column C default. A3 is today and A4 is tomorrow. C3 and D3 show a party range and every table for each table type, with tags in square brackets, and no "#NAME?" or "#ERROR!". Then read `A62`: it is today plus 59 days.
- `docs_get_document` (`fields` `body.content.paragraph.paragraphStyle.namedStyleType,body.content.paragraph.elements.textRun.content`): one TITLE and three HEADING_1.
- `calendar_list_calendars`: the new calendar is in the list.

## 7. Common failures

| Symptom | Cause | Fix |
|---|---|---|
| `Unable to parse range` | Wrong tab name, or the tab is not created yet | Run the 4.1 batch first, then write values |
| Today is off from local time by a few hours | Time zone not set | Add `updateSpreadsheetProperties` |
| Every status is "Free" but people are dining | Arrived at not filled, or walk-ins not entered | The Guide already says so; remind the owner at handover |
| `ONE_OF_RANGE` dropdown is empty | Range written as `A2:A` with no end row, or the Tables tab has a different name | Use `$A$2:$A${N+1}` |
| A write gets cut off | Too many rows | Write in chunks of at most 300 rows |
| "11:00–16:59" in Settings turned into a decimal or date | `USER_ENTERED` was used | Rewrite column B with `RAW` as in 4.8 |
| Lookup shows a free table on a day that is actually full | The session text in Bookings column B does not match "Lunch"/"Dinner" in the formulas, or a status is misspelled | Pick sessions and statuses from the dropdowns; do not type them |
| A row in Bookings is booked but Lookup still shows that table as free | That row's date is text (RAW write) and an old formula compared with `=` | Use the TEXT comparison formula in 4.9; rewrite that row's column A as a date with USER_ENTERED |
| A whole Lookup cell shows "Full" | Table type names in column G of Tables do not match column A of Capacity | Change both to the same name |
