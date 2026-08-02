# aevatar-agent-profile-management

> Create, edit, bind skills to, validate, publish, or explain an Aevatar Agent Profile — the resource that defines an agent's purpose, instructions, exact Ornn skill routing, and maximum tool authority. Use whenever a user wants to "create/configure an agent profile", "set an agent's purpose or instructions", "bind a skill to my agent", "make skill X always on / routed by intent", "limit which tools my agent may use", "validate or publish a profile", or asks why a profile ETag, validation, publication, or runtime binding behaved as it did. Agent Profile is its own resource surface — it is NOT a workflow, member, team, service, or schedule, and creating one never creates any of those. This skill teaches the exact authority model (opaque profileId, ownerHandle/profileSlug, exact `{skillGuid, literalVersion, expectedName, expectedPublisherId}` Ornn references), the strong-ETag concurrency protocol, accepted-vs-committed ACK semantics, and — first and hardest — how to detect whether the running deployment exposes the Profile contract at all before attempting any mutation.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/aevatar-agent-profile-management) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.0`
- Last synced: `2026-08-02T17:00:00.774Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/aevatar-agent-profile-management
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
