# Troubleshooting

## Verify success criteria

`nyxid oracle status <pool> --output json`:
- the worker's label appears in `active_workers`
- its `script_version` is `cdp-1.3-url-key-image`
- `diagnosis` is not `no_workers`; `queued` is 0 or moving

Smoke: `nyxid oracle ask <pool> "please reply only: <label> url-key ok" --no-wait --output json`,
then `nyxid oracle result <task_id> --output json`:
- `status=completed`, `response` contains `<label> url-key ok`
- `chatgpt_url` is a freshly-created `/c/<id>` from the slot key URL — NOT a
  pre-existing unrelated conversation.

## Answer comes back as a math paper / newmath / BioReality / unrelated content

The worker typed into a stray conversation. Stop it immediately
(`launchctl unload …`) and check:
- fresh tasks really `goto` the slot key URL first (worker is `cdp-1.3-url-key-image`,
  `NYXID_CHATGPT_TAB_KEY_URL` set in the plist).
- `NYXID_CHATGPT_TAB_STORAGE_MARKER` is unique to this worker.
- no old `cdp-1.0` / `cdp-1.2-url-key` / non-isolated worker process is still polling the same pool
  with the same token/label: `pgrep -fl worker`. Remove its launchd agent so it
  can't reload at login.

## Worker log shows `Chrome CDP not reachable` / `connection lost`

Chrome on the configured port isn't up. The worker retries with backoff and
reconnects automatically once Chrome returns.
- check: `curl http://localhost:<port>/json/version`
- force a restart: `launchctl kickstart -k gui/$(id -u)/com.nyxid.oracle.chrome.<port>`
- Chrome agent uses `KeepAlive=true` (since v0.6), so launchd auto-relaunches it
  on any exit — a crash or a clean quit won't strand the worker. To do
  maintenance (log in, swap the profile, etc.) without launchd fighting you,
  `launchctl unload` the Chrome agent first, then `load -w` when done.
- pre-v0.6 workers shipped `KeepAlive=false` (no auto-relaunch). If you have one,
  either re-provision with the current script or hand-edit the Chrome plist to
  `<key>KeepAlive</key><true/>` and reload it.

## `AUTH FAILED (HTTP 401/403)` in the log

Bad/typo'd token, inactive pool, or rotated token. The worker backs off and keeps
retrying. Check `nyxid oracle pool show <pool>`; if rotated, write the new token
to the token file (`umask 077`) and `launchctl kickstart` the worker.

## Task stuck `queued`

Usually no active worker, wrong token, Chrome not logged into ChatGPT, or
`max_workers` already saturated. Check `nyxid oracle status <pool>` and the CDP
endpoint; confirm the ChatGPT tab is logged in.

## Image-generation turn fails or returns no image (`cdp-1.3-url-key-image`+)

The worker extracts ChatGPT-generated images (image-gen turns render the `<img>`
in a `conversation-turn` with no assistant role, so the worker scopes there) and
downloads the bytes through the logged-in browser session, returning them on the
task. `oracle ask … --out <file>` writes the image to disk.

- **Task `completed` but no image / `--out` writes nothing:** the worker uploaded
  `images[]` but the NyxID backend is too old to store the field. Deploy a backend
  new enough to accept `images[]` on `/oracle/worker/result`. The worker log line
  `→ saved (0 chars, 1 image(s))` confirms the worker did its part.
- **Task `failed` fast (~7 min) on an image prompt:** the no-output idle guard
  fired — the turn produced no extractable text or image. Re-prompt; if it keeps
  failing, the model may have answered with text only (check the conversation).
- This guard also means a stuck/empty turn can no longer wedge a slot for hours
  (the pre-0.7 behavior).

## Worker behaving like an old version after an update

You rewrote the skill files but didn't redeploy the running worker. launchd keeps
executing the deployed `~/Library/Application Support/NyxIDOracleWorkers/worker-tab-isolated.mjs`
until it's replaced *and* restarted (and `script_version` won't reveal the skill
version). Fix: re-run `scripts/setup-macos-worker.sh` with the same params, or
`cp` the new `assets/worker-tab-isolated.mjs` over the deployed one and
`launchctl kickstart -k gui/$(id -u)/com.nyxid.oracle.cdp-worker.<label>`.

## A follow-up returns a stale / previous-turn answer

Fixed in worker v0.4+ (`waitForTranscriptStable` samples the baseline only after
the existing transcript finishes rendering). If you still see it, the worker
binary is pre-v0.4 — redeploy (see the section above).

## Two workers fighting

Symptom: tasks flapping, leases stolen. Cause: two workers share a
`NYXID_WORKER_LABEL` on one pool. Give each a unique label + slot. On one pool,
`max_workers` must be ≥ the number of workers you actually want running concurrently.

## launchctl tips

- list: `launchctl list | grep nyxid`
- restart worker: `launchctl kickstart -k gui/$(id -u)/com.nyxid.oracle.cdp-worker.<label>`
- remove a worker: `launchctl unload -w ~/Library/LaunchAgents/com.nyxid.oracle.cdp-worker.<label>.plist`
  then delete the plist (otherwise it reloads at next login).
- logs: `~/Library/Logs/NyxIDOracleWorkers/<label>.out.log`

## PDF attachments

This worker also supports PDF (decodes `task.pdf_base64`, uploads to the composer,
then sends). If PDF upload hangs, ChatGPT's attachment DOM likely changed — the
detection waits up to 120s then sends anyway; update the selectors in `uploadPdf`.
