---
name: aevatar-lark-bot-registration
description: 'Register (bind) a Lark or Feishu bot so its messages are handled by an aevatar agent and replies are sent back, via the NyxID relay. The bot is registered DIRECTLY on NyxID (nyxid channel-bot register, then a relay api-key whose callback_url is aevatar''s /api/webhooks/nyxid-relay, then a default conversation route), activated manually in the Lark/Feishu developer console (event subscription URL, matching verification token, im:message scopes), with an LLM service connected on the bot-owner account so replies are non-empty. aevatar no longer exposes its own /api/channels/registrations endpoint — inbound scope is derived from the NyxID relay callback token. Covers the exact nyxid CLI and NyxID REST calls, the lark vs feishu region differences, the api-lark-bot proxy (needed only for proactive Lark tool calls), and the common failure modes. Use when asked to bind, register, connect, or onboard a Lark or Feishu bot to aevatar, or to debug a bot that is not replying.'
metadata:
  category: plain
  tag:
    - aevatar
    - lark
    - feishu
    - channel-bot
    - bot-registration
    - nyxid
    - relay
version: "2.0"
lastUpdated: 2026-06-24
---

> You are an AI agent (or operator) binding a **Lark/Feishu bot to aevatar**. End state: a message to the bot in Lark/Feishu is delivered (via the NyxID relay) to an aevatar agent, which replies into the chat.
>
> **The bot is registered entirely on NyxID — aevatar has no registration endpoint.** (A prior `POST /api/channels/registrations` facade was removed as redundant; do not use it.) aevatar only *receives* the relay callback at `/api/webhooks/nyxid-relay` and derives the tenant scope from the NyxID-issued callback token.
>
> Read top to bottom; steps are ordered. Steps 1–4 + 6 are `nyxid` CLI; step 5 is manual in the Lark/Feishu developer console. The deep contract is in `references/api-contract.md`.

---

## 0. Prerequisites — *spec: `references/api-contract.md` §1*

| Thing | How |
|---|---|
| **NyxID login** | `nyxid login --base-url https://nyx-api.chrono-ai.fun` (prod). The token's NyxID user becomes the **bot owner** — every relayed turn resolves creds/LLM as this user. |
| **aevatar relay callback URL** | `https://aevatar-console-backend-api.aevatar.ai/api/webhooks/nyxid-relay` (used in step 2). |
| **NyxID inbound webhook base** | `https://nyx-api.chrono-ai.fun` (used in step 5). |
| **Lark/Feishu app creds** | `app_id` (`cli_…`), `app_secret`, `verification_token` from the developer console. Export secrets as env vars; never echo raw values. |

> **lark vs feishu:** use `--platform lark` for Lark International (`open.larksuite.com`) or `--platform feishu` for Feishu China (`open.feishu.cn`). The only differences are the `--platform` string, the console host, and the webhook path segment (`/lark/` vs `/feishu/`). Everything else is identical.

```bash
export NYXID_LARK_APP_SECRET='…'
export NYXID_LARK_VERIFICATION_TOKEN='…'
nyxid whoami    # confirm you are the intended bot-owner account
```

---

## 1. Register the channel-bot on NyxID — *spec: `references/api-contract.md` §2*

```bash
nyxid channel-bot register \
  --platform lark \
  --label "My Lark Bot" \
  --app-id cli_xxxxxxxxxxxxxxxx \
  --app-secret-env NYXID_LARK_APP_SECRET \
  --verification-token "$NYXID_LARK_VERIFICATION_TOKEN" \
  --output json
# (Feishu: --platform feishu. Optional --encrypt-key only if you set an Encrypt Key in the console.)
```

- NyxID validates `app_id`/`app_secret` against Lark at this point (a wrong secret fails here). `--verification-token` is **required** for lark/feishu.
- Global uniqueness: only **one active** bot per `app_id` may exist across all NyxID users/orgs. If you already registered this app (e.g. shared to an org), `nyxid channel-bot delete <id>` the old one first or reuse it.
- Save the returned bot **`id`** (the `BOT_ID`) and the `permission_setup_url` (used in step 5).
- REST: `POST /api/v1/channel-bots`.

---

## 2. Create the relay api-key (callback → aevatar) — *spec: `references/api-contract.md` §3*

```bash
nyxid api-key create \
  --name "My Lark Bot relay agent" \
  --scopes "read write" \
  --callback-url https://aevatar-console-backend-api.aevatar.ai/api/webhooks/nyxid-relay \
  --allow-all-services \
  --terminal \
  --output json
```

- `--terminal` prints the full key **once** — copy it if you need it; you mainly need the api-key **`id`** for step 3.
- `--allow-all-services` (or `--allowed-services api-lark-bot,<llm-slug>`) lets the relayed turn reach the proxy + LLM services.
- **This api-key is the inbound scope identity:** NyxID mints the relay callback token from it, and aevatar reads the bot-owner scope from that token (`scope_id ?? sub`). No aevatar-side mirror is involved.
- REST: `POST /api/v1/api-keys` (a.k.a. `/api/v1/keys`).

