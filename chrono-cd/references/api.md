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
  "can_deploy": true,
  "can_internal": false,
  "is_admin": false,
  "nyx_service_id": "...",
  "slug": "7d1c1e3f5b",
  "host_slug": "7d1c1e3f5b",
  "namespace": "cd-7d1c1e3f5b",
  "quota": {"cpu_request": "2", "memory_request": "4Gi", "pods": 10, "storage": "20Gi"},
  "usage": {"cpu_request": "200m", "memory_request": "256Mi", "pods": 2, "storage": "0"},
  "apps": 1,
  "organizations": [{"id": "6f1c...", "slug": "acme", "display_name": "Acme", "role": "admin"}]
}
```

`slug`, `namespace`, `quota`, `usage` and `apps` describe the caller's personal
account. `host_slug` is the label in the caller's app hostnames: the same as `slug` for a
person. With `org_id`, the same fields describe the organization, whose `host_slug` is
its NyxID slug once a member has reached it, or the hashed `slug` until then. `organizations` is present when the request carried the caller's credential;
`organizations_unavailable: true` means NyxID could not be asked. Personal access never
depends on that lookup. `can_deploy` is what every route here needs (permission
`chrono-cd:deploy`; without it `403`). `can_internal` and `is_admin` unlock the routes
and fields described in the `chrono-cd-internal` skill.

## Projects and apps

A **project** groups the apps that belong together, for example `chronoai` holding
`chrono-cd` and `chrono-pod`. It is a name, nothing more: it exists while it has at least
one app, and it needs no create call. An **app** is one deployable application: one
hostname, `https://<app>-<host_slug>.<base_domain>`, one or more services, optional
add-ons. The host slug is the owner's hashed `slug` for a person and the organization's
NyxID slug for an organization, for example `mathesis-chronoai.apps.chrono-ai.fun`; it is
the `host_slug` of `/account`. The base domain is the platform's current app domain,
`apps.nyxid.ai`; an app keeps the one it was created with (`base_domain` in the app view),
so older apps stay on `apps.chrono-ai.fun`. The hostname is fixed when the app is created.
All apps of an owner share the owner's namespace and quota, so app names and service
names are unique per owner, across projects.

### `GET /apps?scope=personal|organization`

Everything the caller can see, in one call: the apps of the personal scope and of each
organization the caller belongs to.
It is the starting point for "what is deployed". `scope` is optional and keeps one kind
of scope; any other value is `400 validation_error`.

```json
{
  "personal": {
    "owner_type": "person",
    "owner_slug": "7d1c1e3f5b",
    "host_slug": "7d1c1e3f5b",
    "namespace": "cd-7d1c1e3f5b",
    "apps": [
      {
        "project": "chronoai",
        "name": "blog",
        "hostname": "blog-7d1c1e3f5b.apps.nyxid.ai",
        "url": "https://blog-7d1c1e3f5b.apps.nyxid.ai",
        "services": [{"name": "web", "image": "ghcr.io/acme/blog:1.4.0", "replicas": 2}],
        "addons": ["mongodb"],
        "phase": "applied",
        "last_reconcile": {"at": "...", "ok": true, "revision": 7},
        "generation": 9,
        "revision": 7,
        "created_at": "...",
        "updated_at": "...",
        "updated_by": "11111111-1111-4111-8111-111111111111"
      }
    ]
  },
  "organizations": [
    {
      "org_id": "6f1c...",
      "slug": "acme",
      "display_name": "Acme",
      "role": "admin",
      "owner_type": "org",
      "owner_slug": "c24787a75c",
      "host_slug": "acme",
      "namespace": "cd-c24787a75c",
      "apps": []
    }
  ],
  "internal": [],
  "total": 1
}
```

Each scope carries `org_id`, the value to pass as `org_id` on the project routes to work
in it. The personal scope has none. Apps are sorted by project, then name. Organizations
are sorted by display name. `total` counts the apps in the answer.

An app here is a summary. It names the services with their image and replica count
(with `autoscaling`, the declared range, and `replicas` is then its floor), the
add-ons, and the stored outcome of the last reconcile (`phase`, `last_reconcile`). It
does not carry the env, the files or the secret names; read the app for those. It does
not ask the cluster either, so it says nothing about pods; `GET .../status` does.

The route only reads. A scope where nothing was ever deployed is listed with an empty
`apps` and without `owner_type`, `owner_slug` and `host_slug`, because the owner record
is created by the first deploy. An organization has no `namespace` until then.

