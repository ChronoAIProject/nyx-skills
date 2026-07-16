# aevatar-service-publisher

> Publish an Aevatar member, team, or workflow as an invocable service and (host permitting) register it with NyxID, then verify, invoke, or wire external HTTP triggers such as Lark Base automation — all over the REST API. Use when a user wants to "publish/bind a service", "expose my workflow/team as a service", "register it with NyxID", "make it callable", "get the service slug/URL", "invoke my service", "let Lark Base call my workflow", "trigger this workflow from an external webhook", or "version/deploy/roll out a service". It covers the simple scope binding, reading back a member's published service, the full account-level service lifecycle (revision → publish → deploy → rollout), how to confirm the NyxID registration (slug + status), how to invoke an endpoint, and how to distinguish direct NyxID proxy triggering from host-gated externalExposure. Build the team/member first with the team-builder skill.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/aevatar-service-publisher) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.5`
- Last synced: `2026-07-16T17:00:05.713Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/aevatar-service-publisher
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
