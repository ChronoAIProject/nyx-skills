#!/usr/bin/env node
'use strict';

const fs = require('fs');

const DEFAULT_APP_TOKEN = 'BASE_APP_TOKEN_PLACEHOLDER_3';
const DEFAULT_TABLE_ID = 'TABLE_ID_PLACEHOLDER_1';
const DEFAULT_RECEIVE_ID = 'user02@example.com';
const DEFAULT_RECEIVE_ID_TYPE = 'email';

const CATEGORY_ORDER = [
  '产品发布/更新',
  '博客/研究/评论/深度报道',
  '其他（融资/社会舆论/人事变动等）'
];

const INFO_CATEGORIES = [
  '产品发布/更新',
  '行业资讯',
  '视频',
  '其他（融资/社会舆论/人事变动等）'
];

const KNOWLEDGE_CATEGORIES = [
  '博客/研究/评论/深度报道',
  '技术/经验/观点分享'
];

function readInput() {
  const text = fs.readFileSync(0, 'utf8');
  return text.trim() ? JSON.parse(text) : {};
}

function source(input) {
  return input && input.body && typeof input.body === 'object' && !Array.isArray(input.body) ? input.body : input;
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

function str(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
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
  return {
    appToken: larkIdValue(firstValue(record, ['app_token', 'appToken', 'baseAppToken', 'base_app_token']), DEFAULT_APP_TOKEN),
    tableId: larkIdValue(firstValue(record, ['table_id', 'tableId', 'baseTableId', 'base_table_id']), DEFAULT_TABLE_ID),
    receiveId: larkIdValue(firstValue(record, ['receive_id', 'receiveId', 'email', 'recipientEmail', 'recipient_email']), DEFAULT_RECEIVE_ID),
    receiveIdType: String(firstValue(record, ['receive_id_type', 'receiveIdType']) || DEFAULT_RECEIVE_ID_TYPE)
  };
}

function runDate(input) {
  const record = source(input || {});
  const value = firstValue(record, ['date', 'today', 'runDate', 'run_date', 'digestDate', 'digest_date']);
  return value === undefined ? undefined : dateOnly(value);
}

function dateOnly(value) {
  if (value === undefined || value === null || String(value).trim() === '') return '';
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    return [match[1], match[2].padStart(2, '0'), match[3].padStart(2, '0')].join('-');
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return [
    String(parsed.getFullYear()).padStart(4, '0'),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0')
  ].join('-');
}

function cleanTweetString(value) {
  return str(value).replace(/[\n\r]/g, ' ').replace(/"/g, '“');
}

function outputSource(item) {
  const record = asRecord(item) || {};
  if (record.output && typeof record.output === 'object' && !Array.isArray(record.output)) {
    return { ...record, ...record.output };
  }
  return record;
}

function normalizeItem(item, kind) {
  const record = outputSource(item);
  const data = {
    '标题': firstValue(record, ['标题', 'title', 'headline']) || '',
    '内容': firstValue(record, ['内容', 'content', 'contentSnippet', 'text', 'summary']) || '',
    '日期': firstValue(record, ['日期', 'date', 'isoDate', 'createdAt', 'created_at']) || '',
    '链接': firstValue(record, ['链接', 'link', 'url']) || '',
    '来源': firstValue(record, ['来源', 'source', 'author', 'username']) || '',
    '板块': firstValue(record, ['板块', 'section', 'bucket']) || '',
    '分类': firstValue(record, ['分类', 'category']) || '',
    '分类理由': firstValue(record, ['分类理由', 'categoryReason', 'category_reason']) || ''
  };

  if (kind === 'tweet') {
    return {
      '标题': cleanTweetString(data['标题']),
      '内容': cleanTweetString(data['内容']),
      '日期': data['日期'],
      '链接': str(data['链接']).replace(/[\n\r]/g, ''),
      '来源': cleanTweetString(data['来源']),
      '板块': cleanTweetString(data['板块']),
      '分类': cleanTweetString(data['分类']),
      '分类理由': cleanTweetString(data['分类理由'])
    };
  }

  Object.keys(data).forEach((key) => { data[key] = str(data[key]); });
  return data;
}

function arrayFrom(record, names) {
  for (const name of names) {
    const value = record ? record[name] : undefined;
    if (Array.isArray(value)) return value.map(asRecord);
  }
  return null;
}

function classifiedInputs(input) {
  const record = source(input || {});
  if (Array.isArray(record)) return { rssItems: record.map((item) => normalizeItem(item, 'rss')), tweetItems: [] };

  const rssRaw = arrayFrom(record, ['rssItems', 'rss_items', 'newsItems', 'news_items']);
  const tweetRaw = arrayFrom(record, ['tweetItems', 'tweet_items', 'twitterItems', 'twitter_items']);
  const genericRaw = arrayFrom(record, ['items', 'records', 'classifiedItems', 'classified_items']);

  if (rssRaw || tweetRaw) {
    return {
      rssItems: (rssRaw || []).map((item) => normalizeItem(item, 'rss')),
      tweetItems: (tweetRaw || []).map((item) => normalizeItem(item, 'tweet'))
    };
  }

  if (genericRaw) return { rssItems: genericRaw.map((item) => normalizeItem(item, 'rss')), tweetItems: [] };
  return null;
}

function sortByCategory(items) {
  return [...items].sort((a, b) => {
    const indexA = CATEGORY_ORDER.indexOf(a['分类'] || '');
    const indexB = CATEGORY_ORDER.indexOf(b['分类'] || '');
    return indexA - indexB;
  });
}

function getSignature(text) {
  return (text || '')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()！？。，、]/g, '')
    .replace(/\s/g, '')
    .substring(0, 30);
}

