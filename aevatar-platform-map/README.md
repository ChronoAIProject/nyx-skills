# aevatar-platform-map

> Panorama and entry point for driving the Aevatar control plane over its REST API. Load this FIRST whenever a user wants to build, publish, schedule, or operate things on Aevatar — "create an agent team", "make a workflow / member", "publish/bind a service", "register it with NyxID", "set up a recurring/scheduled run", "deploy an agent", "invoke my service". It teaches the object model (scope → team → member(workflow/script/gagent) → service → schedule), how to authenticate with a NyxID token, how to resolve your scope, and which companion skill to use for each task. It does not perform the work itself — it routes you to the right step.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/aevatar-platform-map) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.0`
- Last synced: `2026-06-23T05:04:16.086Z`

## Install

```bash
npx skills add ChronoAIProject/ornn-skills/aevatar-platform-map
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
