# chrono-cd

> Deploy a user's application to the ChronoAI cluster with chrono-cd through the NyxID CLI (`nyxid proxy request chrono-cd ...`). Covers the whole flow an agent runs for the user - check the account and quota, pick a personal or organization scope, write the app spec (one or more ghcr.io images with ports, routes, env, config files, volumes and an optional MongoDB add-on), create or update the app, set its secrets, watch status and logs, restart, roll back by re-deploying a tag, delete, and ask for more quota. Use whenever the user wants to deploy, update, inspect or remove an app on apps.chrono-ai.fun, or asks what chrono-cd needs from them. Every request body and response shape is given, so the agent never guesses.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/chrono-cd) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.0`
- Last synced: `2026-10-20T09:00:00.888Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/chrono-cd
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
