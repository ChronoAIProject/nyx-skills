# aevatar-automation

> Aevatar scheduling & workflow automation: scheduled_agent_creator (cron/one-shot) for independent scheduled Ornn skill agents and reminders — NOT an alias for Studio Team member automation — the long-running task automation playbook, workflow creation semantics (Scope Workflow vs Ornn publish), agent_builder lifecycle, the typed required_nyx_services contract (exact user_service_id is the authorization; a slug snapshot never substitutes), dedicated Agent Key semantics (vault-held raw material, borrowed durable reference late-resolved per use, exact non-wildcard grants, ~90-day projected expiry, reauthorize-then-revoke, independent NyxID and Vault revocation tracks), accepted-is-admission-only receipts, and a token_expired triage protocol that reads credentialSourceKind before assuming any TTL.

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/aevatar-automation) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `1.3`
- Last synced: `2026-08-29T14:01:15.592Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/aevatar-automation
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
