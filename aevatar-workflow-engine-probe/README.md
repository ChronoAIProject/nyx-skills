# aevatar-workflow-engine-probe

> Verify the workflow engine can actually start a run and return its output to chat — uses aevatar_start_workflow with an inline self-contained workflow (no pre-registration needed), waits for completion, and checks the run output echoes a unique token. Run it before relying on any workflow; it isolates "is the engine alive" from "is my workflow correct".

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/aevatar-workflow-engine-probe) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.0`
- Last synced: `2026-09-03T22:00:48.229Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/aevatar-workflow-engine-probe
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
