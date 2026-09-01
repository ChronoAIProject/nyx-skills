#!/usr/bin/env node
'use strict';

// Deterministic payload builder for monthly-attendance-approval-payload-builder.
// Ports the n8n nodes "生成审批内容" (approval description + stats) and
// "Code in JavaScript" (form array, dropping the read-only date widget) plus
// "发送 DM 通知" (the confirmation card) into a single pure function.
//
// On aevatar the tenant-token exchange + open.larksuite.com calls from the n8n
// source are dropped: the `api-lark-bot` NyxID proxy slug brokers credentials.
// This module never touches the network, secrets, or the wall clock.

const fs = require('fs');

const DEFAULTS = {
  // Lark attendance approval definition (workflow node "NyxID Config" a7).
  approvalCode: '3F02FB04-3919-4089-B42B-B1B557820EB5',
  // Submitter open id the approval is filed under (a8).
  submitterId: 'ee689459',
  // User who receives the confirmation DM (a9).
  notifyUserId: '831cg5af',
  // Attendance Bitable doc link surfaced in the approval + card (a6).
  docUrl: 'https://aelfblockchain.sg.larksuite.com/base/MwIRb3h5hauYvcsA28kl8FGfgjg?table=tblTDqjSDKffQ7cm&view=vewfR8fiQS',
  // Approval form widget ids (NyxID Config b1/b2/b3).
  // NOTE: widgetDate is a READ-ONLY date widget and is NOT submitted in `form`.
  widgetDateId: 'widget17167976379680001',
  widgetDescId: 'widget17195537488110001',
  widgetLinkId: 'widget17174729080890001',
  // Attendance Bitable source (NyxID Config a4/a5) — used to resolve records when
  // the caller passes a Bitable list response verbatim instead of pre-extracted rows.
  baseAppId: 'MwIRb3h5hauYvcsA28kl8FGfgjg',
  attendanceTableId: 'tblTDqjSDKffQ7cm'
};

// Bitable field names from the attendance table (verbatim, incl. mixed-width
// parentheses in the leave columns — they differ on purpose in the source sheet).
const FIELD = {
  month: '月份',
  workDays: '应出勤天数',
  personStatus: '人员情况',
  personalLeave: '事假(天）', // half-width '(' + full-width '）'
  sickLeave: '病假（天）' // full-width both sides
};

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

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Accept records pre-extracted (`[{fields:{...}}]` or `[{...}]`) or a raw Lark
// Bitable list response (`{data:{items:[...]}}` / `{items:[...]}`).
function extractRecords(record) {
  const raw =
    firstValue(record, ['records', 'items']) ||
    (record && record.data && (record.data.items || record.data.records)) ||
    [];
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => (r && typeof r === 'object' && r.fields && typeof r.fields === 'object' ? r.fields : r || {}));
}

// "人员情况" is an array of rich-text segments in Bitable; fall back to a string.
function readPersonStatus(fields) {
  const v = fields[FIELD.personStatus];
  if (Array.isArray(v)) return String((v[0] && (v[0].text || v[0].name)) || '');
  return String(v || '');
}

// Port of node "生成审批内容": compute stats from the attendance rows.
function computeStats(recordsFields) {
  let workDays = 0;
  for (const fields of recordsFields) {
    const v = toNumber(fields[FIELD.workDays]);
    if (v > 0) {
      workDays = v;
      break;
    }
  }

  let resignCount = 0;
  let leaveCount = 0;
  let sickCount = 0;
  for (const fields of recordsFields) {
    if (readPersonStatus(fields) === '离职') resignCount += 1;
    if (toNumber(fields[FIELD.personalLeave]) > 0) leaveCount += 1;
    if (toNumber(fields[FIELD.sickLeave]) > 0) sickCount += 1;
  }

  return { workDays, resignCount, leaveCount, sickCount };
}

// Port of node "生成审批内容": the ~5-line approval description (history format).
function buildDescription(year, month, stats) {
  return (
    `${year}年${month}月出勤天数：${stats.workDays}天 （单休）\n\n` +
    `离职人员：${stats.resignCount} 人\n\n` +
    `事假：${stats.leaveCount} 人\n\n` +
    `病假：${stats.sickCount} 人\n\n` +
    '【via lark-cli (auto-generated)】'
  );
}

