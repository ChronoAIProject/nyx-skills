# The shop's private order manager skill

The public `cake-order-desk-en` is a template shared by all shops. Each shop has its own private copy on Ornn, and the order manager is bound to that copy. House rules go into the copy, so a public template upgrade does not overwrite them.

## 1. Make the copy (when creating the order manager)

1. Use `search_agent_skills` to find `cake-order-desk-en`. Note the latest version X.Y and read the full SKILL.md.
2. Change only these parts:
   - `name`: the shop name in English or romanized + `-order-desk`, all lowercase, hyphen-separated, e.g. `frosting-cottage-order-desk`.
   - `description`: add "{Shop} only (based on public template cake-order-desk-en X.Y, plus house rules). " at the start, then copy the rest as is. NyxBot's create-skill tool limits the description to 400 characters. If it is over, keep only that opening sentence and the keywords (order quote deposit production pickup delivery cancel reschedule patrol report).
   - `version`: set to `"1.0"`.
   - Change the title to `# {Shop}: order manager` and add this paragraph under it:
     ```
     This is {Shop}'s private skill, copied from the public template cake-order-desk-en X.Y. Only the owner's account can see it. House rules are in the "House rules" section. Where they conflict with the template, the house rules win.

     Template source: cake-order-desk-en X.Y
     ```
   - Add `## House rules` before `## Operations`. If the owner has not named any, write `(None yet. Add here when the owner asks.)`.
3. Package and upload (Ornn `POST /api/v1/skills`, zip, folder name the same as `name`), or use NyxID's built-in private publish tool. With the private publish tool, submit it as a new skill. Do not treat `cake-order-desk-en` as the base skill to improve (the different name causes `base_skill_name_mismatch`). Publishing ends this turn; do the read-back and binding next turn. Read back and confirm `isPrivate` is true, and state it in the reply to the owner.
4. Use `set_agent_skills` to bind the private skill to the order manager. Do not bind the public template any more.

## 2. The owner adds a house rule

The owner says something like "Custom cakes always take a 50% deposit before we start" or "Saturday delivery costs S$5 extra". Read the private skill's current text and add one rule under "House rules". If it only affects one operation, add "per house rule N" in that operation. Publish a new version, rebind, read back that it is still private, and tell the owner in one sentence which rule was added and the new version number. Rules that Settings can express (lead days, deposit, delivery fees) go into Settings first, not into the skill.

## 3. Merge when the public template upgrades

When the owner asks "Is there an update for the order manager?": read "Template source" in the private skill and check the latest version of the public template. If they match, reply "Already up to date". If not, explain what the new version changed and ask whether to merge. If the owner agrees, redo section 1 with the full new template text. Move the old copy's whole "House rules" section and the references inside operations over as they are, set "Template source" to the new version, publish and rebind. If the owner says no, change nothing.

Use the version number the publish tool actually returns. Do not promise a version number in advance.
