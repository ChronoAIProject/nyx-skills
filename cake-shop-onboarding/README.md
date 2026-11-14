# cake-shop-onboarding

> 蛋糕店 甜品店 烘焙 蛋糕定制 蛋糕预订 订蛋糕 生日蛋糕 订单 询价 前台 客服 接单 订单管理 巡查 开店 接入 cake shop bakery dessert custom cake order inquiry onboarding. Use on owner turns when a cake, dessert or bakery shop owner wants a NyxBot agent that answers customer questions and takes cake orders or custom-cake inquiries (蛋糕店助手、订单助手、接单助手、定制询价), even if the owner already has another specialist; ask whether it is the same shop or a new one. Bind this skill to NyxBot with set_agent_skills before running it. Collects the shop profile (website or social page, address, pickup hours), the product catalog (photo, PDF, text or website) and order rules (lead time, daily capacity, custom-quote flow, deposit, delivery zones and fees, allergen note, change and cancel policy, report times); builds a Drive folder, shop-info doc and an order sheet with a settings tab, product tab and per-day capacity tab in the owner's Google Workspace; creates a customer-facing specialist with a fixed Role that answers product and shop questions from the sheet (recommends items, logs unanswered questions for the owner) and takes orders, and an owner-only order manager bound to a private copy of cake-order-desk with scheduled order patrol reports; reminds the owner to link the Telegram bot. Never used on customer turns; never deletes or overwrites the owner's existing files.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/cake-shop-onboarding) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.22`
- Last synced: `2026-11-14T10:00:05.960Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/cake-shop-onboarding
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
