---
name: chrono-cd
description: Deploy a user's application to the ChronoAI cluster with chrono-cd through the NyxID CLI (`nyxid proxy request chrono-cd ...`). Covers the whole flow an agent runs for the user - check the account and quota, pick a personal or organization scope, write the app spec (one or more ghcr.io images with ports, routes, env, config files, volumes and an optional MongoDB add-on), create or update the app, set its secrets, watch status and logs, restart, roll back by re-deploying a tag, delete, and ask for more quota. Use whenever the user wants to deploy, update, inspect or remove an app on apps.chrono-ai.fun, or asks what chrono-cd needs from them. Every request body and response shape is given, so the agent never guesses.
compatibility: Requires the nyxid CLI, logged in with `nyxid login`, and access to the NyxID service `chrono-cd`. Private GitHub packages need `nyxid connect github --scope read:packages`. Verified 2026-10-20 against chrono-cd 1f3bf23.
version: "1.0"
license: Apache-2.0
metadata:
  category: tool-based
  tool-list:
    - Bash
  tag:
    - chrono-cd
    - nyxid
    - deploy
    - kubernetes
    - ghcr
    - apps
---

# Deploy an app with chrono-cd

chrono-cd runs container images from GitHub Packages (`ghcr.io`) on the ChronoAI cluster
and gives each app a public hostname `https://APP-SLUG.apps.chrono-ai.fun`. It is
registered in NyxID as the service `chrono-cd`. Every call goes through NyxID's proxy:

```bash
nyxid proxy request chrono-cd api/v1/PATH [--method PUT|POST|DELETE] [--data 'JSON'] --output json
```

NyxID checks the user's login and tells chrono-cd who is calling. There is no other
credential to manage. Responses are plain JSON objects, errors are
`{"error": "KEY", "error_code": N, "message": "..."}`.

"You" below means the agent. "The user" is the person you act for.

## The model, in four words

| Level | What it is | Example |
|---|---|---|
| owner | the user, or one of their organizations; one namespace and one quota | `acme` |
| project | a plain group of apps; exists while it has an app | `chronoai` |
| app | one deployable application: one hostname, services, add-ons | `chrono-pod` |
| service | one container inside the app | `api`, `worker` |

App names and service names are unique per owner, across projects. Services of the same
owner reach each other by name, `http://SERVICE:PORT`, in any project.

## Rules that matter

- **Never ask the user for a NyxID token.** `nyxid login` is the only credential step.
- **Images must be on `ghcr.io`** and run as a non-root user. An image that must start as
  root fails with `CreateContainerConfigError` in status; tell the user to rebuild it.
- **Private packages:** do not ask the user for a GitHub token. Ask them to run
  `nyxid connect github --scope read:packages` once; chrono-cd then pulls with that
  connection. Only when they have no GitHub connection (a CI job on an organization key)
  send `registry_credential` with a classic token that has `read:packages`.
- **Secrets never go in the spec, in chat or in logs.** Declare the names in
  `secret_keys`, then set the values with the secrets endpoint. Responses only ever show
  names.
- **`PUT` is declarative.** The body replaces the whole spec. To change one thing, send
  the whole spec again with that thing changed. Read the app first when you did not write
  the current spec yourself.
- **A `port` is immutable** and so is a service name. To change a port, add the service
  under a new name and remove the old one.
- **Replicas are at most 3; a service with a `pvc` volume runs 1.**
- **Quota is per owner**: default 2 CPU, 4Gi, 10 pods, 20Gi, summed over all apps as
  replicas times requests plus one surge pod. `409 quota_exceeded` says by how much. The
  user can only request more; a platform admin approves.
- **Organization scope:** the user must be an `admin` of the organization to deploy;
  `member` and `viewer` can only read. Pass `org_id` on every call for that scope.

## Step 0: check the account

```bash
nyxid proxy request chrono-cd api/v1/account --output json
```

Returns `slug` (the hostname suffix), `quota`, `usage`, `apps` and `organizations` with the
user's role in each. If the user wants to deploy for an organization, pick its `id` and add
`?org_id=ID` to every path below. If they are not `admin` there, stop and say so.

## Step 1: write the spec

Ask the user only for what has no default: the image, the port, and whether the service
is public. Everything else defaults. The smallest public app:

```json
{"services": {"web": {"image": "ghcr.io/OWNER/PACKAGE:TAG", "port": 8080, "routes": ["/"]}}}
```

Per service:

| Field | Required | Default or rule |
|---|---|---|
| `image` | yes | `ghcr.io/owner/package:tag` or `@sha256:...`; resolved to a digest at every apply |
| `port` | unless `expose: none` | 1-65535, immutable |
| `routes` | for a public service | path prefixes on the app hostname, e.g. `["/"]` or `["/api", "/auth"]`; longest prefix wins; unique across the app |
| `expose` | no | `public` when routes are given, `internal` otherwise, `none` for a worker with no port |
| `health_path` | no | `/`; probes and the load balancer use it |
| `replicas` | no | 1, max 3 |
| `resources` | no | `{"cpu_request": "100m", "memory_request": "128Mi", "cpu_limit": "500m", "memory_limit": "512Mi"}` |
| `env` | no | plain variables, `{"KEY": "value"}`, 60 keys of 4 KiB |
| `secret_keys` | no | names of secret variables, set later; the service waits until all exist |
| `addon_env` | no | `{"mongodb": {"uri": "MONGODB_URI", "database": "MONGODB_DATABASE"}}` |
| `files` | no | plain config files `[{"path": "/etc/app/config.yaml", "content": "..."}]`, 16 of 64 KiB |
| `volumes` | no | up to 4: `{"name": "data", "mount_path": "/data", "type": "pvc", "size": "5Gi"}` or `"type": "emptydir"` |
| `egress`, `ingress_from` | no | `"none"` blocks all egress; `["api"]` lets only those sibling services in |

