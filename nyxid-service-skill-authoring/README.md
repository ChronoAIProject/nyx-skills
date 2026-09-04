# nyxid-service-skill-authoring

> Find or author an agent skill for a NyxID proxy service that has no OpenAPI spec or typed operations. Use when a NyxID service only exposes the generic proxy tool, `nyxid catalog endpoints` returns nothing for the slug, or you would otherwise have to guess endpoint paths. Searches Ornn for an existing skill bound to the service; if none exists, creates one — researching the official OpenAPI spec on the web for public services, or collecting the contract from the user for private/custom services (never fabricate endpoints) — then uploads it to Ornn, binds it to the service, and records it locally.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/nyxid-service-skill-authoring) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.2`
- Last synced: `2026-09-04T17:00:21.420Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/nyxid-service-skill-authoring
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
