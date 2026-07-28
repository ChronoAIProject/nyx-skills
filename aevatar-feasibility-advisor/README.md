# aevatar-feasibility-advisor

> Decide — honestly — whether a thing the user wants to build on Aevatar is possible, what its prerequisites are, or why it cannot be done, BEFORE anyone starts building. Use this first whenever a user describes a goal rather than a concrete artifact — "can aevatar do X", "I want a bot that…", "build me something that posts to Twitter / reads my GitHub / replies on Telegram", "is it possible to…", "automate … every day", "let Lark Base trigger a workflow", "can I give my agent a fixed persona / attach skills to it / hard-limit its tools". It teaches the one hard premise (every third-party capability is brokered by NyxID), the two distinct surfaces (outbound connector vs inbound channel), external HTTP trigger options such as Lark Base automation, how to check what is actually connectable, the prerequisite for each capability class, what is host-gated (and so not self-serve), and what is genuinely impossible without new NyxID/Aevatar platform work — so you can negotiate scope and give the user a straight answer plus next steps instead of over-promising. It also separates the three different reasons a capability can be unavailable — not connected (user fixes), host-gated (host fixes), and not deployed (needs a build that exposes it) — so "agent profile" style asks get a straight answer instead of a guess. It scopes; it does not build (hand off to workflow-authoring / team-builder / service-publisher / scheduler / agent-profile-management).

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/aevatar-feasibility-advisor) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.2`
- Last synced: `2026-07-28T02:00:09.477Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/aevatar-feasibility-advisor
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
