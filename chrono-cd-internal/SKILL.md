---
name: chrono-cd-internal
description: Deploy and operate the ChronoAI platform's own internal apps with chrono-cd, and run its platform-admin routes. Needs a namespace permission (a NyxID role such as `chrono-cd-ns-chrono-bot`, `can_internal` on `/account`) for internal apps, or `chrono-cd-admin` (`is_admin`) for everything including the admin routes. Internal apps such as a probe, a status page or a bot get a hostname directly under a platform domain (`probe.chrono-ai.fun`, `bot.nyxid.ai`) instead of a user hostname, live in a named platform namespace the user is granted (`chrono-bot`, `chrono-cma`), and the platform creates their DNS records. Also covers what admins do for other people - read or move the base domain of new user apps, list owners and apps across the platform, raise an owner's quota, approve or reject quota requests, reconcile a drifted app. Works with the nyxid CLI (`nyxid proxy request chrono-cd ...`) or a NyxID proxy request tool (service `chrono-cd`, method, path, body). Use when a platform admin wants an internal app deployed, updated or removed, or asks about quotas, owners or the base domain. Assumes the `chrono-cd` skill for the app spec, secrets, status, logs and telemetry; this skill adds only what differs.
compatibility: Needs a namespace role such as `chrono-cd-ns-chrono-bot` or the `chrono-cd-admin` role on the caller; everyone else gets 403. One of two transports - a shell with the nyxid CLI logged in as a platform admin, or a NyxID proxy request tool (NyxID Assistant, NyxBot, Aevatar agents) acting for one. Verified 2026-10-27 against chrono-cd on the live platform. Companion of the public `chrono-cd` skill, which is needed for the app spec and the everyday routes.
version: "1.1"
license: Apache-2.0
metadata:
  category: tool-based
  tool-list:
    - Bash
    - nyxid_proxy
  tag:
    - chrono-cd
    - nyxid
    - deploy
    - internal
    - platform-admin
---

# Internal apps and admin routes of chrono-cd

The public `chrono-cd` skill deploys a user's app at `https://APP-SLUG.apps.nyxid.ai`.
This skill is for the platform's own apps and for the routes under `/admin`. An internal
app needs the permission for its namespace, which the NyxID role
`chrono-cd-ns-<namespace>` carries (usually through a group such as `devops`); the admin
routes need `chrono-cd-admin`, which also reaches every namespace. Read the `chrono-cd` skill first: the app
spec, secrets, status, logs, telemetry and the transport rules are the same and are not
repeated here.

"You" below means the agent. "The user" is the platform admin you act for.

Every call is shown twice: as the CLI line and as the proxy tool call (service
`chrono-cd`, method, path, body). Use one transport for the whole conversation.

## Step 0: confirm what the caller may do

```bash
nyxid proxy request chrono-cd api/v1/account --output json
```

Proxy tool: `chrono-cd`, `GET`, `/api/v1/account`.

`can_internal` must be `true` for the internal apps below, `is_admin` for the admin
routes. If neither is, stop: nothing in this skill will work, and the user should use
the `chrono-cd` skill instead. With `can_internal` the answer also carries
`internal_namespaces`, the namespaces this user may deploy to (for example
`["chrono-bot", "chrono-cma"]`; an admin may use any `chrono-*` name and sees only
those granted by name), and `internal_domains`, the domains an internal app may use,
default first (today `chrono-ai.fun` and `nyxid.ai`).

## Internal apps

### What is different from a user app

- **Scope and namespace:** the user picks one of their `internal_namespaces`, say
  `chrono-bot`, and you add `?org_id=internal:chrono-bot` to every project route, or
  `"target_org_id": "internal:chrono-bot"` in the `PUT` body (the two must agree when
  both are given). Plain `internal` works only when the user has exactly one namespace.
  The app runs in that Kubernetes namespace, not in a hashed `cd-*` one, and the
  namespace is its own owner with its own quota. A namespace the user is not granted
  answers `403`; a name outside `chrono-*` answers `400`. An app cannot move between
  namespaces. Ask the user which namespace when the request does not say.