`personal` is absent with `scope=organization`. `organizations` is always a list.
`internal` is an empty list; ignore it. `organizations_unavailable: true` means the caller's organizations
could not be listed, because the request carried no credential or NyxID did not answer.
The rest of the answer is still complete. Members and viewers of an organization see its
apps; `role` tells them whether they may change them.

### `GET /projects`

`{"projects": [{"name": "chronoai", "apps": 2, "updated_at": "..."}]}` for the scope.

### `PUT /projects/{project}/apps/{app}`

Creates (201) or replaces (200) the app and applies it. `project` and `app` are each 1-40
lowercase letters, digits and inner hyphens; for `app`, `admin`, `api`, `www`,
`chrono-cd`, `nyx`, `nyx-api` and `gateway` are reserved. `PUT` is declarative: the body
replaces the whole spec. An app cannot move: a `PUT` under another project answers
`409 app_exists`. Optional header `If-Match: <generation>`. Optional `target_org_id`
selects an organization scope.

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
      "metrics": {"port": 9090, "path": "/metrics"},
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
| `command` | Optional. 1 to 32 strings that replace the image's entrypoint (Kubernetes `command`). Without `args` the image's own arguments are dropped too, as in Kubernetes. At most 1024 bytes each and 4096 in total; the first names the program. Omitted or `[]` keeps the image's entrypoint; `PATCH` with `"command": null` removes it. All scopes. |
| `args` | Optional. 1 to 32 strings that replace the image's arguments (its `CMD`) and keep its entrypoint (Kubernetes `args`). Same bounds as `command`. Omitted or `[]` keeps the image's arguments; `PATCH` with `"args": null` removes them. All scopes. Described below. |
| `port` | 1-65535. Required unless `expose` is `none`. Immutable. |
| `health_path` | Default `/`. The readiness, liveness and startup probes, and the load balancer health check, use it. |
| `replicas` | 0 to the platform maximum (3). Default 1. A service with a `pvc` volume runs 1. Absent on a service that declares `autoscaling` instead. |
| `routes` | Path prefixes on the app hostname. Unique across the app. Longest prefix wins. Setting routes makes the service `public`. |
| `expose` | `public` (routes), `internal` (in-cluster Service only, default without routes), `none` (no Service). |
| `env` | Plain, non-secret variables. Up to 60 keys, 4 KiB each. |
| `pod_env` | Internal scope only. Map env names to `pod_name`, `pod_namespace`, `pod_uid`, `pod_ip`, or `node_name`; no arbitrary field paths. At most 60 `env` and `pod_env` entries combined. Names must be valid variables without the reserved `CHRONO_CD_` prefix and cannot collide with `env`, `secret_keys`, or `addon_env`. Downward API values render before literal env, so `"POD_IP": "pod_ip"` supports addresses such as `http://$(POD_IP):8080`. Choose address templates for the cluster IP family (IPv6 needs brackets). Omitted by default; no API token is mounted. |
| `termination_grace_seconds` | Internal scope only. Integer from 30 to the platform maximum (3600); omitted keeps the existing 30-second grace. Size it for the service: the `pre_stop` time plus the time the process needs after SIGTERM, plus a margin. Kubernetes charges preStop time against this same budget. The pod ends as soon as the process exits, so a long grace costs time only while work is still running. A rolling update does not wait for the old pod, so `progress_deadline_seconds` need not grow with the grace. A draining pod still counts against the namespace quota until it ends, and a deploy is admitted with room for one surge pod only: in a namespace with no spare quota, a second deploy during the drain, or the next replica of a service with more than one, waits for the draining pod and can pass `progress_deadline_seconds` while it waits. Keep spare quota for the pods that can be draining at once. A service with a persistent volume is replaced, not rolled: the new pod starts only after the old one has ended, the service is down for the whole drain, and a drain longer than `progress_deadline_seconds` shows the service as `degraded` until the new pod is ready; set a deadline longer than the drain to avoid that. |
| `pre_stop` | Internal scope only. Exactly one of `{"sleep_seconds": 30}` (native Kubernetes sleep, 1–300, strictly shorter than grace) or `{"exec": ["/app/drain", "--wait"]}`, a command of the service's own image, described below. Omitted means no lifecycle hook. |
| `service_account` | Internal scope only. Name (DNS label) of an existing ServiceAccount in this app's namespace, provisioned by infra. `default`, `app-runner`, and `chrono-cd` are reserved. Reconcile checks existence on the app's cluster; chrono-cd never creates, modifies, or deletes the selected account or its RBAC. Requires default egress. Only opted-in pods receive metadata egress, to the endpoints an admin set for the cluster with `PUT /admin/clusters/{cluster}/metadata-egress`; a cluster with none set refuses the deploy at step `identity-egress/<service>`. |
| `automount_token` | Internal scope only; optional boolean requiring `service_account`. Defaults to false even if the selected account enables mounting. Set true only when the reviewed application needs a projected Kubernetes token. Workload Identity and replica membership do not by themselves imply Pod-read RBAC. |
| `probes` | Internal scope only. Optional `readiness`, `liveness`, and `startup` objects, each with `path`, `period_seconds` (1–300), `timeout_seconds` (1–30), `failure_threshold` (1–180), and `initial_delay_seconds` (0–300). Optional `type`: `http` (default), or `tcp` for a service that does not speak HTTP, such as Redis; with `tcp` all three probes open a TCP connection to the service `port` instead of requesting a path, the periods, timeouts, thresholds and delays work as before, a `path` is refused, and so is `expose` `public`, because the load balancer health check is an HTTP request. All omitted fields retain the existing probe defaults, including liveness initial delay 10; set zero explicitly to remove that delay. Requires a service port. `health_path` remains the load-balancer readiness path. |
| `min_ready_seconds` | Internal scope only. Integer 0–300; default 0. A new replica must remain ready this long before being counted available. The reviewed replica profile uses 30. |
| `progress_deadline_seconds` | Internal scope only. Integer 60–7200; default 600. Must exceed the startup and readiness probe allowances plus `min_ready_seconds`; each allowance is initial delay + failure threshold × max(period, timeout). Set 2400 for the reviewed AM profile and 1200 for EG. This reports a stalled rollout; it does not kill pods or cancel drain. |
| `disruption_budget` | Internal scope only. `{"min_available": 1, "unhealthy_pod_eviction_policy": "AlwaysAllow"}` renders a PDB only when replicas > 1. `min_available` must be positive, within the owner replica cap, and below replicas when replicas > 1. With `autoscaling`, `min_replicas` stands for replicas in both rules. Policy is `AlwaysAllow` or `IfHealthyBudget` (Kubernetes default when omitted). Scaling to 0 or 1 retains the spec but removes the PDB; opt-out and service/app deletion remove it too. Protects voluntary evictions, not direct deletion or crashes. |
| `autoscaling` | Internal scope only. `{"min_replicas": 2, "max_replicas": 5, "cpu_utilization": 65}` in place of `replicas`: the platform renders a HorizontalPodAutoscaler (`autoscaling/v2`) that holds the service's average CPU use at `cpu_utilization` percent of its CPU request. All three are required: `1 <= min_replicas <= max_replicas <=` the owner's replica cap, `cpu_utilization` 10–95. Mutually exclusive with `replicas`: a body with both answers `400 validation_error`, and because a stored spec always carries `replicas`, a `PATCH` that opts in sends `"replicas": null` with the range, and one that opts out sends `"autoscaling": null` with the count. Refused with a `pvc` volume. The Deployment starts at `min_replicas`; after that the autoscaler owns the count, and no deploy, `PATCH`, restart, secret change or reconcile resets it. Quota counts `max_replicas` (plus the surge pod, as always), so `usage` shows the top of the range. To stop the service, opt out with `"replicas": 0`. Opt-out, removing the service and deleting the app remove the autoscaler. |
| `secret_keys` | Names of secret variables set through the secrets endpoint. The service is not deployed until all are present. |
| `addon_env` | Per add-on, which variable receives which connection field. MongoDB fields: `uri`, `database`, `username`, `password`. |
| `egress` | Empty (internet allowed, private ranges blocked) or `none`. |
| `ingress_from` | Sibling services that may reach this one; others in the namespace are blocked. |
| `ingress_from_namespaces` | Other namespaces whose pods may reach this service on its `port`, up to 8 names: `["monitoring"]` lets the platform's Alertmanager post to an internal app. Siblings are unaffected. The caller's namespace must allow the egress on its side. |
| `volumes` | Up to 4. `type` `pvc` (persistent, 100Mi or more) or `emptydir` (scratch, up to 32Gi). A pod that mounts a `pvc` runs with `fsGroup` 1000 (change policy `OnRootMismatch`): the mount is group-writable for group 1000 and the container's processes get that group as a supplementary group, so an image that runs as any non-root user can write to it. |
| `files` | Plain configuration files: `[{"path": "/etc/app/config.yaml", "content": "..."}]`. Up to 16, 64 KiB each, 256 KiB in total. Mounted read-only at the path; versioned with the spec. Secret files go through the secrets endpoint instead. |
| `resources` | Defaults 100m / 128Mi requests, 500m / 512Mi limits. Limits may not exceed twice the owner's quota request. |
| `metrics` | Opt-in: `{"port": 9090, "path": "/metrics"}` where the service serves Prometheus text-format metrics (`path` defaults to `/metrics`; the port may equal `port`). The platform scraper then reads it every 20 seconds and the series appear in the telemetry routes with `namespace` and `pod` labels. Only the scraper's namespace is admitted to that port. Without it a service still gets CPU, memory, network and restart series from the node. |