---

## 3. Create the default conversation route — *spec: `references/api-contract.md` §4*

```bash
nyxid channel-bot route create \
  --bot-id <BOT_ID> \
  --agent-key-id <RELAY_API_KEY_ID> \
  --default-agent \
  --output json
```

- Binds the bot to the relay api-key as the **catch-all default agent** (omit `--conversation-id` for all chats). NyxID's relay uses this to decide which callback to forward each inbound event to.
- REST: `POST /api/v1/channel-conversations` `{channel_bot_id, agent_api_key_id, default_agent:true}`.

---

## 4. Connect the `api-lark-bot` proxy (proactive Lark tools only) — *spec: `references/api-contract.md` §5*

```bash
nyxid service add api-lark-bot --credential "$LARK_APP_CREDS" --label "Lark bot proxy"
# or, if no catalog entry exists:
# nyxid service add-custom --label api-lark-bot \
#   --endpoint-url https://open.larksuite.com \   # feishu: https://open.feishu.cn
#   --credential "$CREDS" --auth-method header --auth-key-name Authorization
```

- Needed for the agent's **proactive** Lark calls — `send`/`edit`/`react`/CardKit streaming — which aevatar issues via the `api-lark-bot` NyxID proxy (`/api/v1/proxy/s/api-lark-bot/…`).
- **Not required for the basic relay text reply** — NyxID sends that itself via its own platform adapter when aevatar POSTs to `/api/v1/channel-relay/reply`. Skip this step if you only need plain replies.

---

## 5. Activate in the Lark/Feishu developer console (manual) — *spec: `references/api-contract.md` §6*

NyxID does not auto-register the webhook; the bot stays `pending_webhook` until the first verified inbound event. In the console for your `app_id`:

1. **Event Subscription Request URL** = `https://nyx-api.chrono-ai.fun/api/v1/webhooks/channel/lark/<BOT_ID>` (Feishu: `…/channel/feishu/<BOT_ID>` — the segment must match `--platform`).
2. **Verification Token** = the exact value from step 1's `--verification-token`.
3. **Encrypt Key** — leave blank unless you registered one with `--encrypt-key`.
4. Grant scopes **`im:message`** and **`im:message:send_as_bot`** (open the `permission_setup_url` from step 1 to pre-select them).
5. Subscribe the message-received event (`im.message.receive_v1`) and **publish/release** the app version.
6. Confirm: `nyxid channel-bot verify <BOT_ID>` (re-registers the webhook + checks the token).

---

## 6. Connect an LLM service on the bot-owner account — *spec: `references/api-contract.md` §7*

The relayed turn resolves the LLM as the **bot owner**, so the owner must have a working chat-completions service or the bot replies with the empty-response fallback.

```bash
nyxid service add llm-openai --credential "$OPENAI_KEY"     # or llm-anthropic / llm-deepseek / any llm-* slug
nyxid catalog show llm-openai                                # confirm connected
```

---

## 7. Verify end-to-end

1. DM the bot (or @-mention it in a group — group turns are gated to @mention / reply-to-bot / slash).
2. The first inbound webhook promotes the NyxID bot to **active**: `nyxid channel-bot show <BOT_ID> --output json` → `"status": "active"`.
3. The bot replies through aevatar.

---

## 8. Common failures — *spec: `references/api-contract.md` §8*

| Symptom | Cause | Fix |
|---|---|---|
| `nyxid channel-bot register` → 409 `already registered` | an active bot for this `app_id` exists (global uniqueness) | delete/reuse it (`nyxid channel-bot delete <id>`) |
| register → credential / `tenant_access_token` error | wrong `app_secret`, or app_id/secret from different apps | fix the secret; check the region (lark vs feishu) |
| bot never goes `active` | console webhook URL/token mismatch, app not published, or wrong `/lark/` vs `/feishu/` segment | re-check step 5; `nyxid channel-bot verify <BOT_ID>` |
| bot receives but never replies / empty "Sorry…" reply | no LLM service on the bot-owner account (step 6), or the relay api-key lacks the LLM service in its allow-list | connect an `llm-*` service; widen the api-key scopes |
| proactive send/CardKit fails but plain replies work | `api-lark-bot` proxy not connected (step 4) | connect it on the owner account |
| silent in groups | needs @mention/reply/slash + `im:message` granted + event published | step 5 |

---

## 9. References

| File | Use it when |
|---|---|
| `references/api-contract.md` | You need the exact NyxID REST/CLI contract for each step, the inbound-scope-from-callback-JWT mechanism, the relay-reply vs proxy-tools distinction, the lark/feishu region matrix, and the credential-validation + bot-lifecycle internals. |
