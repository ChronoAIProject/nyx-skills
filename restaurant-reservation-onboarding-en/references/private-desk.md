# The store's private desk skill

The public `restaurant-reservation-desk-en` is a template shared by all stores. Each store has its own private copy on Ornn, and the specialist is bound to that copy. House rules go into the copy, and public template upgrades do not overwrite it.

## 1. Create the copy (done in Step 5, instead of binding the public template directly)

1. Use `search_agent_skills` to find `restaurant-reservation-desk-en`, note the latest version X.Y, and read its full SKILL.md with Ornn's read-skill tool (e.g. `ornn-api__getskilljson`).
2. In the full text, change only these places:
   - `name`: the store name in pinyin or English + `-reservation-desk`, e.g. `xibei-reservation-desk`, `laosuiyuan-reservation-desk`. All lowercase, words joined by hyphens.
   - `description`: add at the start "For {Store} only (based on public template restaurant-reservation-desk-en X.Y, plus house rules).", then copy the rest as is. NyxBot's create-skill tool may limit the description to 400 characters: if it is over, keep only that opening sentence and the English keywords (seated left move walk-in reschedule cancel pending tables capacity room calendar); do not add an appendix.
   - `version`: change to `"1.0"`.
   - Change the title to "# {Store}: owner's daily desk", and add a paragraph below the title:
     ```
     This is {Store}'s private skill, copied from public template restaurant-reservation-desk-en X.Y. Only the owner's account can see it. House rules are in the "House rules" section; where they conflict with the template, house rules win.

     Template source: restaurant-reservation-desk-en X.Y
     ```
   - Add a section "## House rules" before "## Operations". If the owner gave no house rules during onboarding, write "(None yet; add here when the owner asks.)".
3. Zip it (the folder name matches `name`, containing only SKILL.md) and upload it with Ornn's create-skill endpoint (`POST /api/v1/skills`, `application/zip`). New skills are private by default. After uploading, read it once, confirm `isPrivate` is true, and say so in the reply to the owner; if not, make it private with the permissions endpoint (`PUT /api/v1/skills/{id}/permissions`, `{"isPrivate":true,"grants":[]}`).
4. Use `set_agent_skills` to bind this private skill to the reservation specialist. Do not also bind the public `restaurant-reservation-desk-en`; binding both causes conflicts.

If creating the copy fails (the owner has no Ornn access, upload error): tell the owner why, bind the latest version of the public `restaurant-reservation-desk-en` directly instead, and write in the delivery "Currently using the public template; no private version for this store yet."

## 2. The owner adds a house rule

When the owner says something like "From now on, remind me to tell the kitchen when a booking moves to a room" or "Only join B1 and B2":

1. Read the SKILL.md of the private skill's current version.
2. Add a rule to the "House rules" section, continuing the numbering; if it affects only one operation, add a sentence "Per house rule N" inside that operation.
3. Publish a new version (Ornn update endpoint `PUT /api/v1/skills/{id}`, or NyxID's built-in private publish tool), and read it back to confirm it is still private.
4. Use `set_agent_skills` to rebind the specialist to the new version.
5. Reply to the owner in one sentence: which rule was added, and the private skill's new version number.

Change only what relates to "House rules". Do not change the template parts and do not touch the Role.

## 3. Merge when the public template upgrades

When the owner says "Is there a desk update?" or "Update the desk", or when the onboarding skill runs again for an existing store:

1. Read "Template source: restaurant-reservation-desk-en X.Y" in the private skill, then check the latest version of the public template.
2. If they match, reply "Already up to date". If not, tell the owner in one or two sentences what the new template changed (use Ornn's version diff, or read both versions and compare), and ask whether to merge.
3. If the owner agrees: take the new template's full text, redo the renaming and title per section 1, carry over the old copy's whole "House rules" section and every "Per house rule N" sentence in the operations as is, change "Template source" to the new version, publish and rebind.
4. If the owner does not agree: change nothing.

Never merge automatically without the owner's consent.

## Version numbers

NyxID's built-in private publish tool assigns version numbers automatically (usually minor version + 1); you cannot choose one. Go by the version the tool actually returns, report that actual version to the owner, and do not promise in advance "it will go to 2.0". To decide which template version a copy is merged from, look only at the "Template source" line in the text.