`command` and `args` configure an unmodified image from the spec, for example a
`cache` service that runs `redis-server` with its own options:

```json
"cache": {
  "image": "ghcr.io/example/redis:7.4-alpine",
  "args": ["redis-server", "--requirepass", "$(CACHE_PASSWORD)", "--appendonly", "yes"],
  "secret_keys": ["CACHE_PASSWORD"],
  "port": 6379, "expose": "internal"
}
```

Kubernetes expands `$(NAME)` in both against the container's environment: `env`,
`pod_env`, `addon_env` and `secret_keys`. A reference to an unknown name stays as
written, and `$$(NAME)` is a literal `$(NAME)`. No shell runs unless the command is one,
so `$NAME` and `${NAME}` are not expanded. `command` and `args` are stored in the spec and
shown by every read of it, so never put a literal secret in them: set it as a secret key
and reference it as `$(NAME)`. They change nothing else: the security profile is the same
(an image that must start as root is still refused), the probes, `pre_stop` and `files`
work as before, and `pre_stop.exec` runs its own command in the container whatever the
container was started with. A change of either rolls the service like any other change of
its pod.

`pre_stop.exec` is any command of the service's own image: 1 to 16 arguments, at most
4096 bytes in total. It runs inside the service container as the container's user, so
it can do nothing the image's entrypoint could not. No command and no drain time is
built in. Kubernetes waits for it to finish before sending SIGTERM, and kills the pod
when `termination_grace_seconds` runs out, so size the grace for the command's longest
run. To keep a failing drain's exit status while still waiting for routes to withdraw,
use a shell form such as
`["/bin/sh", "-c", "/app/drain; status=$?; /bin/sleep 30; exit $status"]`.
HTTP hooks are refused.
Native `sleep_seconds` requires Kubernetes support for the Pod lifecycle sleep action
(stable in Kubernetes 1.33); chrono-cd never silently substitutes an exec process.
Keep secret values out of hook arguments and specs.