Per app, outside `services`: `addons` (`{"mongodb": {}}` gives the app one database and a
scoped user; wire it with `addon_env`), `registry_credential` (see the rules), and
`target_org_id` (same as `org_id`).

A multi-service app, with a frontend, an API behind `/api`, and a worker:

```json
{
  "addons": {"mongodb": {}},
  "services": {
    "web":    {"image": "ghcr.io/acme/shop-web:1.4", "port": 8080, "routes": ["/"]},
    "api":    {"image": "ghcr.io/acme/shop-api:1.4", "port": 8080, "routes": ["/api"],
               "health_path": "/readyz",
               "env": {"LOG_LEVEL": "info"},
               "secret_keys": ["JWT_KEY"],
               "addon_env": {"mongodb": {"uri": "MONGODB_URI", "database": "MONGODB_DATABASE"}}},
    "worker": {"image": "ghcr.io/acme/shop-api:1.4", "port": 8080, "expose": "none",
               "env": {"ROLE": "worker"},
               "addon_env": {"mongodb": {"uri": "MONGODB_URI"}},
               "volumes": [{"name": "cache", "mount_path": "/var/cache", "type": "pvc", "size": "5Gi"}]}
  }
}
```

Write the spec to a file and send it with `--data "$(cat spec.json)"`.

## Step 2: create or update the app

```bash
nyxid proxy request chrono-cd api/v1/projects/PROJECT/apps/APP --method PUT \
  --data "$(cat spec.json)" --output json
```

`PROJECT` and `APP` are 1-40 lowercase letters, digits and inner hyphens; the user picks
them. `201` on create, `200` on update. The response is the app view: `hostname`, `url`,
the normalized `spec` with `image_digest` per service, `generation`, `revision`, `status`.

Expected non-200 answers and what to do:

| Answer | Do |
|---|---|
| `422 missing_secret_keys` | Normal when the spec declares secrets. The app is stored and everything else is deployed. Go to step 3. |
| `400 image_unauthorized` | Private package. Relay the message: it says to run `nyxid connect github --scope read:packages` and deploy again. |
| `400 image_not_found` | Wrong owner, package or tag. Check with the user. |
| `409 quota_exceeded` | Lower replicas or requests, or go to "Ask for more quota". |
| `409 service_name_taken` | Another app of this owner uses that service name. Rename the service. |
| `409 app_exists` | The app lives in another project. Use that project path. |
| `502 reconcile_failed` | Stored but not applied. Read `GET .../status`, fix the cause, send the same `PUT` again. |

## Step 3: set the secrets

Ask the user for each value named in `secret_keys`, in a way that keeps it out of the
transcript when possible (a file, an environment variable). Then, per service:

```bash
nyxid proxy request chrono-cd api/v1/projects/PROJECT/apps/APP/services/SERVICE/secrets \
  --method PUT --data '{"JWT_KEY": "..."}' --output json
```

Returns `{"service": "api", "keys": ["JWT_KEY"]}`. Setting secrets applies the app again
and starts the waiting service. Secret files work the same way at
`.../services/SERVICE/secret-files` with `{"files": [{"path": "/etc/app/key.pem", "content": "..."}]}`.
Delete one key with `DELETE .../secrets/KEY`.

## Step 4: wait for it

```bash
nyxid proxy request chrono-cd api/v1/projects/PROJECT/apps/APP/status --output json
```

`phase` is `ready`, `progressing`, `degraded`, `error` or `deleting`. Poll every 15
seconds for up to 5 minutes. `services.NAME.pods[].reason` carries the container's own
words when something is wrong: `ImagePullBackOff` (image or credential),
`CrashLoopBackOff` (read the logs), `OOMKilled` (raise `memory_limit`),
`CreateContainerConfigError` (image runs as root). When `phase` is `ready`, give the user
the `url` from the app view.

Logs:

```bash
nyxid proxy request chrono-cd api/v1/projects/PROJECT/apps/APP/logs?service=SERVICE\&tail=200 --output json
```

## Everyday operations

| Want | Call |
|---|---|
| list projects | `GET api/v1/projects` |
| list apps of a project | `GET api/v1/projects/PROJECT/apps` |
| read an app | `GET api/v1/projects/PROJECT/apps/APP` |
| new image tag | `PUT` the spec with the new tag; pods roll without downtime |
| roll back | `PUT` the spec with the previous tag (`GET .../revisions` lists them) |
| restart | `POST .../restart?service=NAME` (all services when omitted) |
| rotate the database password | `POST .../addons/mongodb/rotate` |
| delete | `DELETE api/v1/projects/PROJECT/apps/APP`; add `?purge=true` to drop the add-on data too |

## Ask for more quota

```bash
nyxid proxy request chrono-cd api/v1/quota-requests --method POST \
  --data '{"cpu_request": "4", "memory_request": "8Gi", "pods": 20, "storage": "40Gi", "reason": "..."}' --output json
```

One pending request per owner. A platform admin approves or rejects; `GET api/v1/quota-requests`
shows the state. Tell the user it is not instant.

## References

`references/api.md` is the full contract, every field and response. `references/errors.md`
lists every error key. Both are bundled with this skill; read them when something here is
not enough. If the API and this manual disagree, the API is right.