- **Hostname:** `https://APP.DOMAIN` with no owner label, for example
  `https://probe.chrono-ai.fun` for `PUT /projects/devops/apps/probe?org_id=internal:chrono-bot`.
  The app name is the hostname's first label, so pick it with care; it cannot change.
- **Domain:** the default is the first of `internal_domains`. To use another, add
  `"domain": "nyxid.ai"` to the body of the `PUT` that creates the app. The domain is a
  snapshot: later `PUT`s may repeat it or leave it out, but naming a different one is a
  `400 validation_error`. To move an app, create it under a new name and delete the old.
  Outside the internal scope `domain` is refused.
- **Reserved hostnames:** names platform services answer on are refused with
  `400 validation_error`: `cd`, `apps`, `pubsub`, `www`, `nyx`, `nyx-api`, `sandbox`,
  `fkst`, `fkst-api`, `bot`, `bot-api`, `oracle` under `chrono-ai.fun`, and `www` under
  `nyxid.ai`. Pick another name.
- **DNS:** the platform creates the hostname's DNS record from the route. `status` stays
  `progressing` with `route.serving: false` until the public edge answers through the
  platform gateway, usually 3 to 8 minutes after the route is accepted. Poll every 15
  seconds for up to 10 minutes. Do not tell the user it is live before `phase` is `ready`.
- **One owner per namespace:** `owner` is `internal:chrono-bot`, `owner_type` is
  `internal`, with one quota per namespace (the organization default to begin with:
  8 CPU, 16Gi, 40 pods, 80Gi). `created_by` records who acted. App names and service
  names are unique within a namespace, so a `409 service_name_taken` means another app
  in that namespace already uses the service name.

Everything else is identical to the `chrono-cd` skill: the spec table, secrets, restart,
logs, telemetry, delete with `purge=true`.

### Deploy one

```bash
nyxid proxy request chrono-cd "api/v1/projects/devops/apps/probe?org_id=internal:chrono-bot" --method PUT \
  --data '{"domain": "chrono-ai.fun", "services": {"probe": {"image": "ghcr.io/chronoaiproject/probe:1.2.0", "port": 8080, "routes": ["/"], "health_path": "/healthz"}}}' \
  --output json
```

Proxy tool: `chrono-cd`, `PUT`, `/api/v1/projects/devops/apps/probe?org_id=internal:chrono-bot`, body: that spec.

The answer is the app view with `hostname` `probe.chrono-ai.fun`, `url`, `namespace`
`chrono-bot`, `owner` `internal:chrono-bot`. Then set secrets if the spec declares any,
and wait:

```bash
nyxid proxy request chrono-cd "api/v1/projects/devops/apps/probe/status?org_id=internal:chrono-bot" --output json
```

Proxy tool: `chrono-cd`, `GET`, `/api/v1/projects/devops/apps/probe/status?org_id=internal:chrono-bot`.

### List, inspect, remove

```bash
nyxid proxy request chrono-cd "api/v1/projects?org_id=internal:chrono-bot" --output json
nyxid proxy request chrono-cd "api/v1/projects/devops/apps?org_id=internal:chrono-bot" --output json
nyxid proxy request chrono-cd "api/v1/projects/devops/apps/probe/logs?org_id=internal:chrono-bot&service=probe&tail=200" --output json
nyxid proxy request chrono-cd "api/v1/projects/devops/apps/probe?org_id=internal:chrono-bot&purge=true" --method DELETE --output json
```

Proxy tool: the same paths with `GET`, `GET`, `GET` and `DELETE`.

`purge=true` also drops the add-on database and the volumes. Without it they are kept
for a later re-create under the same name.

## Admin routes

All under `/api/v1/admin`. `403` means the token lacks the `chrono-cd-admin` role.

### The base domain of new user apps

```bash
nyxid proxy request chrono-cd api/v1/admin/settings --output json
nyxid proxy request chrono-cd api/v1/admin/settings --method PUT --data '{"base_domain": "apps.nyxid.ai"}' --output json
```

