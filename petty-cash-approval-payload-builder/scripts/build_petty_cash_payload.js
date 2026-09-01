#!/usr/bin/env node
'use strict';

const fs = require('fs');

const CN_MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

const DEFAULTS = {
  alexOpenId: 'ou_6cb891b9d89fe1ac1ba6c09c2a19d688',
  allowedOpenIds: [
    'ou_6cb891b9d89fe1ac1ba6c09c2a19d688',
    'ou_e3a4a55f04b0a6c84d2b5e0ec0c8054d',
    'ou_dc1bba3aa2ddc537804f7716d271fcf5',
    'ou_8d2645a83e22201403fe5e492d01b3e9'
  ],
  approvalCode: 'A258D96B-567C-4327-9C5B-C53500C0AED2',
  claimers: ['Kong', 'Alex', 'Michael', 'John', 'Stephan', 'Zoe', 'Wang', 'Ada'],
  properties: ['2 COVE WAY', '48A JLAN KG CHANTEK', '26E PIERCE ROAD'],
  currencies: ['SGD', 'USD', 'CNY'],
  widgetIds: {
    reason: 'widget17167786766400001',
    amount: 'widget17167786834600001',
    sheet_url: 'widget17167786925010001'
  }
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

function asArray(value, fallback) {
  return Array.isArray(value) && value.length ? value : fallback;
}

function parseMessageText(message) {
  const raw = message && message.content !== undefined ? String(message.content) : '';
  try {
    const parsed = JSON.parse(raw || '{}');
    return String(parsed.text || '').trim();
  } catch (_) {
    return raw.trim();
  }
}

function matchProperty(token, properties) {
  const t = String(token || '').toLowerCase().replace(/\s+/g, '');
  if (t.length < 2) return null;
  for (const property of properties) {
    const norm = String(property).toLowerCase().replace(/\s+/g, '');
    if (norm.startsWith(t) || norm.includes(t)) return property;
  }
  return null;
}

function routeEvent(input) {
  const body = source(input || {});
  if (body.type === 'url_verification' || body.challenge) {
    return { skip: true, routeKind: 'verify', is_challenge: true, challenge: body.challenge };
  }
  const headerType = body && body.header && body.header.event_type;
  if (headerType === 'im.message.receive_v1') return { routeKind: 'im', body };
  if (headerType === 'card.action.trigger') return { routeKind: 'card.action', body };
  if (headerType === 'approval_instance') return { routeKind: 'approval', body };
  return { skip: true, routeKind: 'unknown', headerType };
}

function parseEvent(input) {
  const routed = routeEvent(input);
  if (routed.skip) return routed;
  if (routed.routeKind !== 'im') return { skip: true, reason: `not an im message event: ${routed.routeKind}` };

  const record = input || {};
  const body = routed.body || {};
  const event = body.event || {};
  const message = event.message || {};
  const senderOpenId = event.sender && event.sender.sender_id && event.sender.sender_id.open_id;
  const allowedOpenIds = asArray(record.allowedOpenIds || record.allowed_open_ids, DEFAULTS.allowedOpenIds);
  const allow = allowedOpenIds.length ? allowedOpenIds : [record.alexOpenId || record.alex_open_id || DEFAULTS.alexOpenId];

  if (message.chat_type !== 'p2p') return { skip: true, reason: 'not_p2p' };
  if (!allow.includes(senderOpenId)) return { skip: true, reason: 'not_whitelisted', senderOpenId };

  const base = {
    skip: false,
    messageId: message.message_id,
    chatId: message.chat_id,
    senderOpenId
  };

  if (message.message_type === 'image') {
    let content = {};
    try {
      content = JSON.parse(message.content || '{}');
    } catch (_) {
      content = {};
    }
    return { ...base, kind: 'image', imageKey: content.image_key };
  }

  if (message.message_type !== 'text') return { skip: true, reason: 'unsupported_message_type' };

  const text = parseMessageText(message);
  if (text === '提交' || text.toLowerCase() === 'submit') return { ...base, kind: 'submit' };

  const cashInMatch = text.match(/^申请充值\s+(\d+(?:\.\d+)?)\s+([A-Z]{3})(?:\s+(.+))?$/);
  if (cashInMatch) {
    return {
      ...base,
      kind: 'request_cash_in',
      amount: parseFloat(cashInMatch[1]),
      currency: cashInMatch[2],
      note: cashInMatch[3] || ''
    };
  }

  if (text === '清空' || text === 'clear') return { ...base, kind: 'reset_remark' };
  if (text === '新批次' || text.toLowerCase() === 'new batch') return { ...base, kind: 'new_batch' };
  if (text === '关闭' || text === '结束' || text.toLowerCase() === 'close') return { ...base, kind: 'close_row' };
  if (text === '清空备注' || text.toLowerCase() === 'reset remark') return { ...base, kind: 'reset_remark' };

  const remarkMatch = text.match(/^(?:备注|remark)\s+(.+)$/i);
  if (remarkMatch) return { ...base, kind: 'add_remark', remark: remarkMatch[1].trim() };

  const switchMatch = text.match(/^换\s+(\S+)\s+(.+)$/);
  if (switchMatch) {
    const claimers = asArray(record.claimers, DEFAULTS.claimers);
    const properties = asArray(record.properties, DEFAULTS.properties);
    const claimerTok = switchMatch[1];
    const propertyTok = switchMatch[2];
    const claimer = claimers.find(c => String(c).toLowerCase() === claimerTok.toLowerCase()) || null;
    const property = matchProperty(propertyTok, properties);
    if (claimer && property) return { ...base, kind: 'switch_session', claimer, property };
    return { ...base, kind: 'switch_session_invalid', reason: `claimer=${claimer} property=${property}` };
  }

  const ensureMatch = text.match(/^建tab(?:\s+(\d{4})\s+(\S+))?$/);
  if (ensureMatch) {
    if (ensureMatch[1] && ensureMatch[2]) {
      const targetYear = parseInt(ensureMatch[1], 10);
      const targetMonthCn = ensureMatch[2];
      if (CN_MONTHS.indexOf(targetMonthCn) < 0) return { ...base, kind: 'ensure_tab_invalid', reason: `unknown month: ${targetMonthCn}` };
      return { ...base, kind: 'ensure_tab', target_year: targetYear, target_month_cn: targetMonthCn };
    }
    const missing = ['target_year', 'target_month_cn'];
    return { needs_more_information: true, missing };
  }

  return { ...base, kind: 'text_other', text };
}

function buildApprovalInstance(input) {
  const record = source(input || {});
  const fields = {
    amount: firstValue(record, ['amount', 'Amount', 'rechargeAmount', 'recharge_amount']),
    currency: firstValue(record, ['currency', 'Currency']),
    reason: firstValue(record, ['reason', 'Reason', 'note', 'Note', 'remark', 'Remark']),
    sheetUrl: firstValue(record, ['sheetUrl', 'sheet_url', 'sheetURL', 'sheet_url_value', 'url']),
    userId: firstValue(record, ['user_id', 'userId', 'open_id', 'openId', 'senderOpenId', 'operatorId'])
  };
  const missing = Object.entries(fields)
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
    .map(([key]) => key);
  if (missing.length) return { needs_more_information: true, missing };

  const amount = Number(fields.amount);
  if (!Number.isFinite(amount)) return { needs_more_information: true, missing: ['amount'] };

  const currency = String(fields.currency).trim().toUpperCase();
  const reason = String(fields.reason).trim();
  const sheetUrl = String(fields.sheetUrl).trim();
  const userId = String(fields.userId).trim();
  const approvalCode = String(firstValue(record, ['approval_code', 'approvalCode']) || DEFAULTS.approvalCode).trim();
  const widgetIds = {
    reason: String(firstValue(record, ['reasonWidgetId', 'reason_widget_id']) || DEFAULTS.widgetIds.reason).trim(),
    amount: String(firstValue(record, ['amountWidgetId', 'amount_widget_id']) || DEFAULTS.widgetIds.amount).trim(),
    sheet_url: String(firstValue(record, ['sheetUrlWidgetId', 'sheet_url_widget_id']) || DEFAULTS.widgetIds.sheet_url).trim()
  };
  const currencyRange = asArray(record.currencyRange || record.currency_range, DEFAULTS.currencies).map(String);
  const form = [
    { id: widgetIds.reason, type: 'textarea', value: reason },
    { id: widgetIds.amount, type: 'amount', value: amount, currency, ext: { currency, currencyRange } },
    { id: widgetIds.sheet_url, type: 'input', value: sheetUrl }
  ];

  return {
    message_type: 'lark_approval_instance',
    summary: `Petty cash recharge approval for ${currency} ${amount}`,
    request: {
      amount,
      currency,
      reason,
      sheetUrl,
      userId
    },
    form,
    lark: {
      path: '/open-apis/approval/v4/instances',
      body: {
        approval_code: approvalCode,
        user_id: userId,
        form: JSON.stringify(form)
      }
    }
  };
}

function buildPayload(input) {
  const mode = input.mode || 'parse_event';
  if (mode === 'build_approval_instance') return buildApprovalInstance(input);
  if (mode === 'parse_event') return parseEvent(input);
  return { skip: true, reason: `unknown mode: ${mode}` };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildPayload(readInput()), null, 2)}\n`);
}

module.exports = { buildPayload };
