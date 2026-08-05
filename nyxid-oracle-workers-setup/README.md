# nyxid-oracle-workers-setup

> Provision a NyxID Oracle CDP worker on a macOS machine with URL-key tab isolation (script_version cdp-1.3-url-key-image), running under launchd and pinned to its own slot tab so fresh tasks never reuse another project's ChatGPT conversation. Make sure to use this skill whenever the user wants to set up / add / register / onboard a ChatGPT Oracle worker on a Mac, connect a Mac to a NyxID oracle pool, run a CDP worker as a background service, add a second ChatGPT account/worker, or replicate the same worker on another MacBook — even if they don't name the skill. Includes the pool-vs-account routing rules that decide whether multi-turn works.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/nyxid-oracle-workers-setup) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.1`
- Last synced: `2026-08-05T13:35:55.260Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/nyxid-oracle-workers-setup
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