#### Jobs

Internal scope only. `jobs`, next to `services`, declares scheduled runs of a service's
container: the same image digest, `env`, `pod_env`, `secret_keys`, `addon_env`, `files`,
secret files, `service_account`, security profile and `resources` as the service named,
with other arguments. The platform renders one `batch/v1` CronJob per job.

```json
"jobs": {
  "cleanup": {"service": "worker", "schedule": "*/5 * * * *", "args": ["cleanup"],
            "concurrency": "forbid", "active_deadline_seconds": 240}
}
```

| Field | Rule |
|---|---|
| name (the key) | Lowercase letters, digits and inner hyphens. The CronJob is named `<service>-<job>`, at most 52 characters, and that name must not be the name of a service or of another job's CronJob in the namespace (`409 service_name_taken` across apps). At most 8 jobs per app. |
| `service` | Required. A service of this app. One with a `pvc` volume is refused: only the service's own pod can mount the claim. One with `egress: none` is refused: a run could reach nothing. |
| `schedule` | Required. Five cron fields in UTC: minute, hour, day of month, month, day of week (0-6, Sunday is 0). Each is `*`, a number, a range `a-b`, a step `*/n` or `a-b/n`, or a comma list of those. Names (`MON`) and macros (`@hourly`) are refused. Two runs must be at least 5 minutes apart: `*/5 * * * *` is the tightest schedule, and `*/7 * * * *` is refused because minute 56 and minute 0 are 4 minutes apart. |
| `args` | Required. 1 to 32 arguments that replace the container's arguments, the service's `args` included; the entrypoint stays, which is the service's `command` when it sets one, else the image's. At most 1024 bytes each and 4096 in total. They are stored in the spec, so keep secret values out of them; `$(NAME)` expands as in the service's `args`. |
| `concurrency` | `forbid` (default): a run that is due while the last one is still going is skipped. `replace`: the going run is stopped and the new one starts. Running both is not offered. |
| `active_deadline_seconds` | 10 to 86400; default 600. A run that takes longer is stopped and counts as failed. |

