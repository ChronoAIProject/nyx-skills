#!/usr/bin/env node
'use strict';

// Deterministic port of the n8n "P2 Budget Monitor — Weekly Variance Alert" flow.
// Reproduces the "计算差异" (variance computation) and "构建卡片" (Lark card builder)
// code nodes as a single inline-importable builder.
//
//   const { buildPayload } = require('./build_budget_variance_payload.js');
//   const out = buildPayload({
//     coreBudget: [...rows],   // each row = a Bitable record's `fields` object
//     coreActual: [...rows],
//     aelfBudget: [...rows],
//     aelfActual: [...rows],
//     today: '2026-05-25'       // optional, used only for the week number / header
//   });
//   // out.message  -> one-line human summary
//   // out.lark.body -> Lark im/v1/messages send body { receive_id?, msg_type, content }
//   // out.card      -> the raw interactive card object (content before JSON.stringify)
//
// The script accepts the 4 tables as raw Bitable API responses OR already-extracted
// `fields` rows OR n8n `{ json: { ... } }` wrappers, so the agent can paste whatever it
// fetched. It NEVER fetches data, holds tokens, or sends messages — Aevatar does that.

const fs = require('fs');

const DEFAULT_RECEIVE_ID = 'ou_3d9067006e9fb8eb8e5fc7b2bb4c6264';
const DEFAULT_RECEIVE_ID_TYPE = 'open_id';

const AMOUNT_FIELD = '支出金额(USD)';
const DATE_FIELD = '日期';
const CATEGORY_FIELD = '一级类目';
const BU_FIELD = 'BU';

// ----- input plumbing (mirrors the sibling payload builders) -----------------

function readInput() {
  const text = fs.readFileSync(0, 'utf8');
  return text.trim() ? JSON.parse(text) : {};
}

function source(input) {
  return input && input.body && typeof input.body === 'object' && !Array.isArray(input.body) ? input.body : input;
}

function asRecord(item) {
  return item && item.json && typeof item.json === 'object' ? item.json : item;
}

function firstValue(record, names) {
  for (const name of names) {
    const value = record ? record[name] : undefined;
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

function larkIdValue(value, fallback) {
  if (value && typeof value === 'object' && value.value !== undefined && value.value !== null) return String(value.value);
  if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  return fallback;
}

function connectorOptions(input) {
  const record = source(input || {});
  return {
    receiveId: larkIdValue(firstValue(record, ['receive_id', 'receiveId', 'open_id', 'openId', 'chat_id', 'chatId']), DEFAULT_RECEIVE_ID),
    receiveIdType: String(firstValue(record, ['receive_id_type', 'receiveIdType']) || DEFAULT_RECEIVE_ID_TYPE)
  };
}

// Accept: a Bitable API response ({ data: { items: [{ fields }] } }),
// an array of records, an array of `fields` objects, or n8n `{ json }` wrappers.
// Returns a flat array of `fields` objects (one per Bitable record).
function extractRecords(raw) {
  const value = asRecord(raw);
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value.flatMap(extractRecords);
  }
  if (typeof value !== 'object') return [];
  if (value.data && value.data.items) {
    return value.data.items.map((item) => (item && item.fields ? item.fields : item)).filter(Boolean);
  }
  if (Array.isArray(value.items)) {
    return value.items.map((item) => (item && item.fields ? item.fields : item)).filter(Boolean);
  }
  if (value.fields && typeof value.fields === 'object') return [value.fields];
  // Already a `fields` object.
  return [value];
}

function tableRows(record, names) {
  for (const name of names) {
    if (record && record[name] !== undefined) return extractRecords(record[name]);
  }
  return [];
}

// ----- "计算差异" port -------------------------------------------------------

function parseAmount(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let s = String(val).replace(/[,\s"]/g, '');
  if (s.startsWith('(') && s.endsWith(')')) return -parseFloat(s.slice(1, -1)) || 0;
  return parseFloat(s) || 0;
}

// Normalize any date format to YYYY-MM-DD.
function normalizeDate(d) {
  if (!d) return '';
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, '-');
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); // D/M/YY or DD/MM/YY (Bitable auto-format)
  if (m) {
    const day = m[1].padStart(2, '0');
    const mon = m[2].padStart(2, '0');
    const yr = m[3].length === 2 ? '20' + m[3] : m[3];
    return yr + '-' + mon + '-' + day;
  }
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // M/D/YYYY
  if (m2) {
    return m2[3] + '-' + m2[1].padStart(2, '0') + '-' + m2[2].padStart(2, '0');
  }
  return s;
}

function normalizeDates(records) {
  for (let i = 0; i < records.length; i++) {
    records[i][DATE_FIELD] = normalizeDate(records[i][DATE_FIELD]);
  }
  return records;
}

function getMaxDate(records) {
  const dates = records.map((r) => r[DATE_FIELD] || '').filter(Boolean).sort();
  return dates[dates.length - 1] || '';
}

function filterByDate(records, cutoff) {
  if (!cutoff) return records;
  return records.filter((r) => (r[DATE_FIELD] || '') <= cutoff);
}

function aggregate(records, groupKey) {
  const groups = {};
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const key = r[groupKey] || 'Unknown';
    groups[key] = (groups[key] || 0) + parseAmount(r[AMOUNT_FIELD]);
  }
  return groups;
}

