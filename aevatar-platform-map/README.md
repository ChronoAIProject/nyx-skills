# aevatar-platform-map

> Entry point, panorama, and router for the entire Aevatar skill family — load this FIRST whenever someone wants to build, run, publish, schedule, externally trigger, or operate anything on Aevatar ("create an agent team", "make a workflow / member", "publish or bind a service", "register it with NyxID", "set up a recurring / cron run", "schedule my team member workflow", "invoke my service"), wants to configure an agent's identity ("create an agent profile", "set my agent's purpose/instructions", "bind a skill to my agent", "limit my agent's tools"), wants to know whether something is even possible ("can Aevatar do X?", "能不能用 aevatar 实现"), or just wants to know what Aevatar can do. It teaches the two independent resource surfaces — build/operate (scope → team → member[workflow|script|gagent] → service → schedule/external trigger) and Agent Profile (ownerHandle/profileSlug → opaque profileId → draft → published snapshot) — NyxID-brokered auth and scope resolution, the two caller modes (client REST vs in-session tools), how to route the three distinct scheduling resources to their right owner, and how to detect a deployment-gated capability before promising it. It routes rather than builds — feasibility-advisor, workflow-authoring, team-builder, service-publisher, scheduler, agent-profile-management, triage, plus probes and the fallback — held together by the `aevatar` tag and published as the versioned `aevatar-platform` Ornn skillset.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/aevatar-platform-map) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.8`
- Last synced: `2026-07-27T15:29:44.363Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/aevatar-platform-map
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
