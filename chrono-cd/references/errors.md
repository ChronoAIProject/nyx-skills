# Errors

Every error has the shape `{"error": "<key>", "error_code": <int>, "message": "<text>"}`.
Generic codes are shared with NyxID: `bad_request` 1000, `unauthorized` 1001, `forbidden`
1002, `not_found` 1003, `conflict` 1004, `internal_error` 1006, `validation_error` 1008.
chrono-cd codes:

| Key | Code | HTTP | Meaning |
|---|---|---|---|
| `app_not_found` | 13000 | 404 | The scope has no app by that name in that project. |
| `app_exists` | 13001 | 409 | A create collided with an existing app, or the app lives in another project. |
| `image_not_found` | 13002 | 400 | The registry has no manifest for the reference. |
| `image_unauthorized` | 13003 | 400 | Private package without a credential, or the credential was refused. |
| `registry_not_allowed` | 13004 | 400 | The image host is not one the platform pulls from (`ghcr.io`). |
| `registry_unavailable` | 13005 | 502 | The registry could not be reached. |
| `quota_exceeded` | 13006 | 409 | The app would exceed the owner's quota; the message says by how much. |
| `stale_generation` | 13007 | 409 | `If-Match` did not equal the stored generation. |
| `platform_unavailable` | 13008 | 503 | The cluster or the database did not answer. |
| `addon_unavailable` | 13009 | 502 | The add-on provider (Atlas) failed. |
| `service_name_taken` | 13010 | 409 | Another app of the owner uses that service name. |
| `missing_secret_keys` | 13011 | 422 | The spec declares secret keys that are not set yet. The app is stored; set the secrets. |
| `reconcile_failed` | 13012 | 502 | The desired state was stored but could not be applied. Inspect `status` and retry. |
| `quota_request_pending` | 13013 | 409 | The owner already has a quota request awaiting a decision. |

