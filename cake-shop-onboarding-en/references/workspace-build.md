# Building the files in Google Workspace

There are two coordinate systems. `sheets_get_values` and `sheets_update_values` use A1 notation (`'Orders'!A1`). `sheets_batch_update_spreadsheet` uses the numeric `sheetId` and zero-based, end-exclusive row and column indexes. Colors use `red`, `green`, `blue` from 0 to 1.

## 1. Folder

First look for a folder with the same name (`name = '{Shop} Shop Management' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`). If one exists, stop and ask the owner whether to reuse it or create a new one. If not, use `drive_create_file` to create `{Shop} Shop Management`, with `mimeType` `application/vnd.google-apps.folder`.

## 2. Shop info doc

Use `drive_create_file` to create `{Shop} Shop Info` (`application/vnd.google-apps.document`, `parents` set to the folder ID). Then write it with `docs_batch_update_document`. Structure:

- TITLE: `{Shop} Shop Info`
- First paragraph under the title: "Note: the two assistants do not read this document. They read only the order book. To change hours, address, rules or products, change the order book (or tell NyxBot); it takes effect at once. This document is a human-readable record."
- HEADING_1 "Basics": shop name, address, phone or WhatsApp, website or social media, opening hours, pickup hours, closed days, date last updated.
- HEADING_1 "Order rules": lead days, daily order limit, custom order process, deposit and payment method, delivery areas and fees, allergen note, change and cancel policy. Write only what the owner has confirmed.
- HEADING_1 "Linked files": the order book (with a link) and the folder name.

## 3. Order book

Use `drive_create_file` to create `{Shop} Order Book` (spreadsheet, `parents` set to the folder ID). All tabs live in this one file. The customer specialist and the order manager only use this one spreadsheet ID.

### 3.1 Structure (one batch)

- `updateSheetProperties`: rename sheetId 0 to `Orders`, freeze 1 row.
- `addSheet`: sheetId 1 `Products`, freeze 1 row.
- `addSheet`: sheetId 2 `Settings`, freeze 1 row.
- `addSheet`: sheetId 3 `Lookup`, freeze 2 rows.
- `addSheet`: sheetId 4 `Guide`.
- `addSheet`: sheetId 5 `FAQ`, freeze 1 row.
- `addSheet`: sheetId 6 `Setup Log`, freeze 1 row.
- `updateSpreadsheetProperties`: `timeZone` set to the owner's time zone (Singapore is `Asia/Singapore`), `locale` set to `en_US`, `fields` set to `timeZone,locale`.

### 3.2 Orders (sheetId 0)

`sheets_update_values` to `'Orders'!A1` (`USER_ENTERED`). Header A to V:

`Order #, Ordered at, Due date, Due time, Method, Delivery address, Name, Phone, Type, Product, Size, Flavor, Qty, Message on cake, Custom notes, Allergies & diet, Amount, Deposit, Deposit status, Status, Source, Notes`

Row 2 is a fixed **sample row**. B2 says "Sample row: do not delete. Orders start at row 3; order # = row − 2". Leave the other cells empty. A1 does not hold the text "Order #". It holds `={"Order #";"Sample";ARRAYFORMULA(IF(B3:B="","",ROW(B3:B)-2))}`. The header shows "Order #", row 2 shows "Sample", orders start at row 3, and the order # is the row number minus 2 (#1 is on row 3). Never write anything into A2 or below. When appending a row, pass `null` for column A.

Why the sample row: when a customer turn appends an order, the platform "inserts a new row". The new row goes after the last row of the table and takes that row's format. Without a sample row, the first order lands on row 2. It takes the header's dark blue background and white text. It also pushes the dropdown and format ranges that start at row 2 down as a block, so the new row falls outside them and has no dropdowns. With a sample row (plain format), new orders always go after it and land inside the ranges. Do not delete the sample row, and do not give it the header format. Its status column is empty, so it does not count as an order.

Column values:

| Column | Content |
|---|---|
| B Ordered at | `yyyy-mm-dd HH:mm`, now in the shop's time zone |
| C Due date, D Due time | `yyyy-mm-dd`, `HH:mm`; for pickup, the pickup time; for delivery, the start of the delivery slot |
| E Method | `Pickup` or `Delivery` |
| I Type | `Standard` or `Custom` |
| Q Amount, R Deposit | Numbers; leave empty for custom orders before the quote |
| S Deposit status | `Unpaid`, `Paid`, `Waived` |
| T Status | `Awaiting quote`, `Awaiting customer`, `Pending review`, `Awaiting payment`, `Confirmed`, `In production`, `Ready for pickup`, `Out for delivery`, `Completed`, `Cancelled` |
| U Source | Only a value from the dropdown: `Telegram`, `WhatsApp`, `NyxID`, `Phone`, `Walk-in`. Never a web address or other text |
| V Notes | Telegram orders always start with `TG: <customer display name>` (test orders: `TEST ORDER; TG: …`); the notifications task uses it to find the customer. Later customer requests, reschedules, notification records and so on are appended; never overwrite |

Formatting (one batch): only row 1 gets the header format (dark blue background (0.122, 0.22, 0.392), white bold text, wrap). Row 2 (the sample row) and below stay in plain format, row height 24. Column B `DATE_TIME` `yyyy-mm-dd HH:mm`, column C `DATE` `yyyy-mm-dd`, column D `TIME` `HH:mm`, column H `TEXT`, columns Q and R `$#,##0.00` (range rows 2 to 3000, including the sample row). `setDataValidation` (rows 2 to 3000, including the sample row, `showCustomUi: true`): dropdowns for E, I, S, T and U as in the table above. The T list must include `Awaiting payment`. Conditional formatting (rows 3 to 3000): when T is `Awaiting quote`, `Awaiting customer`, `Pending review` or `Awaiting payment`, the whole row gets a light yellow background (1, 0.95, 0.75); when T is `Cancelled`, the whole row gets gray text (0.6, 0.6, 0.6). Column width 100 by default; Product 160; Custom notes and Notes 260.

### 3.3 Products (sheetId 1)

Header A to K: `Code, Category, Name, Sizes & prices, Price, Type, Lead days, Flavors, Notes, Description, Servings`. Follow `catalog-transcription.md`: one row per product. All sizes and prices go in column D (for example `4" S$98; 6" S$108; 4+6" (2-tier) S$188`). E is the lowest price. J Description gives the taste and main ingredients. K Servings gives how many people it serves (for example `4" 1–2; 6" 3–5; 4+6" 6–8`). If the source has neither, leave them empty; do not make them up. F Type is only `Standard` or `Custom`. G Lead days is a number; empty means use the default lead days in Settings.

### 3.4 Settings (sheetId 2)

Shop facts and rules all live here. Later, the owner changes rules only in column B. Use `sheets_update_values` to `'Settings'!A1` with `valueInputOption` `RAW` (time ranges and numbers must not be read as dates or formulas). Keep the row order below:

| Row | A Setting | B Value | C Default if empty | D Notes |
|---|---|---|---|---|
| 2 | Shop name | {Shop} | | |
| 3 | Address | {pickup address} | | |
| 4 | Phone | {phone or WhatsApp} | | |
| 5 | Time zone | {time zone} | Asia/Singapore | |
| 6 | Opening hours | {e.g. Tue–Sun 10:00–20:00} | | |
| 7 | Pickup hours | {e.g. 11:00–19:00} | Same as opening hours | Pickup only within this range |
| 8 | Closed days | {e.g. Monday; if none, write "None"} | None | Weekday names; separate several with commas |
| 9 | Standard lead days | {e.g. 1} | 1 | Minimum days between today and the due date; if Products column G has a value, the product wins |
| 10 | Custom lead days | {e.g. 3} | 3 | |
| 11 | Daily order limit | {number, or "Unlimited"} | Unlimited | Counted by due date; cancelled orders do not count |
| 12 | Quote custom first | {Yes/No} | Yes | Yes: custom orders are logged as Awaiting quote; the owner quotes, then the customer confirms |
| 13 | Deposit | {e.g. 50% for custom, full payment for standard; or None} | None | |
| 14 | Payment method | {e.g. PayNow 9xxx xxxx} | Owner will advise | Tell the customer how to pay; never take payment in the chat |
| 15 | Delivery | {Yes/No} | No | |
| 16 | Delivery areas & fees | {e.g. Islandwide S$15, free over S$100; or Quote by address} | | Leave empty if Delivery is No. If it says "Quote by address", delivery orders are first logged as Awaiting quote and the owner quotes the fee |
| 17 | Delivery slots | {e.g. 11:00–13:00, 15:00–18:00} | | |
| 18 | Ask allergies | {Yes/No} | Yes | Yes: once all required fields are in, ask one question about allergies or diet |
| 19 | Allergen note | {e.g. Our kitchen uses nuts, gluten and dairy; we cannot guarantee no cross-contamination} | Please check with the shop | The specialist answers only with this note and gives no guarantee |
| 20 | Change & cancel policy | {e.g. Reschedule up to 48 hours before; deposit not refunded} | Please contact the shop | |
| 21 | Needs review | {e.g. 10" and above; or None} | None | Orders, besides custom ones, that the owner must check first |
| 22 | Patrol times | {e.g. Daily 09:00, 18:00; or Daily 09:00–19:00 hourly} | Daily 09:00, 18:00 | When the order manager runs its scheduled patrols |
| 23 | Last patrol | (leave empty) | | Written by the order manager after each order patrol (text; morning and evening reports do not write it). Do not edit by hand |
| 24 | Website | {website or social media link} | | |
| 25 | Full payment to confirm | {Yes/No} | No | Yes: an order is confirmed only after the owner records full payment received; until then its status is Awaiting payment. A customer's payment screenshot does not count as received |
| 26 | Morning report time | {e.g. 07:00; do not write "None"} | None | The order manager sends a morning report every day: orders to make and hand over today, and things to handle today |
| 27 | Evening report time | {e.g. 19:30; do not write "None"} | None | The order manager sends an evening report every day: how today went and tomorrow's plan |
| 28 | Setup status | {Building/Testing/Live} | Building | Building: the customer specialist only answers enquiries and records no orders; Testing: orders are recorded as usual, with Notes marked `TEST ORDER`, for the go-live check; Live: real orders. Change to Live only after every Step 8 go-live check passes |
| 29 | Reply language | {Follow customer / English / Chinese} | Follow customer | Language used by the customer specialist and customer notifications |
| 30 | Reference image link | {Google Form link; leave empty if none} | | The customer specialist attaches it when asking for order details; see section 3.8 |
| 31 | Reference image sheet ID | {ID of the form's response sheet; leave empty if none} | | During patrols the order manager matches by phone and writes the image links into the order's Custom notes |

Rows from 33 on are for this shop's own rules (for example filling flavors and surcharges, storage, halal note, required details, rush order rules), one per row: A is the item name, B is the content, C stays empty. The customer specialist and the order manager both follow them (the settings string in Lookup B1 covers rows 2 to 60). The owner's special rules go here, in FAQ or in the private skill, **never in the Role**.

Formatting: header dark blue, white bold text. Column B light yellow background (1, 0.97, 0.8) to show it can be edited. Column widths A 140, B 420, C 220, D 360. Columns B and D wrap.

### 3.5 Lookup (sheetId 3)

The specialist reads this tab. Row 1 packs Settings into one cell. From row 3, one row per day for the next 60 days counts the orders taken, by due date.

First write rows 1 to 3 (`USER_ENTERED`):

```
A1  Settings
B1  =TEXTJOIN("; ",TRUE,ARRAYFORMULA(IF('Settings'!A2:A60="","",'Settings'!A2:A60&"="&IF('Settings'!B2:B60="",'Settings'!C2:C60,'Settings'!B2:B60))))
A2  Date    B2  Weekday    C2  Booked    D2  Slots left    E2  Custom
A3  =TODAY()
B3  =TEXT(A3,"dddd")
C3  =SUMPRODUCT((TEXT('Orders'!$C$2:$C$3000,"yyyy-mm-dd")=TEXT($A3,"yyyy-mm-dd"))*('Orders'!$T$2:$T$3000<>"Cancelled")*('Orders'!$T$2:$T$3000<>""))
D3  =IFERROR(VALUE(REGEXEXTRACT($B$1,"Daily order limit=(\d+)"))-C3,"Unlimited")
E3  =SUMPRODUCT((TEXT('Orders'!$C$2:$C$3000,"yyyy-mm-dd")=TEXT($A3,"yyyy-mm-dd"))*('Orders'!$T$2:$T$3000<>"Cancelled")*('Orders'!$T$2:$T$3000<>"")*('Orders'!$I$2:$I$3000="Custom"))
A4  =A3+1
```

Both sides of the date compare use `TEXT(…,"yyyy-mm-dd")`, so dates that were sometimes written as text in Orders still match. Then one batch with two `copyPaste` requests (`PASTE_FORMULA`): copy A4 to A5:A62, and copy B3:E3 to B4:E62. Row n is n−3 days after today. Formatting: column A `DATE` `yyyy-mm-dd`, row 2 dark blue with white bold text, B1 gray text, no wrap.

### 3.6 FAQ (sheetId 5)

The customer specialist uses this tab to answer questions that are not about products. Header A to E: `Question, Answer, Source, Asked at, Status`.

- At setup, write what was collected in group B of step one. C Source is `Website` or `Owner`, D stays empty, E is `Answered`. Cover at least: storage and how long it keeps; how many people each size serves (do not repeat what Products column K already has); less sugar or gluten-free; halal or not; whether candles, cutlery and birthday plaques are included; packaging; delivery tips; invoices or receipts. Do not write questions the owner gave no answer for.
- When a customer asks a question that has no answer in the tab, the customer specialist appends a row: A the question in the customer's words, B empty, C `Customer question`, D the time (`yyyy-mm-dd HH:mm`), E `Unanswered`. The order manager lists these during patrols. After the owner answers, the answer goes in column B and E changes to `Answered`. Later questions of the same kind use it directly.
- Formatting: header dark blue, white bold text. Column A width 260, column B width 480, wrap. Rows where E is `Unanswered` get a light yellow background.

### 3.8 Reference image upload form (the owner builds it by hand)

When a customer sends an image on Telegram or another channel, NyxID only records that there was an image and does not save it. Neither the assistant nor the owner can get it. So reference images go through a Google Form: the customer uploads in the form, the images are saved to the owner's Google Drive automatically, the responses are recorded in a sheet automatically, and the order manager matches by phone and writes the image links into the order's Custom notes column.

Google does not allow creating a form with a "File upload" question through the API. The owner does this step by hand, in **the same Google account as the order book** (about 2 minutes). Send the owner these steps in the step-one message:

1. Open forms.google.com and create a blank form. Title: "{Shop} Reference Images". Description: "Upload cake reference images. The owner uses them for the quote. Please use the same phone number as your order."
2. Add 5 questions:
   - Name (short answer, required)
   - Phone (short answer, required)
   - Pickup or delivery date (date, optional)
   - Reference image (file upload, images only, up to 5 files, 10 MB each)
   - Design notes (paragraph, optional)
3. On the "Responses" tab, click "Link to Sheets" → "Create a new spreadsheet".
4. Click "Send" → the link icon → tick "Shorten URL" → copy, and send the link to NyxBot.

After the owner sends the link: use `drive_list_files` to find a spreadsheet whose name contains "{Shop} Reference Images" (the response sheet usually has the same name as the form, or may end with "(Responses)"; the form itself and the "(File responses)" folder with the same name are not it). Read the first row and check it has "Phone" and "Reference image" columns. Move the form, the response sheet and the "{Shop} Reference Images (File responses)" image folder into the `{Shop} Shop Management` folder (the form is created in the Drive root; change the parent folder in Drive: addParents the shop folder, removeParents the old parent). Write the link into Settings B30 and the spreadsheet ID into B31. If the owner does not build the form for now, leave B30 and B31 empty. The customer specialist then attaches no link and, as before, asks the customer to describe the design in words.

Customers must sign in to a Google account to upload (a requirement of file upload questions). Tell the owner this at handover.

### 3.9 Setup Log (sheetId 6)

During onboarding, append a row each time you create or reuse something; if the run is interrupted, use it to continue. Header A to G: `Time, Step, Type, Name, ID, Result, Checked`.

- Type: folder, doc, spreadsheet, tab, customer specialist, order manager, grant, private skill, schedule, channel, form.
- ID: Drive file ID, specialist ID, skill guid, schedule ID, channel or chat ID.
- Result: `Created`, `Reused`, `Failed (reason)`. Checked: write `Passed` when the readback passes; leave it empty if not checked.
- When resuming, read this tab first and read back each item by its ID: skip it if it exists; redo from that step if it is missing or failed. Do not guess by name, and do not create anything twice.
- The spreadsheet itself is the first item: after building the Order Book and adding the tabs, add the folder, doc and spreadsheet rows.

### 3.7 Guide (sheetId 4)

One column of text, one item per row: what each tab is for (Setup Log is NyxBot's build record during onboarding; the owner can ignore it); the customer specialist repeats the answers in FAQ, and the owner can add or edit them directly; to change a rule, change only Settings column B, and it applies from the next order; Lookup and the order # are formulas, do not edit them by hand; what the order statuses mean and how they flow (Awaiting quote → Awaiting customer → Confirmed → In production → Ready for pickup or Out for delivery → Completed); the phrases the owner can say to the order manager; when patrol reports arrive; quotes, confirmations and cancellations are sent to Telegram customers automatically; the reference image link is in the order's Custom notes, tap it to view. Column A width 900, wrap.

## 4. Checklist

- Read `'Orders'!A1:V2`: the header has 22 columns, A1 shows "Order #", A2 shows "Sample", B2 is the sample-row text. Then read `'Orders'!A1` with `valueRenderOption=FORMULA`. It must match the formula in 3.2 character for character (`B3:B` and `ROW(B3:B)-2`, not B4 or anything else). If it does not match, rewrite A1, clear A2:A3000, and read it again.
- Read the first and last three rows of `'Products'!A1:K`. The row count matches the transcription (one row per product, not split by size).
- Read `'FAQ'!A1:E`: every Q&A collected at setup is there, with status `Answered`.
- Read `'Settings'!A1:D40`: rows 2 to 31 are all there (B30 and B31 only have values after the owner builds the reference image form), and column B matches the owner's answers. Shop-specific rules are from row 33 on.
- Read `'Lookup'!A1:E4`: B1 is a string of "key=value" items, A3 is today, C3 is 0, D3 is the daily limit or "Unlimited", and there is no `#NAME?` or `#ERROR!`.
- `docs_get_document`: one TITLE, the opening note that the two assistants do not read this document, and three HEADING_1.
- Read `'Setup Log'!A1:G`: everything built has a row with an ID.

## 5. Common failures

| Symptom | Cause | Fix |
|---|---|---|
| `Unable to parse range` | Wrong tab name, or the tab is not built yet | Run 3.1 first |
| "11:00–19:00" in Settings turned into a decimal | `USER_ENTERED` was used | Use `RAW` in 3.4 |
| Wrong booked count for a day in Lookup | An order status is misspelled, or the due date was written in another format | Use the status dropdown; write dates as `yyyy-mm-dd` |
| Order # is empty, does not match what the customer received, or A1 shows `#REF!` | The formula was pushed away, or an empty string written lower in column A blocks the formula from expanding | Rewrite A1 as the header formula, clear A2:A3000 (`updateCells` clearing only `userEnteredValue`), pass `null` for column A when appending |
| The first order has a dark blue background and white text, and no dropdowns | There is no sample row, so the order landed on row 2 | Insert the sample row at row 2, and reset plain format, dropdowns and conditional formatting from row 2 down (see above) |
