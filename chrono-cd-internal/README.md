# chrono-cd-internal

> Deploy and operate the ChronoAI platform's own internal apps with chrono-cd, and run its platform-admin routes. Needs a namespace permission (a NyxID role such as `chrono-cd-ns-chrono-bot`, `can_internal` on `/account`) for internal apps, or `chrono-cd-admin` (`is_admin`) for everything including the admin routes. Internal apps such as a probe, a status page or a bot get a hostname directly under a platform domain (`probe.chrono-ai.fun`, `bot.nyxid.ai`) instead of a user hostname, live in a named platform namespace the user is granted (`chrono-bot`, `chrono-cma`), and the platform creates their DNS records. Also covers what admins do for other people - read or move the base domain of new user apps, list owners and apps across the platform, raise an owner's quota, approve or reject quota requests, reconcile a drifted app. Works with the nyxid CLI (`nyxid proxy request chrono-cd ...`) or a NyxID proxy request tool (service `chrono-cd`, method, path, body). Use when a platform admin wants an internal app deployed, updated or removed, or asks about quotas, owners or the base domain. Assumes the `chrono-cd` skill for the app spec, secrets, status, logs and telemetry; this skill adds only what differs.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/chrono-cd-internal) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.1`
- Last synced: `2026-10-29T09:08:56.823Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/chrono-cd-internal
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
