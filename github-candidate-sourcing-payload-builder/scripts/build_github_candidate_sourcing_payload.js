#!/usr/bin/env node
'use strict';

const fs = require('fs');

const DEFAULT_ROLE = 'AI Tools Application Engineer';
const MIN_SCORE = 5;
const LARK_PATH = '/open-apis/bitable/v1/apps/FSl0bCi9raBuLbsdTbHlgb0agwf/tables/tblCetUn20zWlA9D/records';

function readInput() {
  const text = fs.readFileSync(0, 'utf8');
  return text.trim() ? JSON.parse(text) : {};
}

function source(input) {
  return input && input.body && typeof input.body === 'object' ? input.body : input;
}

function firstValue(record, names) {
  for (const name of names) {
    const value = record ? record[name] : undefined;
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

function firstObject(record, names) {
  for (const name of names) {
    const value = record ? record[name] : undefined;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  }
  return undefined;
}

function stringify(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeGithubUrl(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return stringify(value.link || value.text || value.url);
  }
  return stringify(value);
}

function parseModelContent(text) {
  let parsed = { score: 0, reason: 'parse error', signals: [] };
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const blockMatch = String(text).match(/```(?:json)?\s*([\s\S]*?)```/);
    if (blockMatch) {
      try { parsed = JSON.parse(blockMatch[1]); } catch (_) {}
    } else {
      const objectMatch = String(text).match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try { parsed = JSON.parse(objectMatch[0]); } catch (_) {}
      }
    }
  }
  return {
    score: typeof parsed.score === 'number' ? parsed.score : 0,
    reason: parsed.reason || '',
    signals: Array.isArray(parsed.signals) ? parsed.signals.join(', ') : ''
  };
}

function parseLlmOutput(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (typeof value.score === 'number') {
      return {
        score: value.score,
        reason: value.reason || '',
        signals: Array.isArray(value.signals) ? value.signals.join(', ') : ''
      };
    }
    const content = value.choices && value.choices[0] && value.choices[0].message && value.choices[0].message.content;
    return parseModelContent(content || '');
  }
  return parseModelContent(String(value));
}

function numberValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function normalizeSignals(value) {
  if (Array.isArray(value)) return value.join(', ');
  return stringify(value);
}

function buildPayload(input) {
  const record = source(input || {});
  const candidate = firstObject(record, ['candidate', 'profile', 'githubCandidate', 'github_candidate']) || record;
  const llmOutput = firstValue(record, ['llmOutput', 'llm_output', 'modelOutput', 'model_output', 'claudeResponse', 'claude_response', 'groqResponse', 'groq_response']);
  const parsedLlm = parseLlmOutput(llmOutput);

  const login = stringify(firstValue(candidate, ['login', 'Login', 'githubLogin', 'github_login']));
  const name = stringify(firstValue(candidate, ['name', 'Name', 'candidateName', 'candidate_name']));
  const githubUrl = normalizeGithubUrl(firstValue(candidate, ['github_url', 'githubUrl', 'html_url', 'htmlUrl', 'GitHub', 'github']));
  const role = stringify(firstValue(record, ['role', 'jobRole', 'job_role', 'position'])) || DEFAULT_ROLE;
  const explicitScore = firstValue(record, ['score', 'matchScore', 'match_score']) !== undefined
    ? firstValue(record, ['score', 'matchScore', 'match_score'])
    : firstValue(candidate, ['score', 'matchScore', 'match_score']);
  const score = numberValue(explicitScore) !== undefined
    ? numberValue(explicitScore)
    : (parsedLlm ? parsedLlm.score : undefined);
  const reason = stringify(firstValue(record, ['reason', 'aiReason', 'ai_reason', 'evaluationReason', 'evaluation_reason']))
    || (parsedLlm ? stringify(parsedLlm.reason) : '');
  const signalsValue = firstValue(record, ['signals', 'keySignals', 'key_signals']);
  const signals = signalsValue !== undefined ? normalizeSignals(signalsValue) : (parsedLlm ? stringify(parsedLlm.signals) : '');

  const missing = [];
  if (!githubUrl) missing.push('githubUrl');
  if (!name && !login) missing.push('name_or_login');
  if (score === undefined) missing.push('score_or_llmOutput');
  if (missing.length) return { needs_more_information: true, missing };

  if (score < MIN_SCORE) {
    return {
      skip: true,
      reason: 'score below threshold',
      score,
      min_score: MIN_SCORE
    };
  }

  const displayName = name || login;
  const fields = {
    '姓名': displayName,
    'GitHub': { link: githubUrl, text: githubUrl },
    'Bio': stringify(firstValue(candidate, ['bio', 'Bio'])),
    '所在地': stringify(firstValue(candidate, ['location', 'Location'])),
    '岗位': role,
    '匹配分': score || 0,
    'AI评价': reason,
    '关键信号': signals,
    '状态': '待联系',
    '来源': 'GitHub'
  };
  const body = { fields };

  return {
    message_type: 'lark_bitable_record',
    summary: `GitHub candidate record for ${displayName}`,
    candidate: {
      login,
      name: displayName,
      github_url: githubUrl,
      location: fields['所在地'],
      bio: fields.Bio
    },
    evaluation: {
      score,
      reason,
      signals
    },
    fields,
    lark: {
      path: LARK_PATH,
      body
    }
  };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildPayload(readInput()), null, 2)}\n`);
}

module.exports = { buildPayload };
