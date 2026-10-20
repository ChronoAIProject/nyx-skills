# chrono-cd API

Base path: `/api/v1`. Reached through the NyxID proxy as
`https://nyx-api.chrono-ai.fun/api/v1/proxy/s/chrono-cd/api/v1/...` with the caller's NyxID
credential. A direct call to `https://cd.chrono-ai.fun` without NyxID's identity token
answers 401 (see `docs/protocol/auth.md`).

This file is the contract with callers. Fields are added, never renamed or removed.

Errors are listed in `errors.md`. Timestamps are RFC 3339 in UTC. Quantities are Kubernetes quantities (`250m`, `512Mi`).

## Scope: personal or organization

Every project route works in a scope. The default scope is the caller's own: the owner is
the token's subject. An organization scope is selected with the query parameter
`org_id=<organization id>` on any project route, or `target_org_id` in the body of `PUT
/projects/{project}/apps/{app}` (the two must agree when both are given).

To let a client or an agent choose, `GET /organizations` lists the organizations the
caller belongs to, with their role in each:

```json
{"organizations": [{"id": "6f1c...", "slug": "acme", "display_name": "Acme", "role": "admin"}]}
```

The same list is embedded in `GET /account` as `organizations`.

For an organization scope chrono-cd asks NyxID, with the caller's own access token, whether
the caller is a current member (`GET /api/v1/orgs/{id}/authorization`). This happens on
every request and is never cached. NyxID forwards that token only when the service is
registered with `forward_access_token: true`; without it, organization routes answer `403`
and `GET /organizations` answers `403`. A caller who is not a member of the organization
gets `404`, the same as for an organization that does not exist.

| Role in the organization | May |
|---|---|
| `admin` | Create, change, delete projects; set secrets; restart; rotate add-ons; read everything. |
| `member`, `viewer` | Read: list, get, status, logs, revisions. Writes answer `403`. |

An organization-owned NyxID API key is the organization itself: its subject is the
organization id, so its personal scope is the organization's scope, with admin rights.
Organization projects carry `owner` = the organization id, `owner_type` = `org`, and
`created_by` / `updated_by` = the person who acted.

## Identity

`GET /account`

```json
{
  "subject": "11111111-1111-4111-8111-111111111111",
  "owner_type": "person",
  "roles": [],
  "is_admin": false,
  "nyx_service_id": "...",
  "slug": "7d1c1e3f5b",
  "namespace": "cd-7d1c1e3f5b",
  "quota": {"cpu_request": "2", "memory_request": "4Gi", "pods": 10, "storage": "20Gi"},
  "usage": {"cpu_request": "200m", "memory_request": "256Mi", "pods": 2, "storage": "0"},
  "apps": 1,
  "organizations": [{"id": "6f1c...", "slug": "acme", "display_name": "Acme", "role": "admin"}]
}
```

`slug`, `namespace`, `quota`, `usage` and `apps` describe the caller's personal
account. `organizations` is present when the request carried the caller's credential;
`organizations_unavailable: true` means NyxID could not be asked. Personal access never
depends on that lookup.

## Projects and apps

A **project** groups the apps that belong together, for example `chronoai` holding
`chrono-cd` and `chrono-pod`. It is a name, nothing more: it exists while it has at least
one app, and it needs no create call. An **app** is one deployable application: one
hostname, `https://<app>-<slug>.<base_domain>`, one or more services, optional add-ons.
All apps of an owner share the owner's namespace and quota, so app names and service
names are unique per owner, across projects.

### `GET /projects`

`{"projects": [{"name": "chronoai", "apps": 2, "updated_at": "..."}]}` for the scope.

### `PUT /projects/{project}/apps/{app}`

Creates (201) or replaces (200) the app and applies it. `project` and `app` are each 1-40
lowercase letters, digits and inner hyphens; for `app`, `admin`, `api`, `www`,
`chrono-cd`, `nyx`, `nyx-api` and `gateway` are reserved. `PUT` is declarative: the body
replaces the whole spec. An app cannot move: a `PUT` under another project answers
`409 app_exists`. Optional header `If-Match: <generation>`. Optional `target_org_id`
selects an organization scope (see above).