function globalDedupe(items) {
  const results = [];
  const seenTexts = new Set();
  for (const item of items) {
    const content = item['内容'] || item.text || '';
    if (!content) continue;
    const signature = getSignature(content);
    if (seenTexts.has(signature)) continue;
    seenTexts.add(signature);
    results.push(item);
  }
  return results;
}

function groupBySection(items) {
  const grouped = {};
  for (const item of items) {
    const section = item['板块'] || '其他';
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(item);
  }
  return grouped;
}

function buildInfoMarkdown(items, date) {
  const filtered = items.filter((item) => INFO_CATEGORIES.includes(item['分类']));
  const grouped = groupBySection(filtered);
  let md = `# ${date} AI资讯小报\n`;

  if (grouped['明星公司动态'] && grouped['明星公司动态'].length > 0) {
    md += '\n🌟 **明星公司动态**\n';
    const companyMap = {};
    grouped['明星公司动态'].forEach((item) => {
      const sourceName = item['来源'];
      if (!companyMap[sourceName]) companyMap[sourceName] = [];
      companyMap[sourceName].push(`- ${item['内容']}\n${item['链接']}`);
    });
    for (const [sourceName, posts] of Object.entries(companyMap)) {
      md += `\n**${sourceName}**\n${posts.join('\n')}\n`;
    }
    md += '\n---\n\n';
  }

  if (grouped['新闻'] && grouped['新闻'].length > 0) {
    md += '\n📰 **新闻汇总**\n';
    grouped['新闻'].forEach((item) => {
      md += `- 《${item['来源']}》：${item['标题']}\n ${item['内容']}\n${item['链接']}\n`;
    });
    md += '\n---\n\n';
  }

  if (grouped['大佬动态'] && grouped['大佬动态'].length > 0) {
    md += '\n🕶️ **大佬动态**\n';
    const leaderMap = {};
    grouped['大佬动态'].forEach((item) => {
      const sourceName = item['来源'];
      if (!leaderMap[sourceName]) leaderMap[sourceName] = [];
      leaderMap[sourceName].push(`- ${item['内容']}\n${item['链接']}`);
    });
    for (const [sourceName, posts] of Object.entries(leaderMap)) {
      md += `\n**${sourceName}**\n${posts.join('\n')}\n`;
    }
    md += '\n---\n\n';
  }

  if (grouped['油管博主'] && grouped['油管博主'].length > 0) {
    md += '\n🫙 **油管博主更新**\n';
    grouped['油管博主'].forEach((item) => {
      md += `- 《${item['来源']}》：${item['标题']}\n${item['链接']}\n`;
    });
    md += '\n---\n';
  }

  const hasContent = (grouped['明星公司动态']?.length || 0) + (grouped['新闻']?.length || 0) + (grouped['大佬动态']?.length || 0) + (grouped['油管博主']?.length || 0) > 0;
  if (!hasContent) md += '\n今日无资讯。\n';
  return md.trim();
}

