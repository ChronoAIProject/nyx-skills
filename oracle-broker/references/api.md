# Oracle broker API through NyxID

All paths below are relative to `api/v1/oracle/` and are called with
`nyxid proxy request oracle api/v1/oracle/PATH`. The full contract is in the oracle
repository, `docs/protocol/consumer-api.md`, `docs/protocol/bridge.md` and
`docs/protocol/jobs.md`.

## Tasks

| Method | Path | Body | Answer |
|---|---|---|---|
| POST | `pools/POOL/tasks` | `prompt` (required); `conversation_id` ("" opens one, `conv_...` continues); `model`; `require_model_match`; `project_url`; `tag`; `client_ref`; `attachment_base64` + `attachment_name`; `pdf_base64` + `pdf_name` | 202 `task_id`, `status`, `queue_position`, `conversation_id`, `deduplicated` |
| GET | `tasks/TASK_ID?wait=SECONDS` | | 200 task (below); waits up to SECONDS (keep 90 or less) |
| POST | `tasks/TASK_ID/cancel` | `{}` | 200 |
| POST | `pools/POOL/attach` | `chatgpt_url`, `tag` | 202 `conversation_id`, `task_id` |
| POST | `pools/POOL/extract` | `url`, `model` | 202 `task_id` |
| POST | `pools/POOL/jobs` | `job_type`, `payload` (any JSON), `conversation_id`, `client_ref`, `tag` | 202 `task_id` (generic jobs for non-ChatGPT workers) |

Task fields: `task_id`, `status` (queued, dispatched, completed, failed, cancelled), `phase`,
`response`, `images`, `files`, `chatgpt_url`, `conversation_id`, `is_followup`,
`assigned_worker`, `attempts`, `retry_count`, `failure_reason`, `failure_detail`,
`observed_model_switcher`, `observed_model_effort`, `queue_position`, `created_at`,
`completed_at`; for jobs also `kind`, `job_type`, `output`.

## Conversations

| Method | Path | Answer |
|---|---|---|
| GET | `sessions?pool=POOL&limit=N` | `sessions[]` |
| GET | `sessions/CONV_ID` | the conversation with its `turns[]` (prompt, response, status) |
| POST | `sessions/CONV_ID/close` | 200; later turns are 409 |

## Pools

| Method | Path | Notes |
|---|---|---|
| GET | `pools` | pools you can see |
| POST | `pools` | `slug`, `name`, `visibility` (private or platform), `default_model_label`, `max_workers`, `max_queue_length`, `per_user_max_inflight`, `task_timeout_secs`, `allow_extract`, `chatgpt_project_url`. 201 with a one-time `worker_token`. |
| GET | `pools/POOL` | settings |
| PATCH | `pools/POOL` | any of the settings, `is_active` |
| GET | `pools/POOL/status` | `queued`, `dispatched`, `active_workers[]`, `diagnosis` |
| POST | `pools/POOL/rotate-token` | new worker token; every worker must get it |

## Workers

| Method | Path | Notes |
|---|---|---|
| GET | `pools/POOL/workers` | label, online, logged_in, chrome_alive, version, current_task_id, last_error |
| GET | `pools/POOL/workers/LABEL` | one worker |
| GET | `pools/POOL/workers/LABEL/commands` | recent commands |
| POST | `pools/POOL/workers/LABEL/commands` | `{"command": "drain"}`; drain, resume, restart, relaunch_browser, relogin |
| DELETE | `pools/POOL/workers/LABEL/commands/COMMAND_ID` | withdraw a command not yet run |
| DELETE | `pools/POOL/workers/LABEL?force=true` | forget a worker |

## OpenAI-compatible endpoint

Base `https://nyx-api.chrono-ai.fun/api/v1/proxy/s/oracle/api/v1/oracle/openai/v1`.

| Method | Path | Notes |
|---|---|---|
| GET | `models` | pools as models, `oracle/POOL` |
| POST | `chat/completions` | single-shot unless `metadata.conversation_id`; `stream: true` recommended |
| POST | `responses` | opens a conversation unless `store: false`; continue with `previous_response_id` |

On a continued conversation only the messages after the last assistant message are sent to
ChatGPT. Attachments (`image_url` data URLs, `file` with `file_data`) only on the first turn.