```json
{
  "target_org_id": "6f1c...",
  "addons": {"mongodb": {}},
  "registry_credential": {"username": "octocat", "token": "ghp_..."},
  "services": {
    "web": {
      "image": "ghcr.io/the-omega-institute/wishpool-web:0.2.0",
      "port": 8080,
      "health_path": "/",
      "replicas": 2,
      "routes": ["/"],
      "resources": {"cpu_request": "20m", "memory_request": "32Mi", "cpu_limit": "250m", "memory_limit": "128Mi"},
      "volumes": [{"name": "tmp", "mount_path": "/tmp", "type": "emptydir", "size": "256Mi"}]
    },
    "wishpool-api": {
      "image": "ghcr.io/the-omega-institute/wishpool-api:0.2.0",
      "port": 8080,
      "health_path": "/readyz",
      "replicas": 2,
      "routes": ["/api", "/auth"],
      "env": {"WISHPOOL_BIND": "0.0.0.0:8080", "WISHPOOL_ROLE": "api"},
      "secret_keys": ["CHRONO_NYXID_CLIENT_ID", "CHRONO_NYXID_CLIENT_SECRET"],
      "addon_env": {"mongodb": {"uri": "WISHPOOL_MONGODB_URI", "database": "WISHPOOL_MONGODB_DATABASE"}}
    },
    "worker": {
      "image": "ghcr.io/the-omega-institute/wishpool-api:0.2.0",
      "port": 8080,
      "health_path": "/readyz",
      "expose": "internal",
      "env": {"WISHPOOL_ROLE": "worker"},
      "addon_env": {"mongodb": {"uri": "WISHPOOL_MONGODB_URI"}},
      "volumes": [{"name": "tex-cache", "mount_path": "/var/cache/texmf", "type": "pvc", "size": "5Gi"}]
    },
    "verifier": {
      "image": "ghcr.io/the-omega-institute/wishpool-verifier:0.2.0",
      "port": 8081,
      "health_path": "/readyz",
      "expose": "internal",
      "egress": "none",
      "ingress_from": ["wishpool-api", "worker"],
      "resources": {"cpu_request": "1", "memory_request": "2Gi", "cpu_limit": "2", "memory_limit": "8Gi"}
    }
  }
}
```

Service fields:

| Field | Rule |
|---|---|
| `image` | `ghcr.io/<owner>/<package>:<tag>` or `@sha256:<digest>`. Resolved to a digest at every apply; the Deployment is pinned to it. A new push to the same tag is picked up by `PUT` again or by `restart`. |
| `port` | 1-65535. Required unless `expose` is `none`. Immutable. |
| `health_path` | Default `/`. The readiness, liveness and startup probes, and the load balancer health check, use it. |
| `replicas` | 0 to the platform maximum (3). Default 1. A service with a `pvc` volume runs 1. |
| `routes` | Path prefixes on the app hostname. Unique across the app. Longest prefix wins. Setting routes makes the service `public`. |
| `expose` | `public` (routes), `internal` (in-cluster Service only, default without routes), `none` (no Service). |
| `env` | Plain, non-secret variables. Up to 60 keys, 4 KiB each. |
| `secret_keys` | Names of secret variables set through the secrets endpoint. The service is not deployed until all are present. |
| `addon_env` | Per add-on, which variable receives which connection field. MongoDB fields: `uri`, `database`, `username`, `password`. |
| `egress` | Empty (internet allowed, private ranges blocked) or `none`. |
| `ingress_from` | Sibling services that may reach this one; others in the namespace are blocked. |
| `volumes` | Up to 4. `type` `pvc` (persistent, 100Mi or more) or `emptydir` (scratch, up to 32Gi). |
| `files` | Plain configuration files: `[{"path": "/etc/app/config.yaml", "content": "..."}]`. Up to 16, 64 KiB each, 256 KiB in total. Mounted read-only at the path; versioned with the spec. Secret files go through the secrets endpoint instead. |
| `resources` | Defaults 100m / 128Mi requests, 500m / 512Mi limits. Limits may not exceed twice the owner's quota request. |

Every service is reachable inside the owner's namespace as `http://<service>:<port>` and
`http://<service>:80`, so an app's own proxy configuration works unchanged.

Images run as plain containers under the strict profile: non-root, no capabilities, no
privilege escalation. An image that must start as root fails with
`CreateContainerConfigError` in `status`; rebuild it to run as a non-root user.

Private packages need a pull credential. Two ways:

- **GitHub connection** (when the platform enabled it; see the runbook). Connect GitHub to NyxID once with the packages scope:
  `nyxid connect github --scope read:packages`. NyxID then passes that token to chrono-cd
  with every request. chrono-cd probes each image anonymously first; only when a package
  is private does it use the token, and it stores it as the app's pull Secret. The app
  view shows `"registry_credential_source": "github-connection"`. A later `PUT` with a
  fresh token replaces the stored copy; a `PUT` whose images are all public removes it.
  A private image with no connection, or a connection without the scope, answers
  `400 image_unauthorized` with that command in the message.
- **`registry_credential` in the body** for callers with no GitHub connection, such as a
  CI job on an organization key: `{"username": "<github login>", "token": "<classic PAT
  with read:packages>"}`. It wins over the connection and shows as
  `"registry_credential_source": "request"`.

Either way the token is write-only: it is stored as a pull Secret in the owner's
namespace and never returned, logged or audited. `{"remove": true}` deletes it.

Response: the app view.

```json
{
  "project": "omega",
  "name": "mathesis",
  "owner": "11111111-1111-4111-8111-111111111111",
  "owner_type": "person",
  "owner_slug": "7d1c1e3f5b",
  "namespace": "cd-7d1c1e3f5b",
  "hostname": "mathesis-7d1c1e3f5b.apps.chrono-ai.fun",
  "url": "https://mathesis-7d1c1e3f5b.apps.chrono-ai.fun",
  "base_domain": "apps.chrono-ai.fun",
  "spec": {"...": "the normalized spec, with image_digest per service"},
  "addons": {"mongodb": {"database": "cd_7d1c1e3f5b_mathesis", "user": "cd_7d1c1e3f5b_mathesis", "provisioned_at": "2026-10-19T12:00:00Z"}},
  "secret_keys_present": {"wishpool-api": ["CHRONO_NYXID_CLIENT_ID", "CHRONO_NYXID_CLIENT_SECRET"]},
  "has_registry_credential": true,
  "registry_username": "octocat",
  "registry_credential_source": "request",
  "generation": 3,
  "revision": 2,
  "status": {"phase": "applied", "last_reconcile": {"at": "2026-10-19T12:00:05Z", "ok": true, "revision": 2}},
  "created_at": "2026-10-19T11:00:00Z",
  "updated_at": "2026-10-19T12:00:05Z",
  "created_by": "11111111-1111-4111-8111-111111111111",
  "updated_by": "11111111-1111-4111-8111-111111111111"
}
```

`status.phase` is the outcome of the last apply: `pending`, `applied`, `error` or
`deleting`. When an apply fails the error response carries the stored app under
`"app"` so the client can see what was kept.

`generation` increases on every accepted spec change and is the optimistic lock.
`revision` increases on every successful apply.

### `GET /projects/{project}/apps` and `GET /projects/{project}/apps/{app}`

`{"apps": [<app view>]}` for the apps of the project, or one app view. An app that lives
in another project is `404` under this one.

### `DELETE /projects/{project}/apps/{app}?purge=true`

Removes every object of the app, the add-on user, and the record. `purge=true` also
drops the add-on data. Answers `{"project": "<project>", "deleted": "<app>", "purged": <bool>}`.

### `PUT /projects/{project}/apps/{app}/services/{service}/secrets`

Body `{"KEY": "value", ...}`. Keys are merged into the service's Secret and the app is
applied. The response lists key names only: `{"service": "web", "keys": ["KEY"]}`. Values
never appear in responses, logs or the audit trail.

`DELETE /projects/{project}/apps/{app}/services/{service}/secrets/{key}` removes one key.

Changing a secret value rolls the service: the pod template carries a digest of the
service's secrets, so pods restart with the new values.

### `PUT /projects/{project}/apps/{app}/services/{service}/secret-files`

Body `{"files": [{"path": "/etc/app/key.pem", "content": "..."}]}`. Files are merged into
the service's secret-files Secret and mounted read-only at their paths. Up to 16 files,
256 KiB each, 512 KiB in total. A path may not be a config file of the service or inside
one of its volumes. The response lists paths only: `{"service": "api", "paths": [...]}`;
contents never appear in responses, logs or the audit trail. The app view lists the
paths as `secret_files_present`.

`DELETE /projects/{project}/apps/{app}/services/{service}/secret-files?path=/etc/app/key.pem` removes
one file.

### `POST /projects/{project}/apps/{app}/restart?service=<name>`

Rolls one service of the app, or every service when `service` is omitted.

