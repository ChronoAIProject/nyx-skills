# GitHub candidate sourcing contract

This contract defines deterministic behavior for `github-candidate-sourcing-payload-builder`.

## Original n8n flow

The original workflow:

1. Runs on the schedule trigger `0 1 * * 1-5`.
2. Sets the role to `AI Tools Application Engineer`.
3. Searches GitHub users across Singapore, Shanghai, Beijing, Shenzhen, Hangzhou, Hong Kong, and New York.
4. Deduplicates GitHub logins and filters historical candidates.
5. Fetches each user's GitHub profile and recent repositories.
6. Calls an LLM through NyxID and parses the returned JSON scoring result.
7. Keeps candidates where `score >= 5`.
8. Posts one record to the Lark HR Bitable through the NyxID `lark-hr-bot` proxy.

This skill implements steps 6 parsing, 7 filtering, and 8 payload construction only. GitHub search, GitHub profile fetches, repo fetches, LLM calls, NyxID proxy calls, token handling, and Bitable submission stay in Aevatar.

## Input shape

The caller may pass the event body directly or wrap it in `body`. Candidate fields may be at the root or inside `candidate`, `profile`, `githubCandidate`, or `github_candidate`.

The script uses default mode `build_record`. Any `mode` field is ignored because this workflow has one final Lark payload.

## Field aliases

Use the first non-empty value in the listed order.

| Normalized field | Source fields |
|---|---|
| `login` | `login`, `Login`, `githubLogin`, `github_login` |
| `name` | `name`, `Name`, `candidateName`, `candidate_name` |
| `githubUrl` | `github_url`, `githubUrl`, `html_url`, `htmlUrl`, `GitHub`, `github` |
| `bio` | `bio`, `Bio` |
| `location` | `location`, `Location` |
| `role` | `role`, `jobRole`, `job_role`, `position` |
| `score` | `score`, `matchScore`, `match_score` |
| `reason` | `reason`, `aiReason`, `ai_reason`, `evaluationReason`, `evaluation_reason` |
| `signals` | `signals`, `keySignals`, `key_signals` |
| `llmOutput` | `llmOutput`, `llm_output`, `modelOutput`, `model_output`, `claudeResponse`, `claude_response`, `groqResponse`, `groq_response` |

If `GitHub` or `github` is an object, read `link`, then `text`, then `url`.

## Defaults and constants

```json
{
  "role": "AI Tools Application Engineer",
  "min_score": 5,
  "status": "待联系",
  "source": "GitHub"
}
```

The workflow's `配置` node also contains `min_score: 6`, but the actual `评分过滤` IF node gates writes at `score >= 5`; this contract follows the outbound behavior and uses `5`.

## LLM scoring input

If `score` is provided directly, use it. Otherwise parse `llmOutput`.

Accepted `llmOutput` forms:

```json
{ "score": 8, "reason": "one sentence", "signals": ["MCP", "Python"] }
```

```json
{
  "choices": [
    {
      "message": {
        "content": "{\"score\":8,\"reason\":\"one sentence\",\"signals\":[\"MCP\",\"Python\"]}"
      }
    }
  ]
}
```

The parser mirrors the n8n `解析评分` node:

1. Read `choices[0].message.content` when present.
2. Try to parse the content as JSON.
3. If parsing fails, try a markdown JSON code block.
4. If that fails, try the first JSON object in the text.
5. Set `score` only when the parsed score is a JSON number.
6. Set `reason` to `parsed.reason || ""`.
7. Set `signals` to `parsed.signals.join(", ")` only when `signals` is an array.

If parsing fails, the score becomes `0`; because `0 < 5`, the skill returns a skip result and does not build a Lark write payload.

## Score filter

If `score < 5`, return:

```json
{
  "skip": true,
  "reason": "score below threshold",
  "score": 4,
  "min_score": 5
}
```

## Lark Bitable body

Build the exact record body that the n8n `准备飞书请求` node stringified into `lark_body`:

```json
{
  "fields": {
    "姓名": "<name || login>",
    "GitHub": { "link": "<github_url>", "text": "<github_url>" },
    "Bio": "<bio or empty string>",
    "所在地": "<location or empty string>",
    "岗位": "<role>",
    "匹配分": "<score or 0>",
    "AI评价": "<reason or empty string>",
    "关键信号": "<signals or empty string>",
    "状态": "待联系",
    "来源": "GitHub"
  }
}
```

Connector endpoint:

```text
POST /open-apis/bitable/v1/apps/FSl0bCi9raBuLbsdTbHlgb0agwf/tables/tblCetUn20zWlA9D/records
```

The original n8n HTTP node sent that body through:

```text
https://nyx-api.chrono-ai.fun/api/v1/proxy/s/lark-hr-bot/open-apis/bitable/v1/apps/FSl0bCi9raBuLbsdTbHlgb0agwf/tables/tblCetUn20zWlA9D/records
```

The script returns the OpenAPI path and body only. Aevatar owns NyxID proxy routing and authorization.

## Output shape

For a candidate that passes the score filter, return:

```json
{
  "message_type": "lark_bitable_record",
  "summary": "GitHub candidate record for Alice Wang",
  "candidate": {
    "login": "alice-ai",
    "name": "Alice Wang",
    "github_url": "https://github.com/alice-ai",
    "location": "Singapore",
    "bio": "Builds LLM agent tools"
  },
  "evaluation": {
    "score": 8,
    "reason": "Strong agent and API integration work.",
    "signals": "MCP, Python"
  },
  "fields": {
    "姓名": "Alice Wang",
    "GitHub": { "link": "https://github.com/alice-ai", "text": "https://github.com/alice-ai" },
    "Bio": "Builds LLM agent tools",
    "所在地": "Singapore",
    "岗位": "AI Tools Application Engineer",
    "匹配分": 8,
    "AI评价": "Strong agent and API integration work.",
    "关键信号": "MCP, Python",
    "状态": "待联系",
    "来源": "GitHub"
  },
  "lark": {
    "path": "/open-apis/bitable/v1/apps/FSl0bCi9raBuLbsdTbHlgb0agwf/tables/tblCetUn20zWlA9D/records",
    "body": {
      "fields": {
        "姓名": "Alice Wang",
        "GitHub": { "link": "https://github.com/alice-ai", "text": "https://github.com/alice-ai" },
        "Bio": "Builds LLM agent tools",
        "所在地": "Singapore",
        "岗位": "AI Tools Application Engineer",
        "匹配分": 8,
        "AI评价": "Strong agent and API integration work.",
        "关键信号": "MCP, Python",
        "状态": "待联系",
        "来源": "GitHub"
      }
    }
  }
}
```

## Example input

```json
{
  "candidate": {
    "login": "alice-ai",
    "name": "Alice Wang",
    "github_url": "https://github.com/alice-ai",
    "location": "Singapore",
    "bio": "Builds LLM agent tools"
  },
  "llmOutput": {
    "choices": [
      {
        "message": {
          "content": "{\"score\":8,\"reason\":\"Strong agent and API integration work.\",\"signals\":[\"MCP\",\"Python\"]}"
        }
      }
    ]
  }
}
```

## Missing fields

If any required field is missing or empty, return:

```json
{
  "needs_more_information": true,
  "missing": ["githubUrl", "name_or_login", "score_or_llmOutput"]
}
```
