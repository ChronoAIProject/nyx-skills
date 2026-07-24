# fkst-control-plane-manual

> Operator manual for the fkst-hosted control plane — how to start, drive, monitor, and stop autonomous fkst-substrate coding sessions through GitHub issues (the source of truth; the dashboard/REST API reads and writes those same issues). Use whenever you need to: (a) launch a session by opening an `fkst-substrate-trigger` issue with the exact `### Session Name` / `### Packages` / `### Manifest` / `### Work Label` / optional `### Environment` / `### Auto-merge` / `### FKST Contributors` (alias: `### Log Access Allowlist`) / `### Session Collaborators` / `### Output Language` / `### Engine Config` body; (b) queue tasks by opening issues that carry the session's work labels; (c) interpret the session's status comments and labels (registered / picked-up / degraded / retired / invalid / config-rejected / unauthorized) and the dashboard's typed recovery states; (d) download a session's redacted logs (whole-session or per-run) from the identity-gated `/api/v1/logs/{session_id}` endpoint; or (e) stop or idle a session by closing issues. Covers the package-reference grammar `owner/repo@ref:path`, manifest expansion, work-label auto-discovery, config immutability, the idle-vs-permanent lifecycle, the one-work-label-per-trigger rule, and control-plane availability (`/ready`, restart/failover 503 windows).

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/fkst-control-plane-manual) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `0.2`
- Last synced: `2026-07-24T15:00:04.888Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/fkst-control-plane-manual
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
