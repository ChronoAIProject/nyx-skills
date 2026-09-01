#!/usr/bin/env node
'use strict';

const fs = require('fs');

const DEFAULT_APP_TOKEN = 'BASE_APP_TOKEN_PLACEHOLDER_2';
const DEFAULT_TABLE_ID = 'TABLE_ID_PLACEHOLDER_2';
const DEFAULT_CHAT_ID = 'oc_PLACEHOLDER_CHAT_ID_1';
const DEFAULT_LARK_BASE_HOST = 'https://aelfblockchain.sg.larksuite.com/base';

const VALID_RADAR_ACTIONS = new Set(['待回复', '已回复', '跳过', 'MONITOR', '草稿已备']);
const VALID_COHORTS = new Set(['A', 'B', 'A+B', 'partner', 'unknown']);
const ANGLE_NAME = {
  A: 'NAT pierce',
  B: 'MCP auto-wrap',
  C: 'Credential injection',
  D: 'Open-source',
  E: 'Cross-platform',
  F: 'Smart Home Integration',
  G: 'HA + AI bridge',
  X: 'Unclassified',
  P: 'Peer Help'
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

function asRecord(item) {
  return item && item.json && typeof item.json === 'object' ? item.json : item;
}

function inputItems(input) {
  const record = source(input || {});
  if (Array.isArray(record)) return record.map(asRecord);
  const value = firstValue(record, ['items', 'records', 'radarItems', 'radar_items', 'written', 'writtenRecords', 'written_records']);
  if (Array.isArray(value)) return value.map(asRecord);
  if (record && (record.title || record.url || record.fields)) return [asRecord(record)];
  return null;
}

function str(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function safeRadarAction(value, fallback = '跳过') {
  return VALID_RADAR_ACTIONS.has(value) ? value : fallback;
}

function safeCohort(value) {
  if (!value) return 'unknown';
  return VALID_COHORTS.has(value) ? value : 'unknown';
}

function normalizeUrl(url) {
  if (!url) return '';
  const raw = String(url).trim();
  try {
    const parsed = new URL(raw);
    let path = parsed.pathname;
    const match = path.match(/^(\/r\/[^/]+\/comments\/[a-z0-9]+)/i);
    if (match) path = match[1];
    return (parsed.origin + path).replace(/\/+$/, '').toLowerCase();
  } catch (_) {
    return raw.replace(/\?.*$/, '').replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();
  }
}

function larkIdValue(value, fallback) {
  if (value && typeof value === 'object' && value.value !== undefined && value.value !== null) return String(value.value);
  if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  return fallback;
}

function resourceLocator(value) {
  return { __rl: true, value, mode: 'id' };
}

function connectorOptions(input) {
  const record = source(input || {});
  const appToken = larkIdValue(firstValue(record, ['app_token', 'appToken', 'baseAppToken', 'base_app_token']), DEFAULT_APP_TOKEN);
  const tableId = larkIdValue(firstValue(record, ['table_id', 'tableId', 'radarTableId', 'radar_table_id']), DEFAULT_TABLE_ID);
  const chatId = larkIdValue(firstValue(record, ['chat_id', 'chatId', 'receive_id', 'receiveId']), DEFAULT_CHAT_ID);
  const cardUrl = String(firstValue(record, ['cardUrl', 'card_url', 'tableUrl', 'table_url', 'baseUrl', 'base_url']) || `${DEFAULT_LARK_BASE_HOST}/${appToken}?table=${tableId}`);
  return { appToken, tableId, chatId, cardUrl };
}

function applyActionStatus(item) {
  const fresh = item.freshness;
  const op = item.op_class || 'unknown';
  const traction = item.traction || {};
  const enrichOk = (item.enrichment_status || '').endsWith('-ok');
  let actionStatus;

  if (op === 'noob') {
    actionStatus = 'MONITOR';
  } else if (op === 'expert') {
    actionStatus = 'MONITOR';
  } else if (enrichOk && (
    (item.platform === 'Reddit' && item.hoursAgo > 6 && (traction.ups || 0) === 0 && (traction.comments || 0) === 0) ||
    ((item.platform === 'n8n Forum' || item.platform === 'HA Forum') && item.hoursAgo > 6 && (traction.views || 0) < 10)
  )) {
    actionStatus = 'MONITOR';
  } else if (typeof item.quality_score === 'number' && item.quality_score <= 3) {
    actionStatus = 'MONITOR';
  } else if ((fresh === 'ACT NOW' || fresh === 'ACT TODAY') && enrichOk && op === 'builder') {
    actionStatus = '待回复';
  } else if ((fresh === 'ACT NOW' || fresh === 'ACT TODAY') && enrichOk && op === 'unknown') {
    actionStatus = '待回复';
  } else if ((fresh === 'ACT NOW' || fresh === 'ACT TODAY') && !enrichOk) {
    actionStatus = 'MONITOR';
  } else {
    actionStatus = 'MONITOR';
  }

  return { ...item, reply_draft: '', action_status: actionStatus };
}

function larkFields(item) {
  const d = applyActionStatus(item);
  if (d._empty || !d.title || !d.url || !d.platform) return null;

  const urlNorm = normalizeUrl(d.url);
  let postDateMs;
  if (d.pubDate) {
    const parsed = new Date(d.pubDate).getTime();
    if (!Number.isNaN(parsed)) postDateMs = parsed;
  }

  let excerptWithMeta;
  if (d.op_body && d.op_body.length > 30) {
    excerptWithMeta = '[OP body] ' + d.op_body;
  } else {
    excerptWithMeta = str(d.excerpt);
  }

  const traction = d.traction || {};
  const metaParts = [];
  if (traction.ups != null) metaParts.push('ups=' + traction.ups);
  if (traction.comments != null) metaParts.push('c=' + traction.comments);
  if (traction.score != null) metaParts.push('hn_score=' + traction.score);
  if (traction.views != null) metaParts.push('v=' + traction.views);
  if (traction.posts != null) metaParts.push('posts=' + traction.posts);
  if (traction.participants != null) metaParts.push('p=' + traction.participants);
  if (typeof d.hoursAgo === 'number') metaParts.push('age=' + d.hoursAgo + 'h');
  if (d.op_class) metaParts.push('OP=' + d.op_class);
  if (d.accepted_answer) metaParts.push('acc_ans=true');
  if (d.top_comment_score) metaParts.push('top_c=' + d.top_comment_score);
  if (d.enrichment_status && d.enrichment_status !== 'reddit-ok' && d.enrichment_status !== 'forum-ok' && d.enrichment_status !== 'hn-ok') metaParts.push('enrich=' + d.enrichment_status);
  if (d.llm_verdict) metaParts.push('llm=' + d.llm_verdict);
  if (d.matchedTier) metaParts.push('tier=' + d.matchedTier);
  if (metaParts.length) excerptWithMeta += '\n\n[META V2.1] ' + metaParts.join(' | ');

  const fields = {
    '标题': str(d.title),
    'URL': d.url ? { link: d.url, text: str(d.title) || d.url } : undefined,
    '平台': str(d.platform),
    '类别': str(d.category),
    'Cohort': safeCohort(d.cohort),
    '新鲜度': str(d.freshness) || 'MONITOR',
    'Angle': d.angle_code ? (d.angle_code + '-' + ANGLE_NAME[d.angle_code]) : '',
    '关键词命中': str(d.matchedKeywords),
    '摘要': excerptWithMeta,
    '回复草稿': str(d.reply_draft),
    'CTA': str(d.cta),
    '行动状态': safeRadarAction(str(d.action_status) || 'MONITOR', '跳过'),
    '批次ID': str(d.batch_id),
    '相关度': typeof d.relevance_score === 'number' ? d.relevance_score : 0,
    '帖子质量分': typeof d.quality_score === 'number' ? d.quality_score : undefined,
    '规范化URL': urlNorm || '',
    '帖子发布日期': postDateMs
  };

  Object.keys(fields).forEach((key) => fields[key] === undefined && delete fields[key]);
  return fields;
}

function createRecordRequest(fields, options) {
  const body = { fields };
  return {
    resource: 'base',
    operation: 'createRecord',
    app_token: resourceLocator(options.appToken),
    table_id: resourceLocator(options.tableId),
    body,
    body_json: JSON.stringify(body),
    options: {}
  };
}

function buildRecords(input) {
  const items = inputItems(input);
  if (!items) return { needs_more_information: true, missing: ['items'] };

  const options = connectorOptions(input);
  const records = [];
  let dropped_empty = 0;

  for (const item of items) {
    const fields = larkFields(item);
    if (!fields) {
      dropped_empty++;
      continue;
    }
    records.push({ fields });
  }

  const createRecordRequests = records.map((record) => createRecordRequest(record.fields, options));
  if (records.length === 0) {
    return {
      skip: true,
      reason: 'no valid radar records',
      dropped_empty,
      records: [],
      lark: { createRecordRequests: [] }
    };
  }

  return {
    message_type: 'lark_base_records',
    records,
    dropped_empty,
    lark: { createRecordRequests }
  };
}

function fieldSource(item) {
  const record = asRecord(item);
  return record && record.fields ? record.fields : record;
}

function runTime(input) {
  const record = source(input || {});
  const value = firstValue(record, ['run_time', 'runTime', 'executedAt', 'executed_at']);
  return value === undefined ? undefined : String(value);
}

function statsFrom(items, run_time, cardUrl) {
  const written = items.map(fieldSource);
  const stats = {
    total: written.length,
    act_now: 0,
    act_today: 0,
    monitor: 0,
    categories: {},
    platforms: {},
    drafts_generated: 0,
    run_time
  };

  for (const fields of written) {
    const freshness = fields['新鲜度'] || fields.freshness || '';
    const category = fields['类别'] || fields.category || '';
    const platform = fields['平台'] || fields.platform || '';
    const draft = fields['回复草稿'] || fields.reply_draft || '';

    if (freshness === 'ACT NOW') stats.act_now++;
    else if (freshness === 'ACT TODAY') stats.act_today++;
    else stats.monitor++;

    stats.categories[category] = (stats.categories[category] || 0) + 1;
    stats.platforms[platform] = (stats.platforms[platform] || 0) + 1;
    if (draft && draft.length > 10 && !String(draft).startsWith('[')) stats.drafts_generated++;
  }

  const catText = Object.entries(stats.categories).map(([key, value]) => key + ': ' + value).join(' | ');
  const platText = Object.entries(stats.platforms).map(([key, value]) => key + ': ' + value).join(' | ');

  stats.summary = '[Community Radar] ' + stats.total + ' items: ' + stats.act_now + ' ACT NOW, ' + stats.act_today + ' ACT TODAY, ' + stats.monitor + ' MONITOR | ' + stats.drafts_generated + ' drafts';
  const card = {
    header: { title: { tag: 'plain_text', content: '📡 NyxID Community Radar' }, template: 'green' },
    elements: [
      { tag: 'div', fields: [
        { is_short: true, text: { tag: 'lark_md', content: '**📊 命中总数**\n' + stats.total + ' 条' } },
        { is_short: true, text: { tag: 'lark_md', content: '**📅 运行时间**\n' + stats.run_time.slice(0, 19).replace('T', ' ') } }
      ] },
      { tag: 'hr' },
      { tag: 'div', fields: [
        { is_short: true, text: { tag: 'lark_md', content: '**🔴 ACT NOW**\n' + stats.act_now + ' 条' } },
        { is_short: true, text: { tag: 'lark_md', content: '**🟡 ACT TODAY**\n' + stats.act_today + ' 条' } }
      ] },
      { tag: 'div', fields: [
        { is_short: true, text: { tag: 'lark_md', content: '**⚪ MONITOR**\n' + stats.monitor + ' 条' } },
        { is_short: true, text: { tag: 'lark_md', content: '**✏️ 草稿生成**\n' + stats.drafts_generated + ' 条' } }
      ] },
      { tag: 'hr' },
      { tag: 'div', text: { tag: 'lark_md', content: '**📂 类别:** ' + catText } },
      { tag: 'div', text: { tag: 'lark_md', content: '**📍 平台:** ' + platText } },
      { tag: 'hr' },
      { tag: 'action', actions: [
        { tag: 'button', text: { tag: 'plain_text', content: '📋 打开 NyxID Community Radar 表' }, url: cardUrl, type: 'primary' }
      ] }
    ]
  };

  return { stats, card, lark_card: JSON.stringify(card) };
}

function buildDigest(input) {
  const items = inputItems(input);
  if (!items) return { needs_more_information: true, missing: ['items'] };
  const run_time = runTime(input);
  if (!run_time) return { needs_more_information: true, missing: ['runTime'] };

  const options = connectorOptions(input);
  const { stats, card, lark_card } = statsFrom(items, run_time, options.cardUrl);
  return {
    message_type: 'lark_interactive_message',
    summary: stats.summary,
    stats,
    card,
    lark_card,
    lark: {
      sendMessage: {
        resource: 'message',
        operation: 'send',
        receive_id_type: 'chat_id',
        receive_id: options.chatId,
        msg_type: 'interactive',
        content: lark_card,
        options: {}
      }
    }
  };
}

function buildAll(input) {
  const run_time = runTime(input);
  if (!run_time) return { needs_more_information: true, missing: ['runTime'] };

  const recordResult = buildRecords(input);
  if (recordResult.needs_more_information || recordResult.skip) return recordResult;

  const digestInput = { ...source(input || {}), records: recordResult.records, run_time };
  const digestResult = buildDigest(digestInput);
  if (digestResult.needs_more_information) return digestResult;

  return {
    message_type: 'community_radar_lark_payloads',
    records: recordResult.records,
    dropped_empty: recordResult.dropped_empty,
    stats: digestResult.stats,
    card: digestResult.card,
    lark_card: digestResult.lark_card,
    lark: {
      createRecordRequests: recordResult.lark.createRecordRequests,
      sendMessage: digestResult.lark.sendMessage
    }
  };
}

function buildPayload(input) {
  const record = source(input || {});
  const mode = String(record.mode || 'build_all');
  if (mode === 'build_records' || mode === 'records' || mode === 'base_records') return buildRecords(record);
  if (mode === 'build_digest' || mode === 'digest' || mode === 'card') return buildDigest(record);
  return buildAll(record);
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildPayload(readInput()), null, 2)}\n`);
}

module.exports = { buildPayload };
