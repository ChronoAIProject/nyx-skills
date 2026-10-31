# restaurant-reservation-onboarding-en

> Restaurant reservation, booking, table and front desk onboarding. Use on owner turns when a restaurant owner says they run a restaurant and want a NyxBot agent that answers guest questions and takes table bookings (reservation assistant, booking assistant, front desk assistant), even if the owner already has a reservation specialist; ask whether it is the same restaurant or a new one. Bind this skill to NyxBot with set_agent_skills first. Collects the restaurant profile, menu (photo, PDF or text), table and private-room inventory and booking rules; builds a Drive folder, menu sheet, restaurant info doc, reservation sheet with live table board, a Settings tab for house rules and a Lookup tab of free tables per day, and a private-room calendar in the owner's Google Workspace; creates the specialist from the fixed Role template (only store name and sheet ID filled in), grants Google Workspace, copies restaurant-reservation-desk-en into a private per-store Ornn skill and binds it, and links the guest channel. Never used on guest turns; never deletes or overwrites owner files.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/restaurant-reservation-onboarding-en) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.2`
- Last synced: `2026-10-31T07:00:01.025Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/restaurant-reservation-onboarding-en
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