function computeVariance(budgetAgg, actualAgg) {
  const allKeys = Object.keys(budgetAgg);
  Object.keys(actualAgg).forEach((k) => { if (allKeys.indexOf(k) === -1) allKeys.push(k); });
  return allKeys.map((key) => {
    const budget = budgetAgg[key] || 0;
    const actual = actualAgg[key] || 0;
    const pct = budget > 0 ? (actual / budget * 100) : (actual > 0 ? -1 : 0);
    let level = 'ok';
    if (pct >= 120 || pct === -1) level = 'over';
    else if (pct >= 100) level = 'warning';
    else if (pct >= 80) level = 'watch';
    return {
      category: key,
      budget: Math.round(budget * 100) / 100,
      actual: Math.round(actual * 100) / 100,
      pct: pct === -1 ? -1 : Math.round(pct * 10) / 10,
      level: level
    };
  }).sort((a, b) => (b.pct === -1 ? 999 : b.pct) - (a.pct === -1 ? 999 : a.pct));
}

function sumAgg(obj) {
  let t = 0;
  for (const k in obj) t += obj[k];
  return Math.round(t * 100) / 100;
}

function computeData(input) {
  const record = source(input || {});

  const coreBudgetAll = normalizeDates(tableRows(record, ['coreBudget', 'core_budget', 'coreBudgetRows', 'core_budget_rows']));
  const coreActualAll = normalizeDates(tableRows(record, ['coreActual', 'core_actual', 'coreActualRows', 'core_actual_rows']));
  const aelfBudgetAll = normalizeDates(tableRows(record, ['aelfBudget', 'aelf_budget', 'aelfBudgetRows', 'aelf_budget_rows']));
  const aelfActualAll = normalizeDates(tableRows(record, ['aelfActual', 'aelf_actual', 'aelfActualRows', 'aelf_actual_rows']));

  const coreCutoff = getMaxDate(coreActualAll);
  const aelfCutoff = getMaxDate(aelfActualAll);
  const dataCutoff = coreCutoff > aelfCutoff ? coreCutoff : aelfCutoff;

  const coreBudget = filterByDate(coreBudgetAll, coreCutoff);
  const coreActual = coreActualAll;
  const aelfBudget = filterByDate(aelfBudgetAll, aelfCutoff);
  const aelfActual = aelfActualAll;

  const coreVariance = computeVariance(aggregate(coreBudget, CATEGORY_FIELD), aggregate(coreActual, CATEGORY_FIELD));
  const aelfVariance = computeVariance(aggregate(aelfBudget, CATEGORY_FIELD), aggregate(aelfActual, CATEGORY_FIELD));
  const coreByBU = computeVariance(aggregate(coreBudget, BU_FIELD), aggregate(coreActual, BU_FIELD));

  const coreTotalBudget = sumAgg(aggregate(coreBudget, CATEGORY_FIELD));
  const coreTotalActual = sumAgg(aggregate(coreActual, CATEGORY_FIELD));
  const aelfTotalBudget = sumAgg(aggregate(aelfBudget, CATEGORY_FIELD));
  const aelfTotalActual = sumAgg(aggregate(aelfActual, CATEGORY_FIELD));

  return {
    dataCutoff: dataCutoff,
    coreCutoff: coreCutoff,
    aelfCutoff: aelfCutoff,
    coreBudgetRecords: coreBudget.length,
    aelfBudgetRecords: aelfBudget.length,
    core: { variance: coreVariance, byBU: coreByBU, totalBudget: coreTotalBudget, totalActual: coreTotalActual },
    aelf: { variance: aelfVariance, totalBudget: aelfTotalBudget, totalActual: aelfTotalActual }
  };
}

// ----- "构建卡片" port -------------------------------------------------------

// Deterministic: the report's reference date comes ONLY from input `today`, and
// falls back to the data cutoff. The system clock is never read.
function referenceDate(input, dataCutoff) {
  const record = source(input || {});
  const value = firstValue(record, ['today', 'date', 'runDate', 'run_date']);
  return parseYmd(value) || parseYmd(dataCutoff) || null;
}

