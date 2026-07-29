# aevatar-scheduler

> Create and manage recurring Aevatar runs — and route to the RIGHT scheduling resource first, because there are three. Use when a user wants to "schedule", "run on a cron", "set up a recurring run", "run every day/hour/Monday", "automate this service on a timer", "schedule my team member workflow", "preview a cron", "pause/resume/disable a schedule", "run it now", "reauthorize or delete an automation" — or hits token_expired on a scheduled run's late steps. An already-bound Studio Team member workflow is canonically scheduled through aevatar_schedule_member_workflow or /api/scopes/{scopeId}/teams/{teamId}/members/{memberId}/automations and gets a dedicated, restricted Agent Key whose raw material lives only in the secret vault; generic /api/schedules is a separate platform resource for raw service invocations and envelopes, not a fallback for Team members. Covers preflight, the Agent Key lifecycle (create, pause/resume, update, reauthorize, delete with independent NyxID and Vault revocation tracks), 202-is-admission-only semantics, preview, enable/disable, run-now, and diagnosing a credential failure by credentialSourceKind rather than by assuming a 300-second broker token. Publish the service first with the service-publisher skill.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/aevatar-scheduler) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.8`
- Last synced: `2026-07-29T19:00:06.146Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/aevatar-scheduler
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
