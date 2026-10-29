# chrono-cd API: the internal scope and the admin routes

Base path: `/api/v1`. Reached through the NyxID proxy as
`https://nyx-api.chrono-ai.fun/api/v1/proxy/s/chrono-cd/api/v1/...` with the caller's NyxID
credential. An internal namespace needs the permission `chrono-cd:internal:<namespace>`
in the token (NyxID role `chrono-cd-ns-<namespace>`, usually through a group), the admin
routes `chrono-cd:admin` (role `chrono-cd-admin`, which also grants every namespace);
anyone else answers `403`. No NyxID lookup is involved: the role is a claim of the identity token.

This file completes the `chrono-cd` skill's `references/api.md`, which holds the scope
rules for personal and organization access, the app spec, and every project route.
Fields are added, never renamed or removed. Errors are listed in `errors.md`.

## Identity, for an internal deployer or admin

`GET /account` answers the same object as for any caller, plus:

```json
{
  "can_deploy": true,
  "can_internal": true,
  "is_admin": false,
  "internal_domains": ["chrono-ai.fun", "nyxid.ai"],
  "internal_namespaces": ["chrono-bot", "chrono-cma"],
  "internal_clusters": {"chrono-alert": "tokyo"},
  "...": "slug, host_slug, namespace, quota, usage, apps, organizations as usual"
}
```

`internal_clusters` maps the namespaces the caller may use that live on a remote
cluster to that cluster; a namespace not listed is on the local (Singapore) cluster. The
caller never names a cluster: the same `org_id=internal:<namespace>` reaches the
namespace wherever it lives, and the app view answers `cluster` when it is remote.

`can_internal` is true when the token names at least one internal namespace or carries
the admin permission, and the deployment has internal domains. `internal_namespaces`
lists, sorted, the namespaces the token names outright; an admin may use any `chrono-*`
name, so an admin's list holds only the named ones. Without `can_internal` the internal
scope answers `403`.

## The internal scope

The platform has one scope per internal namespace for its own apps, such as a probe, a
status page or a bot run by the devops team. A scope is selected with the reserved id
`internal:<namespace>`: `org_id=internal:chrono-bot` on any project route, or
`"target_org_id": "internal:chrono-bot"` in a `PUT` body (the two must agree when both
are given). Plain `internal` works when the caller is granted exactly one namespace;
with several, `400 validation_error` names them. A namespace the caller is not granted
answers `403`; a name outside the `chrono-` prefix answers `400`; a namespace that
already exists on the cluster without chrono-cd's label answers `409 conflict`.

Internal apps differ from tenant apps in two ways: the hostname is directly under one
of the internal domains with no owner label, `https://<app>.<domain>`, for example
`https://probe.chrono-ai.fun`; and the app runs in the namespace the scope names,
`chrono-bot`, instead of a hashed `cd-*` namespace. chrono-cd creates the namespace on
the first deploy, on the cluster the platform binds it to. `domain` must be one the
owner's cluster serves; the error lists them. A platform component in another namespace
of the same cluster, such as Alertmanager, reaches an internal app's service when the
service declares `ingress_from_namespaces: ["monitoring"]`.

### `PUT /projects/{project}/apps/{app}?org_id=internal:<namespace>`

The body is the normal app spec plus one optional field:

```json
{
  "domain": "nyxid.ai",
  "services": {"...": "as in the chrono-cd skill"}
}
```

| Field | Meaning |
|---|---|
| `domain` | One of `internal_domains`. Omitted on create means the default (the first). It is a snapshot: a later `PUT` may repeat it or leave it out; naming another answers `400 validation_error`. Outside the internal scope it is refused. |

A few hostnames are refused with `400 validation_error` because platform services answer
on them. On the live platform: `cd`, `apps`, `pubsub`, `www`, `nyx`, `nyx-api`,
`sandbox`, `fkst`, `fkst-api`, `bot`, `bot-api` and `oracle` under `chrono-ai.fun`, and
`www` under `nyxid.ai`. The list is the deployment's `CHRONO_CD_INTERNAL_RESERVED_HOSTS`.

The app view answers with:

```json
{
  "project": "devops",
  "name": "probe",
  "owner": "internal:chrono-bot",
  "owner_type": "internal",
  "owner_slug": "<hashed slug of that owner>",
  "namespace": "chrono-bot",
  "cluster": "tokyo (only when the namespace lives on a remote cluster)",
  "hostname": "probe.chrono-ai.fun",
  "url": "https://probe.chrono-ai.fun",
  "base_domain": "chrono-ai.fun",
  "created_by": "<subject of the admin who created it>",
  "...": "spec, addons, generation, revision, status as usual"
}
```

Everything else is the same as a tenant app: each namespace is one owner with one quota
(the organization default to begin with; `PUT /admin/owners/{slug}/quota` raises it),
the same secrets, status, logs, revisions and telemetry routes, the same `DELETE` with
`purge=true`. App and service names are unique within a namespace.

### DNS and readiness

The platform's DNS controller creates one proxied `A` record per internal hostname from
the app's route (it selects routes by the owner-type label) and removes it when the app
is deleted. `GET .../status` keeps `phase: progressing` and `route.serving: false` until
the public edge answers for the hostname through the platform gateway; the probe counts an
answer without the gateway's `Via` header as not served, so a stale wildcard record
pointing elsewhere never looks ready. Expect 3 to 8 minutes after `route.accepted`.

## Admin

All routes under `/admin`.

| Method and path | Body / response |
|---|---|
| `GET /admin/settings` | `{"base_domain": "apps.nyxid.ai", "updated_at": "...", "updated_by": "<subject>", "applies_to": "new projects"}` |
| `PUT /admin/settings` | `{"base_domain": "apps.example.com"}`. Applies to apps created from then on; existing apps keep their hostnames and their Gateway listener. The domain must be a DNS name. The infrastructure for it (wildcard record, edge certificate, Gateway listener, `CHRONO_CD_BASE_DOMAIN_LISTENERS` entry) must exist first. |
| `GET /admin/owners` | `{"owners": [{"id", "slug", "host_slug", "owner_type", "namespace", "cluster", "quota", "usage", "apps", "created_at", "updated_at"}]}`. `owner_type` is `person`, `org` or `internal`; `cluster` is present for an internal owner on a remote cluster. |
| `GET /admin/owners/{slug}` | One owner, by hashed `slug`. |
| `PUT /admin/owners/{slug}/quota` | `{"cpu_request": "4", "memory_request": "8Gi", "pods": 20, "storage": "40Gi"}`, all four required, Kubernetes quantities. Re-renders the namespace ResourceQuota and LimitRange at once. Answers the owner. |
| `GET /admin/apps?owner=<slug>` | `{"apps": [...]}` across owners; `owner` narrows to one. Each app is the app view. |
| `GET /admin/apps/{slug}/{app}` | One app, by owner slug and app name. |
| `POST /admin/apps/{slug}/{app}/reconcile` | Re-applies the stored desired state. Repairs drift; does not re-resolve images or move hostnames. Answers the app view; a failure is `502 reconcile_failed`. |
| `GET /admin/quota-requests?status=pending&limit=100` | `{"quota_requests": [...]}` across owners, newest first. `status` is `pending`, `approved` or `rejected`; omitted means all. |
| `POST /admin/quota-requests/{id}/approve` | `{"note": "...", "quota": {...}}`. `quota` is optional and replaces the requested numbers. Applies the quota to the owner, re-renders the namespace limits, and answers the request with `status: approved`, `decided_by`, `decided_at`, `granted`. |
| `POST /admin/quota-requests/{id}/reject` | `{"note": "..."}`. Answers the request with `status: rejected`. |

A quota request has this shape (the same object the requester sees on their own
`GET /quota-requests`):

```json
{
  "id": "...", "owner": "...", "owner_type": "org", "owner_slug": "7d1c1e3f5b", "requested_by": "...",
  "requested": {"cpu_request": "4", "memory_request": "8Gi", "pods": 20, "storage": "40Gi"},
  "reason": "launching mathesis", "status": "pending", "created_at": "...",
  "decided_by": "...", "decided_at": "...", "note": "...", "granted": {"...": "when approved"}
}
```

One request per owner may be pending at a time; a second `POST /quota-requests` by the
owner answers `409 quota_request_pending` until this one is decided.
