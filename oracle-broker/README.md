# oracle-broker

> Ask ChatGPT Pro through the Chrono oracle broker with the NyxID CLI (`nyxid proxy request oracle ...`) - single-shot questions, multi-turn conversations, file attachments, web-page extraction, generic jobs, pool and worker management. Questions go through the streaming OpenAI-compatible endpoint, one call per answer with no polling. Use whenever the user wants to ask ChatGPT or GPT Pro through NyxID, continue a ChatGPT conversation, query a file, check an oracle pool or its workers, or point an OpenAI client at the oracle. Do not use `nyxid oracle ...` for this; that command talks to the older oracle built into NyxID.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/oracle-broker) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.1`
- Last synced: `2026-10-07T06:54:14.503Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/oracle-broker
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