A run is one pod that is never restarted and never retried; the next scheduled run is
the retry. It has no port, no probes and no `pre_stop`, receives no traffic from the
service's Service or route, and is not counted in the service's `replicas`, autoscaling
range or disruption budget. Nothing can call a run: the service's `ingress_from`,
`ingress_from_namespaces` and `metrics` admit traffic to its replicas only, and the
namespace's allow between pods leaves runs out. When a run calls out it is the service:
it has the service's egress to the internet and the opened ranges, the metadata access
of its `service_account`, and a sibling that lists the service in `ingress_from` admits
its runs too. One run of each job counts against the owner's quota like one more
replica of its service. A job whose service is waiting for secret keys is not created
until they are set. Dropping the job, its service or the app deletes the CronJob with
its runs. A `PATCH` with `"jobs": {"cleanup": null}` drops one job.

Every service is reachable inside the owner's namespace as `http://<service>:<port>` and
`http://<service>:80`, so an app's own proxy configuration works unchanged.

Images run as plain containers under the strict profile: non-root, no capabilities, no
privilege escalation. An image that must start as root fails with
`CreateContainerConfigError` in `status`; rebuild it to run as a non-root user. The user
must be numeric (`USER 65532:65532`): a name such as distroless's `nonroot` fails the same
way, with "image has non-numeric user" in the message.

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
- **The platform's own credential**, internal scope only. An internal app whose request
  brings no `registry_credential` pulls a private image with the platform's machine user
  (`CHRONO_CD_INTERNAL_REGISTRY_USERNAME`); the app view shows
  `"registry_credential_source": "platform"` and that user as `registry_username`. A
  rotated token reaches the pull Secret on the next deploy or admin reconcile. Tenants
  never get it.

Either way the token is write-only: it is stored as a pull Secret in the owner's
namespace and never returned, logged or audited. `{"remove": true}` deletes it. Any of
these credentials is sent to `ghcr.io` only, and the pull Secret is for `ghcr.io` only.

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
  "backend_timeouts": {"web": {"seconds": 3600, "in_effect": true}},
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

`backend_timeouts` is present only when a platform admin set a load balancer request timeout for a service of an internal app. It is read-only: no owner write sets, changes or clears it. `in_effect` is `false` while that service is gone from the spec or has no public route; the value is kept and applies again once the route is back.

`generation` increases on every accepted spec change, and on an admin's change of `backend_timeouts`, and is the optimistic lock.
`revision` increases on every successful apply.

#### Load balancer timeout

A public service gets the platform's load balancer request timeout, 300 seconds unless the platform sets another. On the platform's external Application Load Balancer it bounds the whole response, a long-lived stream such as Server-Sent Events included, not just the wait for the first byte. The owner cannot change it. For an internal app, a platform admin can raise it for one service, up to 3600 seconds, on request; the app view then shows it under `backend_timeouts`. A long stream still ends when its pod does (a deploy, restart or node drain, after `termination_grace_seconds` at the latest), and a proxy in front of the hostname or the caller's own client timeout can end it sooner.

### `PATCH /projects/{project}/apps/{app}`

Changes part of an existing app and applies it, answering like a `PUT` of the result
(200 with the app view). The body is a JSON merge patch (RFC 7386) over the stored spec:
name only what changes. A member set to `null` is removed, an object merges into the
object of the same name, an array or scalar replaces. The merged spec is validated like
any `PUT`. A missing app answers `404`. `domain` cannot be patched. `registry_credential`
and `target_org_id` are taken as on a `PUT`, not merged into the spec.

```json
{"services": {"web": {"image": "ghcr.io/the-omega-institute/wishpool-web:0.2.1"}}}
```

bumps one image and leaves every other field of every service untouched. This is the
right call for a new tag; `PUT` is for declaring the whole app, and two callers doing a
`PUT` from different bodies overwrite each other's fields.