function buildKnowledgeMarkdown(items, date) {
  const filtered = items.filter((item) => KNOWLEDGE_CATEGORIES.includes(item['分类']));
  const grouped = groupBySection(filtered);
  let md = `# ${date} AI干货小报\n`;

  if (grouped['明星公司动态'] && grouped['明星公司动态'].length > 0) {
    md += '\n🌟 **明星公司动态**\n';
    const companyMap = {};
    grouped['明星公司动态'].forEach((item) => {
      const sourceName = item['来源'];
      if (!companyMap[sourceName]) companyMap[sourceName] = [];
      companyMap[sourceName].push(`- ${item['内容']}\n${item['链接']}`);
    });
    for (const [sourceName, posts] of Object.entries(companyMap)) {
      md += `\n**${sourceName}**\n${posts.join('\n')}\n`;
    }
    md += '\n---\n\n';
  }

  if (grouped['大佬动态'] && grouped['大佬动态'].length > 0) {
    md += '\n🕶️ **大佬动态**\n';
    const leaderMap = {};
    grouped['大佬动态'].forEach((item) => {
      const sourceName = item['来源'];
      if (!leaderMap[sourceName]) leaderMap[sourceName] = [];
      leaderMap[sourceName].push(`- ${item['内容']}\n${item['链接']}`);
    });
    for (const [sourceName, posts] of Object.entries(leaderMap)) {
      md += `\n**${sourceName}**\n${posts.join('\n')}\n`;
    }
    md += '\n---\n\n';
  }

  if (grouped['新闻'] && grouped['新闻'].length > 0) {
    md += '\n📰 **新闻汇总**\n';
    grouped['新闻'].forEach((item) => {
      md += `- 《${item['来源']}》：${item['标题']}\n ${item['内容']}\n${item['链接']}\n`;
    });
    md += '\n---\n';
  }

  const hasContent = (grouped['明星公司动态']?.length || 0) + (grouped['大佬动态']?.length || 0) + (grouped['新闻']?.length || 0) > 0;
  if (!hasContent) md += '\n今日无精选干货。\n';
  return md.trim();
}

function top10Input(input) {
  const record = source(input || {});
  const value = firstValue(record, ['top10', 'twitterTop10', 'twitter_top10', 'top10Output', 'top10_output', 'aiTop10', 'ai_top10', 'output', 'text', 'result', 'message']);
  return value;
}

function parseTop10(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    if (Array.isArray(value.output)) return value.output;
    return [];
  }
  let text = value === undefined || value === null ? '' : String(value);
  let top10 = [];
  try {
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = codeBlock ? codeBlock[1].trim() : text;
    const arrStart = raw.indexOf('[');
    const arrEnd = raw.lastIndexOf(']');
    if (arrStart >= 0 && arrEnd > arrStart) {
      top10 = JSON.parse(raw.substring(arrStart, arrEnd + 1));
    }
  } catch (_) {
    try {
      const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (match) top10 = JSON.parse(match[0]);
    } catch (_) {}
  }
  return Array.isArray(top10) ? top10 : [];
}

function buildTwitterValueMarkdown(input, date) {
  const top10 = parseTop10(top10Input(input));
  if (!Array.isArray(top10) || top10.length === 0) {
    return '# 推特价值小报\n\n今日暂无精选内容。';
  }

  let md = `# ${date} 推特价值小报\n\n> 从推文中精选最有价值的 10 条\n\n`;
  top10.forEach((item, index) => {
    const title = str(item['标题'] || item['内容'] || '').substring(0, 60);
    const content = str(item['内容'] || '').substring(0, 150);
    const sourceName = str(item['来源'] || '');
    const link = str(item['链接'] || '');
    const reason = str(item['推荐理由'] || '');
    md += `## ${index + 1}. ${title}\n\n`;
    if (content) md += `${content}${content.length >= 150 ? '...' : ''}\n\n`;
    if (reason) md += `💡 **推荐理由**：${reason}\n\n`;
    if (sourceName) md += `**来源**：${sourceName}  `;
    if (link) md += `|[原文](${link})\n\n`;
    md += '---\n\n';
  });
  return md.trim();
}

function cardFromMarkdown(markdown) {
  return {
    elements: [
      {
        tag: 'markdown',
        content: markdown
      }
    ]
  };
}

function sendMessageRequest(card, options) {
  return {
    resource: 'message',
    operation: 'send',
    receive_id_type: options.receiveIdType,
    receive_id: options.receiveId,
    msg_type: 'interactive',
    content: JSON.stringify(card),
    options: {}
  };
}

