# ornn-agent-manual-cli

> The manual an AI agent loads to operate Ornn — the model-agnostic skill-lifecycle API (an npm-style registry + CLI for agent skills) — via the NyxID CLI (`nyxid proxy request ornn-api …`). Load and follow this skill WHENEVER the user asks to do anything with Ornn skills or skillsets. Skills: search Ornn or find a skill, pull or install a skill (or a specific version), run a skill, build and upload a skill, publish a new version, make a skill public / private / shared, run or read a security audit, deprecate or delete a version, diff two versions, check usage analytics, bind a skill to a NyxID service, link a skill to GitHub or sync from source, manage npm-style dist-tags, or transfer skill ownership. Skillsets — curated multi-skill bundles with a required master prompt: bundle skills into a set, create or publish a skillset, resolve its closure in one call, export a skillset as a Claude Code marketplace plugin, transfer skillset ownership, or diagnose why a shared skillset isn't visible (visibility derives from its member skills). Also load it to check your quota or pick an LLM model before an SSE call, and on phrases like 'share my skill', 'bundle these skills', or 'export as a Claude Code plugin'. Once loaded, the agent runs the whole search → pull → execute → build → upload → share lifecycle with no further setup — this is the authoritative Ornn↔agent contract, paired with references/api-reference.md (full per-endpoint catalogue + error legend).

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/ornn-agent-manual-cli) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.5`
- Last synced: `2026-07-13T07:00:11.251Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/ornn-agent-manual-cli
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