Both `PUT` and `PATCH` take `If-Match: <generation>` and answer `409 stale_generation`
when the stored generation differs. A `PATCH` without the header is pinned to the
generation it read, so a change that lands in between is never overwritten. For a `PUT`,
read the app first and send its `generation` as `If-Match` when someone else may be
deploying the same app.

### `GET /projects/{project}/apps` and `GET /projects/{project}/apps/{app}`

`{"apps": [<app view>]}` for the apps of the project, or one app view. An app that lives
in another project is `404` under this one.

### `DELETE /projects/{project}/apps/{app}?purge=true`

Removes every object of the app, the add-on user, and the record. `purge=true` also
drops the add-on data: the app's own database is dropped as the app's own scoped user
before that user is deleted, so no other database can be touched. Answers
`{"project": "<project>", "deleted": "<app>", "purged": <bool>}` only once everything it
names is gone. When the data cannot be dropped, the answer is `502 addon_unavailable`
and nothing is removed: the app, its user and its data stay for a retry. One such case
is an add-on Secret that is missing from the namespace; the message says so. Delete
without `purge` then, and have a platform admin drop the database.

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
  "route": {"found": true, "accepted": true, "resolved_refs": true, "serving": true, "serving_status": 200},
  "addons": {"mongodb": {"database": "...", "user": "...", "provisioned_at": "..."}},
  "last_reconcile": {"at": "...", "ok": true, "revision": 2}
}
```

A service that declares `autoscaling` also carries `autoscaler`, the live state of its
HorizontalPodAutoscaler:

```json
"autoscaler": {"found": true, "min_replicas": 2, "max_replicas": 5, "current_replicas": 3, "desired_replicas": 4,
               "cpu_utilization": 80,
               "conditions": [{"type": "ScalingActive", "status": "True", "reason": "ValidMetricFound"}]}