### `POST /projects/{project}/apps/{app}/addons/mongodb/rotate`

Issues a new database password and rolls the services that read it.

### `GET /projects/{project}/apps/{app}/status`

Live state from the cluster.

```json
{
  "phase": "ready",
  "services": {
    "web": {"phase": "ready", "found": true, "replicas": 2, "ready": 2, "updated": 2, "available": 2,
            "conditions": [{"type": "Available", "status": "True", "reason": "MinimumReplicasAvailable"}],
            "pods": [{"name": "web-7d9f-abcde", "phase": "Running", "ready": true, "restarts": 0, "state": "running", "started_at": "..."}]}
  },
  "route": {"found": true, "accepted": true, "resolved_refs": true},
  "addons": {"mongodb": {"database": "...", "user": "...", "provisioned_at": "..."}},
  "last_reconcile": {"at": "...", "ok": true, "revision": 2}
}
```

`phase` is `ready`, `progressing`, `degraded` (a pod is in `ImagePullBackOff`,
`CrashLoopBackOff`, `OOMKilled` or `CreateContainerConfigError`, or the rollout timed out),
`error` (the last apply failed) or `deleting`. Pod `reason` and `message` carry the
container's own words.

### `GET /projects/{project}/apps/{app}/logs?service=<name>&tail=100&pod=<pod>`

`{"service": "web", "pods": [{"pod": "web-...", "logs": "..."}]}`. `tail` is at most 1000.

### `GET /projects/{project}/apps/{app}/revisions?limit=50`

`{"revisions": [{"revision": 2, "generation": 3, "action": "update", "actor": "...", "at": "...", "ok": true,
"services": {"web": {"image": "...", "image_digest": "sha256:...", "replicas": 2}}}]}`, newest first.

## Quota requests

An owner asks for a different quota; only a platform admin decides. A personal owner, an
org admin, or an org-owned key may ask (`org_id` selects the organization). One request per
owner may be pending at a time.

### `POST /quota-requests`

```json
{"cpu_request": "4", "memory_request": "8Gi", "pods": 20, "storage": "40Gi", "reason": "launching mathesis"}
```

Answers `201` with the request, or `409 quota_request_pending` when one is already waiting.

```json
{
  "id": "...", "owner": "...", "owner_type": "org", "owner_slug": "7d1c1e3f5b", "requested_by": "...",
  "requested": {"cpu_request": "4", "memory_request": "8Gi", "pods": 20, "storage": "40Gi"},
  "reason": "launching mathesis", "status": "pending", "created_at": "..."
}
```

`status` becomes `approved` or `rejected`; a decided request carries `decided_by`,
`decided_at`, `note` and, when approved, `granted`, the quota the admin applied (it may
differ from `requested`).

### `GET /quota-requests`

`{"quota_requests": [...]}` for the scope, newest first. Members and viewers may read.

## Admin

Admin routes need the NyxID RBAC role `admin` in the token.

| Method and path | Body / response |
|---|---|
| `GET /admin/settings` | `{"base_domain": "apps.chrono-ai.fun", "updated_at": "...", "updated_by": "...", "applies_to": "new projects"}` |
| `PUT /admin/settings` | `{"base_domain": "apps.example.com"}`. Existing apps keep their hostnames. |
| `GET /admin/owners` | `{"owners": [{"id", "slug", "owner_type", "namespace", "quota", "usage", "apps", "created_at", "updated_at"}]}` |
| `GET /admin/owners/{slug}` | One owner. |
| `PUT /admin/owners/{slug}/quota` | `{"cpu_request": "4", "memory_request": "8Gi", "pods": 20, "storage": "40Gi"}`. Re-renders the namespace ResourceQuota and LimitRange. |
| `GET /admin/apps?owner=<slug>` | `{"apps": [...]}` across owners. |
| `GET /admin/apps/{slug}/{app}` | One app, by owner slug and app name. |
| `POST /admin/apps/{slug}/{app}/reconcile` | Re-applies the stored desired state. Repairs drift; does not re-resolve images or move hostnames. |
| `GET /admin/quota-requests?status=pending&limit=100` | Requests across owners, newest first. |
| `POST /admin/quota-requests/{id}/approve` | `{"note": "...", "quota": {...}}`. `quota` is optional and replaces the requested numbers. Applies the quota to the owner and re-renders the namespace limits. |
| `POST /admin/quota-requests/{id}/reject` | `{"note": "..."}`. |
