# scheduled-agent-doctor

> Audit, debug, trigger, and repair scheduled (cron) agents from chat — list what exists, verify cron and timezone really mean what the user intended, manually run one to test, disable or delete-and-recreate broken ones. Encodes the known failure modes (timezone double-conversion, zombie agents from older runtimes, cron-mode credential 403, DM-vs-group visibility) so users can self-serve.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/scheduled-agent-doctor) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.0`
- Last synced: `2026-09-05T10:00:53.429Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/scheduled-agent-doctor
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
