#!/usr/bin/env node
'use strict';

const fs = require('fs');

const APP_TOKEN = 'FSl0bCi9raBuLbsdTbHlgb0agwf';
const TABLE_ID = 'tblgZgSqmeBag2na';
const SCORE_THRESHOLD = 60;

function readInput() {
  const text = fs.readFileSync(0, 'utf8');
  return text.trim() ? JSON.parse(text) : {};
}

function source(input) {
  return input && input.body && typeof input.body === 'object' ? input.body : input;
}

function valueAt(record, name) {
  if (!record || typeof record !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(record, name)) return record[name];
  if (!name.includes('.')) return undefined;
  return name.split('.').reduce((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return current[part];
  }, record);
}

function firstValue(record, names) {
  for (const name of names) {
    const value = valueAt(record, name);
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

function parseJsonText(text) {
  if (typeof text !== 'string') return undefined;
  let cleanText = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
  if (jsonMatch) cleanText = jsonMatch[0];
  if (!cleanText) return undefined;
  try {
    return JSON.parse(cleanText);
  } catch (_) {
    return undefined;
  }
}

function parseModelOutput(value) {
  if (value === undefined || value === null) return {};
  if (typeof value === 'string') return parseJsonText(value) || {};
  if (typeof value !== 'object') return {};
  const content = value.choices && value.choices[0] && value.choices[0].message && value.choices[0].message.content;
  if (content !== undefined) return parseJsonText(String(content).trim()) || {};
  return value;
}

function modelOutput(record) {
  const candidates = [
    valueAt(record, 'ai'),
    valueAt(record, 'aiOutput'),
    valueAt(record, 'modelOutput'),
    valueAt(record, 'screeningResult'),
    valueAt(record, 'groqResponse'),
    valueAt(record, 'response')
  ];
  for (const candidate of candidates) {
    const parsed = parseModelOutput(candidate);
    if (parsed && Object.keys(parsed).length) return parsed;
  }
  return {};
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeFields(input) {
  const record = source(input || {});
  const ai = modelOutput(record);
  const scoreValue = firstValue(record, ['score', 'ai.score', 'modelOutput.score', 'screeningResult.score']);
  return {
    mode: String(firstValue(record, ['mode']) || 'build_record'),
    score: scoreValue !== undefined ? normalizeNumber(scoreValue) : (ai.score !== undefined ? normalizeNumber(ai.score) : undefined),
    candidateName: firstValue(record, [
      'candidateName',
      'candidate_name',
      'Candidate Name',
      'formName',
      'meta.formName',
      'name'
    ]) || ai.candidate_name || ai.candidateName,
    email: firstValue(record, ['email', 'Email', 'meta.email']) || '',
    jobTitle: firstValue(record, ['jobTitle', 'job_title', 'Job Title', 'meta.jobTitle']),
    strengths: firstValue(record, ['strengths']) || ai.strengths || '',
    gaps: firstValue(record, ['gaps']) || ai.gaps || '',
    recommendation: firstValue(record, ['recommendation']) || ai.recommendation || '',
    screenerRemarks: firstValue(record, ['screenerRemarks', 'screener_remarks', 'TA Notes', 'taNotes']),
    uploadDateMs: firstValue(record, ['uploadDateMs', 'upload_date_ms', 'uploadDate', 'Upload Date']),
    fileToken: firstValue(record, ['file_token', 'fileToken', 'resumeFileToken', 'Resume.file_token']),
    recordId: firstValue(record, ['record_id', 'recordId', 'Record ID'])
  };
}

function missingRequired(fields, wantsUpdate) {
  const required = ['score', 'candidateName', 'jobTitle', 'uploadDateMs'];
  if (wantsUpdate) required.push('recordId');
  return required.filter((key) => fields[key] === undefined || fields[key] === null || String(fields[key]).trim() === '');
}

function bitableFields(fields) {
  const screenerRemarks = fields.screenerRemarks !== undefined
    ? String(fields.screenerRemarks)
    : `AI Score: ${fields.score}/100 | ${fields.recommendation} | Strengths: ${fields.strengths} | Gaps: ${fields.gaps}`;
  const result = {
    'Candidate Name': String(fields.candidateName),
    'Email': fields.email ? String(fields.email) : '',
    'Job Title': String(fields.jobTitle),
    'Upload Date': normalizeNumber(fields.uploadDateMs),
    'Position Status': 'Open',
    'Application Stage': 'Resume Screening',
    'TA Notes': screenerRemarks
  };
  if (fields.fileToken) result.Resume = [{ file_token: String(fields.fileToken) }];
  return { result, screenerRemarks };
}

function buildPayload(input) {
  const fields = normalizeFields(input || {});
  const mode = fields.mode;
  const wantsUpdate = mode === 'update_record' || (mode === 'build_record' && Boolean(fields.recordId));
  if (!['build_record', 'create_record', 'update_record'].includes(mode)) {
    return { skip: true, reason: `unsupported mode: ${mode}` };
  }
  if (fields.score === undefined) return { needs_more_information: true, missing: ['score'] };
  if (fields.score < SCORE_THRESHOLD) {
    return {
      skip: true,
      reason: 'score below upload threshold',
      threshold: SCORE_THRESHOLD,
      score: fields.score,
      recommendation: fields.recommendation
    };
  }

  const missing = missingRequired(fields, wantsUpdate);
  if (missing.length) return { needs_more_information: true, missing };

  const built = bitableFields(fields);
  const basePath = `/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records`;
  const path = wantsUpdate ? `${basePath}/${fields.recordId}` : basePath;
  const method = wantsUpdate ? 'PUT' : 'POST';
  const action = wantsUpdate ? 'update' : 'create';

  return {
    message_type: 'lark_bitable_record_payload',
    summary: `Resume screening ${action} record payload for ${fields.candidateName}`,
    action,
    candidate: {
      candidateName: String(fields.candidateName),
      email: fields.email ? String(fields.email) : '',
      jobTitle: String(fields.jobTitle)
    },
    screening: {
      score: fields.score,
      threshold: SCORE_THRESHOLD,
      recommendation: String(fields.recommendation || ''),
      strengths: String(fields.strengths || ''),
      gaps: String(fields.gaps || ''),
      passed: true
    },
    record: wantsUpdate ? { recordId: String(fields.recordId) } : {},
    screenerRemarks: built.screenerRemarks,
    fields: built.result,
    lark: {
      path,
      method,
      body: {
        fields: built.result
      }
    }
  };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildPayload(readInput()), null, 2)}\n`);
}

module.exports = { buildPayload };