function parseYmd(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const m = normalizeDate(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

// ISO-week-style number used by the n8n source:
// ceil((date - Jan 1 of its year) / one week). Computed without Date() math.
function weekNumber(ref) {
  if (!ref) return 0;
  const dayOfYear = ordinalDay(ref.year, ref.month, ref.day);
  return Math.ceil(((dayOfYear - 1) * 86400000) / 604800000) || 1;
}

function ordinalDay(year, month, day) {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const monthDays = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let total = day;
  for (let i = 0; i < month - 1; i++) total += monthDays[i];
  return total;
}

function fmtUSD(n) {
  return '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
}

function fmtPct(p) {
  return p === -1 ? 'N/A(无预算)' : p + '%';
}

const LEVEL_EMOJI = { over: '🔴', warning: '🟡', watch: '🟢' };
const LEVEL_LABEL = { over: '超支 (>=120%)', warning: '警告 (>=100%)', watch: '关注 (>=80%)' };

function buildSection(title, variance, totalBudget, totalActual) {
  const totalPct = totalBudget > 0 ? Math.round(totalActual / totalBudget * 1000) / 10 : 0;
  let md = '**' + title + '**  总计: ' + fmtUSD(totalActual) + ' / ' + fmtUSD(totalBudget) + ' (' + totalPct + '%)\n\n';
  const levels = ['over', 'warning', 'watch'];
  for (let li = 0; li < levels.length; li++) {
    const level = levels[li];
    const items = variance.filter((v) => v.level === level);
    if (items.length === 0) continue;
    md += LEVEL_EMOJI[level] + ' **' + LEVEL_LABEL[level] + '**\n';
    for (let i = 0; i < items.length; i++) {
      md += '- ' + items[i].category + '  ' + fmtUSD(items[i].actual) + ' / ' + fmtUSD(items[i].budget) + '  ' + fmtPct(items[i].pct) + '\n';
    }
    md += '\n';
  }
  const okCount = variance.filter((v) => v.level === 'ok').length;
  if (okCount > 0) md += '✅ 正常项: ' + okCount + ' 项\n';
  return md;
}

function buildCard(data, ref) {
  const weekNum = weekNumber(ref);
  const coreSection = buildSection('核心业务看板', data.core.variance, data.core.totalBudget, data.core.totalActual);
  const aelfSection = buildSection('aelf BU 看板', data.aelf.variance, data.aelf.totalBudget, data.aelf.totalActual);

  const hasOver = data.core.variance.some((v) => v.level === 'over') || data.aelf.variance.some((v) => v.level === 'over');
  const hasWarning = data.core.variance.some((v) => v.level === 'warning') || data.aelf.variance.some((v) => v.level === 'warning');

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '📊 每周预算监控报告 2026-W' + weekNum },
      template: hasOver ? 'red' : hasWarning ? 'orange' : 'green'
    },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content: '数据截止: ' + data.dataCutoff } },
      { tag: 'hr' },
      { tag: 'div', text: { tag: 'lark_md', content: coreSection } },
      { tag: 'hr' },
      { tag: 'div', text: { tag: 'lark_md', content: aelfSection } },
      { tag: 'hr' },
      { tag: 'note', elements: [{ tag: 'plain_text', content: '🤖 Auto-generated by Aevatar + NyxID | Budget Monitor P2' }] }
    ]
  };
}

function summaryLine(data, ref) {
  const overCore = data.core.variance.filter((v) => v.level === 'over').length;
  const overAelf = data.aelf.variance.filter((v) => v.level === 'over').length;
  const warnCore = data.core.variance.filter((v) => v.level === 'warning').length;
  const warnAelf = data.aelf.variance.filter((v) => v.level === 'warning').length;
  return '每周预算监控报告 2026-W' + weekNumber(ref)
    + ' (数据截止 ' + (data.dataCutoff || 'n/a') + '): '
    + '超支 ' + (overCore + overAelf) + ' 项, 警告 ' + (warnCore + warnAelf) + ' 项 '
    + '(核心 ' + fmtUSD(data.core.totalActual) + '/' + fmtUSD(data.core.totalBudget) + ', '
    + 'aelf ' + fmtUSD(data.aelf.totalActual) + '/' + fmtUSD(data.aelf.totalBudget) + ').';
}

// ----- public builder --------------------------------------------------------

function buildPayload(input) {
  const data = computeData(input);
  const ref = referenceDate(input, data.dataCutoff);
  const card = buildCard(data, ref);
  const options = connectorOptions(input);

  const body = {
    msg_type: 'interactive',
    content: JSON.stringify(card)
  };
  if (options.receiveId) body.receive_id = options.receiveId;

  return {
    message_type: 'lark_interactive_message',
    message: summaryLine(data, ref),
    data: data,
    card: card,
    lark: {
      receive_id_type: options.receiveIdType,
      body: body
    }
  };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildPayload(readInput()), null, 2)}\n`);
}

module.exports = { buildPayload };