Proxy tool: `chrono-cd`, `GET` or `PUT`, `/api/v1/admin/settings`.

The setting applies to apps created from then on; existing apps keep their hostname and
keep working. Moving it is an infrastructure change first: the new domain needs a
wildcard DNS record to the gateway, an edge certificate, a Gateway listener and an entry
in chrono-cd's `CHRONO_CD_BASE_DOMAIN_LISTENERS`. Do not `PUT` a domain the user has not
confirmed is prepared; the runbook in the chrono-cd repository lists the steps. Today
the setting is `apps.nyxid.ai`; `apps.chrono-ai.fun` is still served for older apps.

### Owners and quotas

```bash
nyxid proxy request chrono-cd api/v1/admin/owners --output json
nyxid proxy request chrono-cd api/v1/admin/owners/SLUG --output json
nyxid proxy request chrono-cd api/v1/admin/owners/SLUG/quota --method PUT \
  --data '{"cpu_request": "4", "memory_request": "8Gi", "pods": 20, "storage": "40Gi"}' --output json
```

Proxy tool: `chrono-cd`, `GET` `/api/v1/admin/owners`, `GET` `/api/v1/admin/owners/SLUG`,
`PUT` `/api/v1/admin/owners/SLUG/quota` with that body.

`SLUG` is the owner's hashed `slug` (not `host_slug`); an internal namespace is an owner
too, `owner_type` `internal` with its `namespace`. Each owner row carries `quota`,
`usage` and `apps`, so you can see whether a raise is needed before granting it. The
quota `PUT` re-renders the namespace limits at once. All four fields are required.

### Quota requests

```bash
nyxid proxy request chrono-cd "api/v1/admin/quota-requests?status=pending&limit=100" --output json
nyxid proxy request chrono-cd api/v1/admin/quota-requests/ID/approve --method POST \
  --data '{"note": "ok for the launch", "quota": {"cpu_request": "4", "memory_request": "8Gi", "pods": 20, "storage": "40Gi"}}' --output json
nyxid proxy request chrono-cd api/v1/admin/quota-requests/ID/reject --method POST --data '{"note": "..."}' --output json
```

Proxy tool: `chrono-cd`, `GET` `/api/v1/admin/quota-requests?status=pending&limit=100`,
`POST` `/api/v1/admin/quota-requests/ID/approve` or `.../reject` with that body.

Show the user the request's `reason`, `requested` and the owner's current `usage`
before deciding. `quota` on approve is optional; without it the requested numbers are
granted as asked. Approving applies the quota immediately. Tell the user the requester
sees the decision on their own `GET /quota-requests`.

### Apps across owners, and repairing drift

```bash
nyxid proxy request chrono-cd "api/v1/admin/apps?owner=SLUG" --output json
nyxid proxy request chrono-cd api/v1/admin/apps/SLUG/APP --output json
nyxid proxy request chrono-cd api/v1/admin/apps/SLUG/APP/reconcile --method POST --output json
```

Proxy tool: `chrono-cd`, `GET` `/api/v1/admin/apps?owner=SLUG` (omit `owner` for all),
`GET` `/api/v1/admin/apps/SLUG/APP`, `POST` `/api/v1/admin/apps/SLUG/APP/reconcile`.

Reconcile re-applies the stored desired state. Use it when someone changed or deleted a
cluster object by hand. It does not re-resolve images and does not move hostnames; for
those the owner (or you, in their scope) sends a new `PUT`.

## Rules that matter

- **Confirm before writes that touch other people:** a quota change, an approval or a
  rejection, a reconcile, and above all the base domain. Read first, show the user, act.
- **Never deploy a user's app in the internal scope.** Internal is for platform
  services only. A user's app belongs in their personal or organization scope.
- **Do not guess a hostname.** Give the user the `url` from the app view.
- **Keep secrets out of the chat.** Secret values go straight into the secrets call.

## References

`references/api.md` is the contract for the internal scope and the admin routes, every
field and response. `references/errors.md` lists every error key. The `chrono-cd` skill
holds the rest of the API. If the API and this manual disagree, the API is right.
