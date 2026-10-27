# restaurant-reservation-onboarding

> Onboarding desk for a restaurant owner who wants a reservation NyxBot. Use only on owner turns (NyxID app, or channel messages marked (owner)) when the owner says they run a restaurant and want an assistant that handles table bookings. Collects the restaurant profile, the menu (photo, PDF or text), the table and private-room inventory and the booking rules, then builds the working files in the owner's Google Workspace (already bound in NyxID): a Drive folder, a menu sheet, a restaurant-info doc, a reservation log sheet with a live table-status board, and a private-room calendar. Ends with the links, the points the owner must check, and the Role text for the reservation specialist. Never used on customer turns; never deletes or overwrites files the owner already has.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/restaurant-reservation-onboarding) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.0`
- Last synced: `2026-10-27T05:00:00.888Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/restaurant-reservation-onboarding
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