```

`current_replicas` is what the autoscaler last saw and `desired_replicas` what it last
asked for; `replicas`, `ready`, `updated` and `available` next to it stay the pod counts.
`cpu_utilization` is the measured average in percent of the CPU request, absent until
the cluster's metrics API has answered for the pods. `conditions` are the autoscaler's
own: `ScalingActive` `False` means it cannot read CPU and is not scaling.
`found: false` means the cluster has no autoscaler for the service, which the next
deploy or admin reconcile restores. The service is `ready` when its pods match the count
the autoscaler set, not `min_replicas`. A service without `autoscaling` has no
`autoscaler` member.

An app that declares `jobs` also carries `jobs`, the live state of each job's CronJob:

```json
"jobs": {
  "cleanup": {"found": true, "active": 0,
            "last_schedule_time": "2026-11-18T10:05:00Z", "last_successful_time": "2026-11-18T10:05:40Z",
            "last_run": {"outcome": "succeeded", "started_at": "2026-11-18T10:05:00Z", "finished_at": "2026-11-18T10:05:40Z"}}
}
```

`last_run` is the most recent run the cluster still holds (it keeps the last successful
and the last failed one), absent before the first. `outcome` is `running`, `succeeded`
or `failed`; a failed run carries the cluster's `reason` (`DeadlineExceeded`,
`BackoffLimitExceeded`) and `message`, and `finished_at` is absent while it runs.
`active` is the number of runs going now. `last_schedule_time` and
`last_successful_time` are the cluster's own record and outlive the runs.
`found: false` means the cluster has no CronJob for the job: its service is waiting for
secret keys, or the next deploy or admin reconcile restores it. Jobs do not change the
app's `phase`, and an app without `jobs` has no `jobs` member.

`phase` is `ready`, `progressing`, `degraded` (a pod is in `ImagePullBackOff`,
`CrashLoopBackOff`, `OOMKilled` or `CreateContainerConfigError`, or the rollout timed out),
`error` (the last apply failed) or `deleting`. Pod `reason` and `message` carry the
container's own words.

`ready` means reachable. An app with a public service is `progressing` until the cluster
has accepted its route and resolved its references, however ready its pods are. Once the cluster accepts the route, chrono-cd fetches the app's
hostname from the public edge on every status call: `route.serving` is `true` when the
answer came from the app (any status, its own 404 included) and `false` while the edge
still answers for no route, which lasts a few minutes after a new hostname's route is
accepted. While it is `false` the phase stays `progressing`. `serving_status` is the
HTTP status the probe saw. The probe asks `/` when a public service routes it, otherwise
the alphabetically first routed prefix (`/api/v1/monitoring` for an app that routes only
`/status` and `/api/v1/monitoring`), because the gateway answers a path no route claims
with its own 404. Both are absent when nothing is public yet.

### `GET /projects/{project}/apps/{app}/logs?service=<name>&tail=100&pod=<pod>`

`{"service": "web", "pods": [{"pod": "web-...", "logs": "..."}]}`. `tail` is at most 1000.

### `GET /projects/{project}/apps/{app}/revisions?limit=50`

`{"revisions": [{"revision": 2, "generation": 3, "action": "update", "actor": "...", "at": "...", "ok": true,
"services": {"web": {"image": "...", "image_digest": "sha256:...", "replicas": 2}}}]}`, newest first.

## Telemetry

Stored metrics and logs of an app, from the platform's VictoriaMetrics and VictoriaLogs
stores (30 days of metrics, 90 days of logs). The live `logs` route above only tails
running pods; these routes answer for pods that have gone and for any window up to 31
days. Any member of the scope may read. Every query is pinned on the server to the
owner's namespace and to the app's pods (or one service's pods with `service=`), so
query text cannot reach another tenant. The pods of an app's job runs are included, with
their service's when `service=` is set; the live `logs` route lists only replicas. A deployment without a store answers
`501 telemetry_disabled`.

CPU, memory, network and restart series exist for every pod. A service's own metrics
exist once it declares `metrics` in its spec (see the service fields); `schema` lists
the names the store has seen.

Time is RFC 3339. `end` defaults to now and `start` to one hour before `end`.

### `GET /projects/{project}/apps/{app}/telemetry/schema`

What can be queried for the app, from the last hour of data.

```json
{
  "namespace": "cd-7d1c1e3f5b", "pod_regex": "^(api|web)-[a-z0-9]+-[a-z0-9]+$", "services": ["api", "web"],
  "start": "...", "end": "...",
  "metrics": {"names": ["container_cpu_usage_seconds_total", "..."], "labels": ["container", "pod", "..."],
              "presets": [{"name": "cpu", "query": "...", "description": "..."}]},
  "logs": {"fields": ["_msg", "_time", "kubernetes.container_name", "kubernetes.pod_name", "..."],
           "presets": [{"name": "errors", "query": "...", "description": "..."}]},
  "limits": {"max_window": "744h0m0s", "default_window": "1h0m0s", "max_points": 500, "min_step": "15s",
             "default_lines": 1000, "max_lines": 10000}
}
```

### `GET /projects/{project}/apps/{app}/telemetry/metrics?preset=cpu|query=<PromQL>&service=&start=&end=&step=`

One of `preset` or `query`. Presets: `cpu`, `memory`, `restarts`, `network_rx`,
`network_tx`, each grouped by pod. `step` is a duration such as `30s` or `5m`; when
absent it is chosen so the window has at most 500 points, and it is never below 15s.

```json
{"query": "sum by (pod) (...)", "service": "", "start": "...", "end": "...", "step": "15s",
 "result_type": "matrix", "partial": false,
 "series": [{"metric": {"pod": "web-7d9f-abcde"}, "values": [[1792564546, "0.00034"], ["...", "..."]]}]}
```

`series` is the Prometheus range-query result as the store returned it: a timestamp in
seconds and a value as a string per point. `partial` is true when the store answered
from part of its storage.

### `GET /projects/{project}/apps/{app}/telemetry/logs?preset=errors|query=<LogsQL>&service=&start=&end=&limit=1000`

One of `preset` or `query`. Presets: `all`, `errors`, `warnings`. `query` is a LogsQL
filter, for example `"connection refused"` or `i(timeout) AND kubernetes.container_name:api`;
pipes such as `| stats` are allowed. `limit` is at most 10000.

```json
{"query": "i(error) OR ...", "service": "", "start": "...", "end": "...", "limit": 1000, "count": 2, "truncated": false,
 "lines": [{"_time": "2026-10-21T06:45:44.115Z", "_msg": "...", "kubernetes.pod_name": "web-7d9f-abcde",
            "kubernetes.container_name": "app", "...": "..."}]}
```

Lines are newest first, each a flat object of the store's fields. `truncated` is true
when more lines matched than `limit`; narrow the window or the query.

A query the store cannot parse answers `400 query_rejected` with the store's own
message. A window longer than 31 days, a step that would exceed 500 points, or a
missing query answers `400 validation_error`.

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