function recordFields(item, fallbackDate) {
  return {
    '标题': str(item['标题']),
    '内容': str(item['内容']),
    '日期': dateOnly(item['日期']) || fallbackDate,
    '链接': {
      text: '原文链接',
      link: str(item['链接']).replace(/\n/g, '')
    },
    '来源': str(item['来源']),
    '板块': str(item['板块']),
    '分类': str(item['分类']),
    '分类理由': str(item['分类理由'] || '')
  };
}

function createRecordRequest(fields, options) {
  return {
    resource: 'base',
    operation: 'createRecord',
    app_token: resourceLocator(options.appToken),
    table_id: resourceLocator(options.tableId),
    body: { fields },
    options: {
      ignore_consistency_check: true
    }
  };
}

function buildRecords(input) {
  const classified = classifiedInputs(input);
  if (!classified) return { needs_more_information: true, missing: ['items'] };

  const options = connectorOptions(input);
  const fallbackDate = runDate(input);
  const rssItems = sortByCategory(classified.rssItems);
  const tweetItems = sortByCategory(classified.tweetItems);
  const recordItems = [...rssItems, ...tweetItems];

  const missing = [];
  if (recordItems.some((item) => !dateOnly(item['日期'])) && !fallbackDate) missing.push('date');
  if (missing.length) return { needs_more_information: true, missing };

  const records = recordItems.map((item) => ({ fields: recordFields(item, fallbackDate) }));
  const createRecordRequests = records.map((record) => createRecordRequest(record.fields, options));
  if (!records.length) {
    return {
      skip: true,
      reason: 'no tech digest items',
      records: [],
      lark: { createRecordRequests: [] }
    };
  }

  return {
    message_type: 'lark_base_records',
    records,
    lark: { createRecordRequests }
  };
}

function messageItems(input) {
  const classified = classifiedInputs(input);
  if (!classified) return null;
  const rssItems = sortByCategory(classified.rssItems);
  const tweetItems = sortByCategory(classified.tweetItems);
  return globalDedupe([...rssItems, ...tweetItems]);
}

function buildMessages(input) {
  const items = messageItems(input);
  if (!items) return { needs_more_information: true, missing: ['items'] };
  const date = runDate(input);
  if (!date) return { needs_more_information: true, missing: ['date'] };

  const options = connectorOptions(input);
  const infoMarkdown = buildInfoMarkdown(items, date);
  const knowledgeMarkdown = buildKnowledgeMarkdown(items, date);
  const twitterValueMarkdown = buildTwitterValueMarkdown(input, date);
  const infoCard = cardFromMarkdown(infoMarkdown);
  const knowledgeCard = cardFromMarkdown(knowledgeMarkdown);
  const twitterValueCard = cardFromMarkdown(twitterValueMarkdown);

  const messages = [
    {
      name: 'AI资讯小报',
      workflowNode: 'Send message',
      markdown: infoMarkdown,
      card: infoCard,
      lark_card: JSON.stringify(infoCard)
    },
    {
      name: 'AI干货小报',
      workflowNode: 'Send message1',
      markdown: knowledgeMarkdown,
      card: knowledgeCard,
      lark_card: JSON.stringify(knowledgeCard)
    },
    {
      name: '推特价值小报',
      workflowNode: 'Send message 推特价值',
      markdown: twitterValueMarkdown,
      card: twitterValueCard,
      lark_card: JSON.stringify(twitterValueCard)
    }
  ];

  return {
    message_type: 'lark_interactive_messages',
    messages,
    lark: {
      sendMessages: messages.map((message) => sendMessageRequest(message.card, options))
    }
  };
}

function buildAll(input) {
  const recordResult = buildRecords(input);
  if (recordResult.needs_more_information || recordResult.skip) return recordResult;

  const messageResult = buildMessages(input);
  if (messageResult.needs_more_information) return messageResult;

  return {
    message_type: 'tech_digest_lark_payloads',
    records: recordResult.records,
    messages: messageResult.messages,
    lark: {
      createRecordRequests: recordResult.lark.createRecordRequests,
      sendMessages: messageResult.lark.sendMessages
    }
  };
}

function buildPayload(input) {
  const record = source(input || {});
  const mode = String(record.mode || 'build_all');
  if (mode === 'build_records' || mode === 'records' || mode === 'base_records') return buildRecords(record);
  if (mode === 'build_messages' || mode === 'messages' || mode === 'digest') return buildMessages(record);
  return buildAll(record);
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildPayload(readInput()), null, 2)}\n`);
}

module.exports = { buildPayload };