// Port of node "发送 DM 通知": the interactive confirmation card.
function buildDmCard(year, month, stats, docUrl, instanceCode) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `✅ ${year}年${month}月 中国区考勤审批已提交` },
      template: 'blue'
    },
    elements: [
      {
        tag: 'div',
        fields: [
          { is_short: true, text: { tag: 'lark_md', content: `**出勤天数**\n${stats.workDays} 天（单休）` } },
          { is_short: true, text: { tag: 'lark_md', content: `**离职人员**\n${stats.resignCount} 人` } },
          { is_short: true, text: { tag: 'lark_md', content: `**事假**\n${stats.leaveCount} 人` } },
          { is_short: true, text: { tag: 'lark_md', content: `**病假**\n${stats.sickCount} 人` } }
        ]
      },
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [
          { tag: 'button', text: { tag: 'plain_text', content: '查看考勤表' }, type: 'primary', url: docUrl }
        ]
      },
      {
        tag: 'note',
        elements: [{ tag: 'plain_text', content: `审批编号: ${instanceCode} | 由 aevatar 自动提交` }]
      }
    ]
  };
}

function buildPayload(input) {
  const record = source(input || {});
  const recordsFields = extractRecords(record);

  // Resolve year / month. Prefer explicit caller values (deterministic); never
  // read the wall clock here — aevatar resolves "this month" upstream.
  const year = toNumber(firstValue(record, ['year', 'Year']));
  const month = toNumber(firstValue(record, ['month', 'Month']));
  if (!year || !month) {
    return { needs_more_information: true, missing: ['year', 'month'] };
  }
  if (recordsFields.length === 0) {
    return { needs_more_information: true, missing: ['records'] };
  }

  const approvalCode = String(firstValue(record, ['approval_code', 'approvalCode']) || DEFAULTS.approvalCode).trim();
  const submitterId = String(firstValue(record, ['submitter_id', 'submitterId', 'user_id', 'userId']) || DEFAULTS.submitterId).trim();
  const notifyUserId = String(firstValue(record, ['notify_user_id', 'notifyUserId']) || DEFAULTS.notifyUserId).trim();
  const docUrl = String(firstValue(record, ['doc_url', 'docUrl', 'sheetUrl']) || DEFAULTS.docUrl).trim();
  const widgetDescId = String(firstValue(record, ['widget_desc_id', 'descWidgetId']) || DEFAULTS.widgetDescId).trim();
  const widgetLinkId = String(firstValue(record, ['widget_link_id', 'linkWidgetId']) || DEFAULTS.widgetLinkId).trim();
  const instanceCode = String(firstValue(record, ['instance_code', 'instanceCode']) || '—').trim();

  const stats = computeStats(recordsFields);
  const description = buildDescription(year, month, stats);

  // Port of node "Code in JavaScript": the read-only date widget is OMITTED;
  // only the textarea (description) + input (doc link) widgets are submitted.
  const form = [
    { id: widgetDescId, type: 'textarea', value: description },
    { id: widgetLinkId, type: 'input', value: docUrl }
  ];

  const dmCard = buildDmCard(year, month, stats, docUrl, instanceCode);

  return {
    message_type: 'lark_attendance_approval_instance',
    summary: `${year}年${month}月 中国区考勤审批 (出勤 ${stats.workDays} 天 / 离职 ${stats.resignCount} / 事假 ${stats.leaveCount} / 病假 ${stats.sickCount})`,
    month: `${year}-${month}`,
    stats,
    description,
    form,
    // Exact POST /open-apis/approval/v4/instances body.
    approval: {
      path: '/open-apis/approval/v4/instances',
      method: 'POST',
      body: {
        approval_code: approvalCode,
        user_id: submitterId,
        form: JSON.stringify(form)
      }
    },
    // Exact POST /open-apis/im/v1/messages?receive_id_type=user_id body.
    dm: {
      path: '/open-apis/im/v1/messages?receive_id_type=user_id',
      method: 'POST',
      receive_id_type: 'user_id',
      body: {
        receive_id: notifyUserId,
        msg_type: 'interactive',
        content: JSON.stringify(dmCard)
      }
    }
  };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildPayload(readInput()), null, 2)}\n`);
}

module.exports = { buildPayload };
