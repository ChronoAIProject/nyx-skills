# restaurant-reservation-onboarding

> 餐厅 订位 订座 预定 订桌 包间 排位 菜单 开店 接入 restaurant reservation booking table onboarding. Use on owner turns when a restaurant owner says they run a restaurant (餐厅、饭店、餐馆) and want a NyxBot agent that takes table bookings (订位助手、预定助手、订座). Bind this skill to NyxBot with set_agent_skills before running it. Collects the restaurant profile, menu (photo, PDF or text), table and private-room inventory and booking rules; builds a Drive folder, menu sheet, restaurant-info doc, reservation sheet with live table board and remaining-capacity tab, and a private-room calendar in the owner's Google Workspace; then creates the reservation specialist with the Role text, grants Google Workspace, binds restaurant-reservation-desk so the owner can say which table checked in or left, and links the customer channel. Never used on customer turns; never deletes or overwrites the owner's existing files.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/restaurant-reservation-onboarding) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.9`
- Last synced: `2026-10-27T17:00:02.580Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/restaurant-reservation-onboarding
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
