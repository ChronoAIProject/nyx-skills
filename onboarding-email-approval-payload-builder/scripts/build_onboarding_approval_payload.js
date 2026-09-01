#!/usr/bin/env node
'use strict';

// Deterministic payload builder for onboarding-email-approval-payload-builder.
// Ports the n8n "提取并格式化新人信息" code node + the "发起 Lark 邮箱审批"
// (/open-apis/approval/v4/instances) body construction. No network calls and no
// token retrieval (NyxID slug api-lark-bot brokers credentials); the request date
// must be supplied so the build stays deterministic (no wall-clock reads).

const fs = require('fs');

const DEFAULTS = {
  // From the n8n "发起 Lark 邮箱审批" HTTP node (approval_code).
  approvalCode: '9C330885-C70A-4A5D-913A-CBA9A142FFD4',
  // Company email domain from "提取并格式化新人信息" (COMPANY_DOMAIN).
  companyDomain: 'aelf.io',
  // Form widget ids from the same node's formPayload.
  widgetIds: {
    request_detail: 'widget17163600360780001',
    submitter: 'widget17163600454870001'
  },
  // The n8n node hard-coded the second widget's value to "自动提交".
  submitterValue: '自动提交'
};

function readInput() {
  const text = fs.readFileSync(0, 'utf8');
  return text.trim() ? JSON.parse(text) : {};
}

// The n8n node read fields from `body` (or the root if no body wrapper).
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

// Ports the n8n emailName derivation: lowercase, spaces -> dots, strip non [a-z0-9.].
function localPartFromName(larkName) {
  return String(larkName)
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
}

// Ports the n8n zh-CN toLocaleDateString({year,month,day}) -> e.g. 2026年6月9日.
// Deterministic: requires an explicit `today` (YYYY-MM-DD or any Date-parseable
// string the caller supplies). Reading the wall clock is intentionally avoided so
// the builder stays pure and replayable.
function formatChineseDate(today) {
  const raw = String(today).trim();
  const ymd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    return `${Number(ymd[1])}年${Number(ymd[2])}月${Number(ymd[3])}日`;
  }
  // Parse an explicit (non-empty) date string the caller passed in.
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}年${parsed.getMonth() + 1}月${parsed.getDate()}日`;
  }
  return raw;
}

function buildApprovalInstance(input) {
  const record = source(input || {});

  // New-hire fields with the source aliases (Lark Base column names + snake_case).
  const fields = {
    larkName: firstValue(record, ['lark_name', 'larkName', 'Lark Name', 'name', 'Name']),
    department: firstValue(record, ['department', 'Department', 'dept']),
    startDate: firstValue(record, ['onboarding_date', 'onboardingDate', 'Onboarding Date', 'start_date', 'startDate']),
    operatorId: firstValue(record, ['user_id', 'userId', 'operator_id', 'operatorId', 'open_id', 'openId'])
  };

  const missing = [];
  if (!fields.larkName) missing.push('lark_name');
  if (!fields.operatorId) missing.push('user_id');
  if (missing.length) return { needs_more_information: true, missing };

  const larkName = String(fields.larkName).trim();
  const department = fields.department === undefined ? '' : String(fields.department).trim();
  const startDate = fields.startDate === undefined ? '' : String(fields.startDate).trim();
  const operatorId = String(fields.operatorId).trim();

  const companyDomain = String(firstValue(record, ['company_domain', 'companyDomain']) || DEFAULTS.companyDomain).trim();
  const approvalCode = String(firstValue(record, ['approval_code', 'approvalCode']) || DEFAULTS.approvalCode).trim();
  const widgetIds = {
    request_detail: String(firstValue(record, ['requestDetailWidgetId', 'request_detail_widget_id']) || DEFAULTS.widgetIds.request_detail).trim(),
    submitter: String(firstValue(record, ['submitterWidgetId', 'submitter_widget_id']) || DEFAULTS.widgetIds.submitter).trim()
  };
  const submitterValue = String(firstValue(record, ['submitter_value', 'submitterValue']) || DEFAULTS.submitterValue);

  // Allow caller-supplied email; else derive like the n8n node.
  const explicitEmail = firstValue(record, ['email', 'Email', 'new_email', 'newEmail']);
  const newEmail = explicitEmail
    ? String(explicitEmail).trim()
    : `${localPartFromName(larkName)}@${companyDomain}`;

  // `today` is the request date; default to the start date so the builder stays
  // deterministic when the caller does not pass an explicit today.
  const todayInput = firstValue(record, ['today', 'request_date', 'requestDate']) || startDate || '';
  const today = todayInput ? formatChineseDate(todayInput) : '';

  // Exact requestDetail string shape from "提取并格式化新人信息".
  const requestDetail = `申请日期：${today} | 姓名：${larkName}（入职：${startDate}）| 新邮箱：${newEmail}`;

  const form = [
    { id: widgetIds.request_detail, type: 'textarea', value: requestDetail },
    { id: widgetIds.submitter, type: 'input', value: submitterValue }
  ];

  return {
    message_type: 'lark_onboarding_email_approval',
    summary: `Onboarding email approval for ${larkName} (${newEmail})`,
    request: {
      larkName,
      department,
      startDate,
      newEmail,
      requestDetail,
      operatorId
    },
    form,
    approval: {
      path: '/open-apis/approval/v4/instances',
      body: {
        approval_code: approvalCode,
        user_id: operatorId,
        form: JSON.stringify(form)
      }
    }
  };
}

function buildPayload(input) {
  const data = input || {};
  const mode = data.mode || 'build_approval_instance';
  if (mode === 'build_approval_instance') return buildApprovalInstance(data);
  return { skip: true, reason: `unknown mode: ${mode}` };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildPayload(readInput()), null, 2)}\n`);
}

module.exports = { buildPayload };
