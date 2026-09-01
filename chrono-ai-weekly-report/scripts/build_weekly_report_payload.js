#!/usr/bin/env node
'use strict';

// Pure, deterministic formatter for the chrono-ai-weekly-report skill.
// Input: the analyzed `report` JSON the agent already produced from GitHub data.
// Output: a Lark interactive card (hyperlinked, table-like) + a markdown fallback.
// No network, no tokens, no clock — every date/number is passed in as input.

const fs = require('fs');

function readInput() {
  const text = fs.readFileSync(0, 'utf8');
  return text.trim() ? JSON.parse(text) : {};
}

function source(input) {
  if (input && input.report && typeof input.report === 'object' && !Array.isArray(input.report)) return input.report;
  if (input && input.body && typeof input.body === 'object' && !Array.isArray(input.body)) return input.body;
  return input && typeof input === 'object' ? input : {};
}

function str(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function firstValue(rec, names) {
  for (const n of names) {
    const v = rec ? rec[n] : undefined;
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function commaNum(v) {
  return num(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const STATUS = {
  merged:  { emoji: '🟢', label: 'merged',  template: 'green' },
  open:    { emoji: '🔵', label: 'open',    template: 'blue' },
  review:  { emoji: '🟡', label: 'review',  template: 'yellow' },
  draft:   { emoji: '⚪️', label: 'draft',   template: 'grey' },
  blocked: { emoji: '🔴', label: 'blocked', template: 'red' },
  closed:  { emoji: '⚫️', label: 'closed',  template: 'grey' }
};

function statusOf(item) {
  const raw = str(firstValue(item, ['status', 'state'])).toLowerCase();
  if (STATUS[raw]) return STATUS[raw];
  if (item && item.merged === true) return STATUS.merged;
  if (item && item.draft === true) return STATUS.draft;
  return STATUS.open;
}

function itemLabel(item) {
  const n = firstValue(item, ['number', 'num', 'id']);
  const title = str(firstValue(item, ['title', 'name']) || '');
  return n !== undefined && n !== '' ? `#${n} ${title}`.trim() : title;
}

function itemUrl(item) {
  return str(firstValue(item, ['url', 'html_url', 'link']) || '');
}

function itemLink(item) {
  const label = itemLabel(item).replace(/\]/g, '】').replace(/\[/g, '【');
  const url = itemUrl(item);
  return url ? `[${label}](${url})` : label;
}

function scopeOf(item) {
  return str(firstValue(item, ['scope', 'note', 'branch', 'where']) || '');
}

// Normalize the list of sections from many possible input shapes.
function normalizeSections(rec) {
  const out = [];
  if (Array.isArray(rec.sections)) {
    rec.sections.forEach((s) => {
      const items = Array.isArray(s.items) ? s.items : [];
      out.push({ key: str(s.key || s.title), title: str(s.title || s.key), items });
    });
    return out.filter((s) => s.items.length);
  }
  const map = [
    ['features', 'Feature'],
    ['feature', 'Feature'],
    ['refactors', 'Refactor'],
    ['refactor', 'Refactor'],
    ['fixes', 'Fix / Test / Chore'],
    ['support', 'Fix / Test / Chore']
  ];
  map.forEach(([k, title]) => {
    if (Array.isArray(rec[k]) && rec[k].length) out.push({ key: k, title, items: rec[k] });
  });
  return out;
}

function countByStatus(sections) {
  const c = { merged: 0, open: 0, review: 0, draft: 0, blocked: 0, closed: 0, total: 0 };
  sections.forEach((s) => s.items.forEach((it) => {
    const label = statusOf(it).label;
    if (c[label] !== undefined) c[label] += 1;
    c.total += 1;
  }));
  return c;
}

// ---- Lark interactive card ----------------------------------------------

function divMd(content) {
  return { tag: 'div', text: { tag: 'lark_md', content: content } };
}

function metricsBlock(metrics, counts) {
  const cells = [
    ['净改动', `+${commaNum(metrics.additions)} / -${commaNum(metrics.deletions)}`],
    ['文件', commaNum(metrics.changed_files)],
    ['工作项', String(counts.total)],
    ['返工', commaNum(metrics.rework_commits)]
  ];
  const columns = cells.map(([label, value]) => ({
    tag: 'column',
    width: 'weighted',
    weight: 1,
    vertical_align: 'top',
    elements: [divMd(`**${label}**`), divMd(value)]
  }));
  return { tag: 'column_set', flex_mode: 'stretch', background_style: 'grey', horizontal_spacing: 'default', columns: columns };
}

function itemRow(item) {
  const st = statusOf(item);
  const scope = scopeOf(item);
  const right = scope ? `${st.emoji} ${st.label} · ${scope}` : `${st.emoji} ${st.label}`;
  return {
    tag: 'column_set',
    flex_mode: 'none',
    horizontal_spacing: 'default',
    columns: [
      { tag: 'column', width: 'weighted', weight: 5, vertical_align: 'top', elements: [divMd(itemLink(item))] },
      { tag: 'column', width: 'weighted', weight: 2, vertical_align: 'top', elements: [divMd(right)] }
    ]
  };
}

function buildCard(rec, sections, metrics, counts, blockers) {
  const account = str(firstValue(rec, ['account', 'login', 'username']) || 'GitHub');
  const window = rec.window || {};
  const windowLabel = str(window.label || (window.start && window.end ? `${window.start} → ${window.end}` : ''));
  const headline = str(firstValue(rec, ['headline', 'summary', 'mainline']) || '');

  const elements = [];
  elements.push(divMd(
    `📊 **${account} 本周 GitHub 周报**` + (windowLabel ? `  ·  ${windowLabel}` : '') +
    `\n合并 ${counts.merged} · 进行 ${counts.open} · review ${counts.review} · 卡点 ${counts.blocked + blockers.length}`
  ));
  if (headline) { elements.push({ tag: 'hr' }); elements.push(divMd(`**主线**\n${headline}`)); }
  elements.push({ tag: 'hr' });
  elements.push(metricsBlock(metrics, counts));

  sections.forEach((s) => {
    elements.push({ tag: 'hr' });
    elements.push(divMd(`**${s.title}**  ·  ${s.items.length}`));
    s.items.forEach((it) => elements.push(itemRow(it)));
  });

  if (blockers.length) {
    elements.push({ tag: 'hr' });
    elements.push(divMd('⚠️ **卡点**'));
    blockers.forEach((b) => {
      const title = firstValue(b, ['title', 'name']);
      const url = itemUrl(b);
      const head = url ? `[${str(title).replace(/[[\]]/g, '')}](${url})` : str(title);
      const why = str(firstValue(b, ['why', 'reason']) || '');
      const cost = str(firstValue(b, ['cost', 'impact']) || '');
      let content = `🔴 ${head}`;
      if (why) content += `\n· ${why}`;
      if (cost) content += `\n· 代价：${cost}`;
      elements.push(divMd(content));
    });
  }

  return {
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      template: blockers.length ? 'red' : 'blue',
      title: { tag: 'plain_text', content: `${account} · 本周工作周报` }
    },
    elements: elements
  };
}

// ---- Markdown fallback ---------------------------------------------------

function buildMarkdown(rec, sections, metrics, counts, blockers) {
  const account = str(firstValue(rec, ['account', 'login', 'username']) || 'GitHub');
  const window = rec.window || {};
  const windowLabel = str(window.label || (window.start && window.end ? `${window.start} → ${window.end}` : ''));
  const headline = str(firstValue(rec, ['headline', 'summary', 'mainline']) || '');
  const lines = [];
  lines.push(`# ${account} 本周 GitHub 周报${windowLabel ? ` · ${windowLabel}` : ''}`);
  lines.push('');
  lines.push(`净改动 +${commaNum(metrics.additions)} / -${commaNum(metrics.deletions)} · ${commaNum(metrics.changed_files)} 文件 · ${counts.total} 工作项 · ${commaNum(metrics.rework_commits)} 返工 · 合并 ${counts.merged} / 进行 ${counts.open} / review ${counts.review} / 卡点 ${counts.blocked + blockers.length}`);
  if (headline) { lines.push(''); lines.push(`**主线**：${headline}`); }
  sections.forEach((s) => {
    lines.push('');
    lines.push(`## ${s.title}（${s.items.length}）`);
    s.items.forEach((it) => {
      const st = statusOf(it);
      const scope = scopeOf(it);
      lines.push(`- ${st.emoji} ${itemLink(it)}${scope ? ` · ${scope}` : ''}`);
    });
  });
  if (blockers.length) {
    lines.push('');
    lines.push('## ⚠️ 卡点');
    blockers.forEach((b) => {
      const title = firstValue(b, ['title', 'name']);
      const url = itemUrl(b);
      const head = url ? `[${str(title)}](${url})` : str(title);
      const why = str(firstValue(b, ['why', 'reason']) || '');
      const cost = str(firstValue(b, ['cost', 'impact']) || '');
      lines.push(`- 🔴 ${head}${why ? ` — ${why}` : ''}${cost ? `（代价：${cost}）` : ''}`);
    });
  }
  return lines.join('\n');
}

// ---- main ----------------------------------------------------------------

function main() {
  const input = readInput();
  const rec = source(input);

  const sections = normalizeSections(rec);
  if (!sections.length && !rec.headline && !rec.metrics) {
    process.stdout.write(JSON.stringify({
      needs_more_information: true,
      missing: ['report'],
      hint: 'Provide the analyzed report: { account, window:{start,end,label}, headline, metrics:{additions,deletions,changed_files,rework_commits}, sections:[{title,items:[{number,title,url,status,scope}]}], blockers:[{title,url,why,cost}] }'
    }));
    return;
  }

  const metrics = rec.metrics && typeof rec.metrics === 'object' ? rec.metrics : {};
  const counts = countByStatus(sections);
  const blockers = Array.isArray(rec.blockers) ? rec.blockers : [];

  const card = buildCard(rec, sections, metrics, counts, blockers);
  const markdown = buildMarkdown(rec, sections, metrics, counts, blockers);

  const lark = rec.lark && typeof rec.lark === 'object' ? rec.lark : {};
  const receiveId = str(firstValue(lark, ['chat_id', 'receive_id', 'open_id', 'union_id', 'user_id']) ||
                        firstValue(rec, ['chat_id', 'receive_id']) || '');
  const receiveIdType = str(firstValue(lark, ['receive_id_type']) || 'chat_id');

  const out = {
    message_type: 'weekly_report',
    counts: counts,
    markdown: markdown,
    lark: {
      method: 'POST',
      path: '/open-apis/im/v1/messages',
      query: `?receive_id_type=${receiveIdType}`,
      card: card,
      body: {
        receive_id: receiveId,
        msg_type: 'interactive',
        content: JSON.stringify(card)
      }
    }
  };
  if (!receiveId) out.lark.note = 'receive_id empty — agent must fill chat_id from Lark runtime context before sending';
  process.stdout.write(JSON.stringify(out));
}

main();
