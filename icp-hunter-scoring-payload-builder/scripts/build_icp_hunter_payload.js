#!/usr/bin/env node
'use strict';

const fs = require('fs');

const DEFAULT_APP_TOKEN = 'BASE_APP_TOKEN_PLACEHOLDER_2';
const DEFAULT_TABLE_ID = 'TABLE_ID_PLACEHOLDER_3';
const DEFAULT_RECEIVE_ID = 'oc_PLACEHOLDER_CHAT_ID_1';
const DEFAULT_BASE_VIEW_URL = 'https://aelfblockchain.sg.larksuite.com/base/BASE_APP_TOKEN_PLACEHOLDER_2?table=TABLE_ID_PLACEHOLDER_3&view=vewTOJLNna';

const VALID_ACTIONS = new Set([
  '高触达一对一邀请',
  '先观察 + 轻量互动',
  '暂存观察',
  'Path A long-term watch',
  'follow up 已超期 · 维持 attribution',
  'SKIP · stale + 低 ROI · cron 老 backlog',
  'SKIP · placeholder · 数据异常',
  'SKIP · 永久不外联',
  '不录入'
]);

const VALID_CHANNELS = new Set([
  'Reddit DM',
  'Reddit',
  'X DM',
  'X',
  'n8n Forum',
  'HA Forum',
  'GitHub',
  'Email',
  'Other'
]);

const CHANNEL_ALIAS = {
  'n8n Forum DM': 'n8n Forum',
  'n8n Community': 'n8n Forum',
  'n8n Community Forum': 'n8n Forum',
  'HA Forum DM': 'HA Forum',
  'HA Community Forum': 'HA Forum',
  'Home Assistant Community': 'HA Forum',
  'MCP Community DM': 'Other',
  'MCP Community': 'Other',
  'Forum 私信': 'Other',
  'GitHub Issue': 'GitHub',
  DM: 'Other'
};

const VALID_COHORTS = new Set(['A', 'B', 'A+B', 'partner', 'unknown']);
const STATUS_MAP = { P0: '待外联', P1: '观察中', P2: '暂存' };

function readInput() {
  const text = fs.readFileSync(0, 'utf8');
  return text.trim() ? JSON.parse(text) : {};
}

function source(input) {
  return input && input.body && typeof input.body === 'object' ? input.body : input;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function firstValue(record, names) {
  for (const name of names) {
    const value = record ? record[name] : undefined;
    if (hasValue(value)) return value;
  }
  return undefined;
}

function stringValue(value) {
  return hasValue(value) ? String(value).trim() : '';
}

function numberValue(value, fallback) {
  if (!hasValue(value)) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeChannel(ch) {
  if (!ch) return 'Other';
  const c = String(ch).toLowerCase().trim();
  if (c.includes('reddit')) return 'Reddit DM';
  if (c === 'x' || c.includes('x dm') || c.includes('twitter') || c.includes('x/twitter')) return 'X DM';
  if (c.includes('n8n')) return 'n8n Forum DM';
  if (c.includes('home assistant') || c.includes('ha forum') || c.includes('homeassistant')) return 'HA Forum DM';
  if (c.includes('mcp')) return 'MCP Community DM';
  if (c.includes('github')) return 'GitHub';
  return 'Other';
}

function normalizeChannelV72(raw) {
  const value = stringValue(raw);
  if (!value) return 'Other';
  return CHANNEL_ALIAS[value] || value;
}

function safeAction(value, fallback) {
  const chosen = hasValue(value) ? String(value) : '';
  return VALID_ACTIONS.has(chosen) ? chosen : (fallback || '暂存观察');
}

function safeChannel(value, fallback) {
  const chosen = hasValue(value) ? String(value) : '';
  return VALID_CHANNELS.has(chosen) ? chosen : (fallback || 'Other');
}

function safeCohort(value) {
  const chosen = hasValue(value) ? String(value) : '';
  if (!chosen) return 'unknown';
  return VALID_COHORTS.has(chosen) ? chosen : 'unknown';
}

function cleanUsername(name) {
  if (!name) return '';
  let s = String(name).toLowerCase();
  for (let i = 0; i < 3; i++) {
    s = s.replace(/\s*[\(\[][^)\]]*[\)\]]\s*$/, '');
  }
  s = s.replace(/['\u2019]s\s+account\s*$/, '').replace(/\s+(op|author|reply)\s*$/, '');
  return s.replace(/[^a-z0-9_]/g, '');
}

function aggressiveNormalize(name) {
  if (!name) return '';
  let s = String(name).toLowerCase().trim();
  s = s.replace(/[\s·\-—_|]+(op|original\s+poster|author|reply|reddit\s+user|ha\s+user|n8n\s+user|forum\s+user|community\s+user)\s*$/, '');
  for (let i = 0; i < 3; i++) {
    s = s.replace(/\s*[\(\[\{][^)\]\}]*[\)\]\}]\s*$/, '');
  }
  s = s.replace(/\s*[·\-—|]\s+.*$/, '');
  s = s.replace(/['’]s\s+account\s*$/, '');
  s = s.replace(/\s+(op|author|reply)\s*$/, '');
  return s.replace(/[^a-z0-9_]/g, '');
}

function normalizeUrl(url) {
  if (!url) return '';
  const raw = String(url).trim();
  try {
    const parsed = new URL(raw);
    let path = parsed.pathname;
    const redditMatch = path.match(/^(\/r\/[^\/]+\/comments\/[a-z0-9]+)/i);
    if (redditMatch) path = redditMatch[1];
    return (parsed.origin + path).replace(/\/+$/, '').toLowerCase();
  } catch (_) {
    return raw.replace(/\?.*$/, '').replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();
  }
}

function readText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value.map((x) => (x && (x.text != null ? x.text : x.link)) || '').filter(Boolean).join(' ');
  }
  if (typeof value === 'object') return value.text || value.link || '';
  return String(value);
}

function readLink(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    const linked = value.find((x) => x && x.link);
    if (linked) return linked.link;
    const text = value.find((x) => x && x.text);
    return text ? text.text : '';
  }
  if (typeof value === 'object') return value.link || value.text || '';
  return String(value);
}

function flattenExistingRecords(records) {
  const input = Array.isArray(records) ? records : [];
  const flattened = [];
  for (const record of input) {
    const root = record && record.json !== undefined ? record.json : record;
    if (!root) continue;
    if (Array.isArray(root.items)) {
      flattened.push(...root.items);
    } else if (Array.isArray(root.records)) {
      flattened.push(...root.records);
    } else {
      flattened.push(root);
    }
  }
  return flattened;
}

function existingRecordSets(records) {
  const existingEvidence = new Set();
  const existingUserPlatform = new Set();
  const existingProfile = new Set();
  const existingNormalizedUrl = new Set();
  const existingUserKey = new Set();

  for (const record of flattenExistingRecords(records)) {
    const fields = record.fields || record;
    const evidenceNorm = normalizeUrl(readLink(fields['证据链接']));
    if (evidenceNorm) existingEvidence.add(evidenceNorm);

    const storedUserKey = readText(fields['用户标识']).toLowerCase().trim();
    if (storedUserKey && storedUserKey !== '@') existingUserKey.add(storedUserKey);

    const userId = aggressiveNormalize(readText(fields['用户ID']));
    const platform = readText(fields['平台']).toLowerCase().trim();
    if (userId && platform) existingUserPlatform.add(`${userId}@${platform}`);

    const storedNormUrl = readText(fields['规范化URL']).toLowerCase().trim();
    if (storedNormUrl) existingNormalizedUrl.add(storedNormUrl);

    const profileNorm = normalizeUrl(readLink(fields['Profile 链接']));
    if (profileNorm) existingProfile.add(profileNorm);
  }

  return {
    existingEvidence,
    existingUserPlatform,
    existingProfile,
    existingNormalizedUrl,
    existingUserKey
  };
}

function normalizeUser(raw, defaults) {
  const user = raw || {};
  const icpFitScore = numberValue(firstValue(user, ['icp_fit_score', 'icpFitScore']), undefined);
  const totalScore = numberValue(firstValue(user, ['total_score', 'totalScore', 'score']), undefined);
  const wedgeScore = numberValue(firstValue(user, ['evidence_wedge_fit_score', 'evidenceWedgeFitScore', 'wedgeFitScore']), undefined);

  return {
    ...user,
    username: stringValue(firstValue(user, ['username', 'userName', 'user_id', 'userId', '用户ID'])),
    priority: stringValue(firstValue(user, ['priority', '优先级'])),
    cohort: stringValue(firstValue(user, ['cohort', 'Cohort'])),
    platform: stringValue(firstValue(user, ['platform', '平台'])),
    profile_url: stringValue(firstValue(user, ['profile_url', 'profileUrl', 'profile', 'Profile 链接'])),
    evidence_url: stringValue(firstValue(user, ['evidence_url', 'evidenceUrl', 'url', '证据链接'])),
    icp_fit_score: icpFitScore,
    total_score: totalScore,
    evidence_wedge_fit_score: wedgeScore,
    score_breakdown: stringValue(firstValue(user, ['score_breakdown', 'scoreBreakdown', '积分明细'])),
    contact_channel: stringValue(firstValue(user, ['contact_channel', 'contactChannel', '联系渠道'])),
    language_timezone: stringValue(firstValue(user, ['language_timezone', 'languageTimezone', '语言/时区'])),
    raw_evidence: stringValue(firstValue(user, ['raw_evidence', 'rawEvidence', '原始证据'])),
    recommended_action: stringValue(firstValue(user, ['recommended_action', 'recommendedAction', '推荐动作'])),
    week_tag: stringValue(firstValue(user, ['week_tag', 'weekTag', '周标签']) || defaults.weekTag),
    batch_id: stringValue(firstValue(user, ['batch_id', 'batchId', '筛选批次']) || defaults.batchId),
    thread_role: stringValue(firstValue(user, ['thread_role', 'threadRole'])),
    post_created_date: firstValue(user, ['post_created_date', 'postCreatedDate', '帖子发布日期']),
    outreach_draft: stringValue(firstValue(user, ['outreach_draft', 'outreachDraft', 'outreach draft'])),
    _watch_demote: firstValue(user, ['_watch_demote', 'watchDemote']) === true
  };
}

function scoreFor(user) {
  if (typeof user.icp_fit_score === 'number') return user.icp_fit_score;
  if (typeof user.total_score === 'number') return user.total_score;
  return 0;
}

function dateToMillis(value) {
  if (!hasValue(value)) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return Number(text);
  const parseText = text.includes('T') ? text : `${text}T00:00:00Z`;
  const ms = Date.parse(parseText);
  return Number.isFinite(ms) ? ms : null;
}

function dedupeUsers(users, existingRecords, defaults) {
  const sets = existingRecordSets(existingRecords);
  const batchSeenEvidence = new Set();
  const batchSeenUser = new Set();
  const batchSeenProfile = new Set();
  const deduped = [];
  let droppedVsLark = 0;
  let droppedInBatch = 0;

  for (const raw of users) {
    const user = normalizeUser(raw, defaults);
    const evidenceNorm = normalizeUrl(user.evidence_url);
    const userKey = `${aggressiveNormalize(user.username)}@${(user.platform || '').toLowerCase().trim()}`;
    const profileNorm = normalizeUrl(user.profile_url);

    const isDupeVsLark =
      (evidenceNorm && sets.existingEvidence.has(evidenceNorm)) ||
      (evidenceNorm && sets.existingNormalizedUrl.has(evidenceNorm)) ||
      (userKey !== '@' && sets.existingUserPlatform.has(userKey)) ||
      (userKey !== '@' && sets.existingUserKey.has(userKey)) ||
      (profileNorm && sets.existingProfile.has(profileNorm));

    const isDupeInBatch =
      (evidenceNorm && batchSeenEvidence.has(evidenceNorm)) ||
      (userKey !== '@' && batchSeenUser.has(userKey)) ||
      (profileNorm && batchSeenProfile.has(profileNorm));

    if (isDupeVsLark) {
      droppedVsLark++;
      continue;
    }
    if (isDupeInBatch) {
      droppedInBatch++;
      continue;
    }

    deduped.push(user);
    if (evidenceNorm) {
      sets.existingEvidence.add(evidenceNorm);
      batchSeenEvidence.add(evidenceNorm);
    }
    if (userKey !== '@') {
      sets.existingUserPlatform.add(userKey);
      batchSeenUser.add(userKey);
    }
    if (profileNorm) {
      sets.existingProfile.add(profileNorm);
      batchSeenProfile.add(profileNorm);
    }
  }

  return { users: deduped, droppedVsLark, droppedInBatch };
}

function mapUsersToRecords(users, options) {
  const output = [];
  const missing = new Set();
  const seenInBatch = new Set();
  let droppedIncomplete = 0;
  let droppedMapDuplicate = 0;

  users.forEach((user, index) => {
    const dedupKey = `${(user.username || '').toLowerCase().replace(/[^a-z0-9_]/g, '')}@${(user.platform || '').toLowerCase().trim()}`;
    const urlKey2 = (user.evidence_url || '').toLowerCase().split('?')[0].split('#')[0].replace(/\/+$/, '');
    if (dedupKey !== '@' && seenInBatch.has(dedupKey)) {
      droppedMapDuplicate++;
      return;
    }
    if (urlKey2 && seenInBatch.has(`url:${urlKey2}`)) {
      droppedMapDuplicate++;
      return;
    }
    if (dedupKey !== '@') seenInBatch.add(dedupKey);
    if (urlKey2) seenInBatch.add(`url:${urlKey2}`);

    const score = scoreFor(user);
    if (!user.username || !user.priority || score < 3) {
      droppedIncomplete++;
      return;
    }

    const postSource = hasValue(user.post_created_date) ? user.post_created_date : options.fallbackPostDate;
    const postDateMs = dateToMillis(postSource);
    if (postDateMs === null) {
      missing.add(`users[${index}].postCreatedDate`);
      return;
    }

    const userKey = user.username ? `${cleanUsername(user.username)}@${(user.platform || '').toLowerCase().trim()}` : '';
    const urlKey = normalizeUrl(user.evidence_url);
    const fields = {
      '用户ID': user.username || '',
      '优先级': user.priority || 'P2',
      Cohort: safeCohort(user.cohort),
      '当前状态': STATUS_MAP[user.priority] || '暂存',
      '平台': user.platform || '',
      'Profile 链接': user.profile_url ? { link: user.profile_url, text: user.profile_url } : undefined,
      '证据链接': user.evidence_url ? { link: user.evidence_url, text: user.evidence_url } : undefined,
      '总分': score,
      '积分明细': (user.score_breakdown || '') + (
        typeof user.evidence_wedge_fit_score === 'number'
          ? ` | wedge fit ${user.evidence_wedge_fit_score}/5${user._watch_demote ? ' (watch demote · long-term 观察)' : ''}`
          : ''
      ),
      '联系渠道': safeChannel(normalizeChannelV72(normalizeChannel(user.contact_channel)), 'Other'),
      '语言/时区': user.language_timezone || '',
      '原始证据': user.raw_evidence || '',
      '推荐动作': safeAction(user.recommended_action, '暂存观察'),
      '升温状态': '冷',
      '周标签': user.week_tag || '',
      '筛选批次': user.batch_id || '',
      thread_role: user.thread_role || 'OP',
      '帖子发布日期': postDateMs,
      '用户标识': userKey && userKey !== '@' ? userKey : undefined,
      '规范化URL': urlKey || undefined,
      '备注': 'API: NyxID Proxy'
    };

    if (user.outreach_draft) fields['outreach draft'] = user.outreach_draft;
    Object.keys(fields).forEach((key) => fields[key] === undefined && delete fields[key]);
    output.push({ fields });
  });

  return {
    records: output,
    missing: Array.from(missing),
    droppedIncomplete,
    droppedMapDuplicate
  };
}

function recordPayload(record, input) {
  const appToken = stringValue(firstValue(input, ['appToken', 'app_token'])) || DEFAULT_APP_TOKEN;
  const tableId = stringValue(firstValue(input, ['tableId', 'table_id'])) || DEFAULT_TABLE_ID;
  return {
    resource: 'base',
    operation: 'createRecord',
    app_token: { __rl: true, value: appToken, mode: 'id' },
    table_id: { __rl: true, value: tableId, mode: 'id' },
    body: { fields: record.fields },
    options: {}
  };
}

function buildStats(records, runTime) {
  const stats = {
    total_written: records.length,
    p0_count: 0,
    p1_count: 0,
    p2_count: 0,
    platforms: {},
    api_layer: 'NyxID Proxy',
    run_time: String(runTime)
  };

  for (const record of records) {
    const fields = record.fields || record;
    const priority = fields['优先级'] || fields.priority || '';
    const platform = fields['平台'] || fields.platform || 'unknown';
    if (priority === 'P0') stats.p0_count++;
    else if (priority === 'P1') stats.p1_count++;
    else if (priority === 'P2') stats.p2_count++;
    stats.platforms[platform] = (stats.platforms[platform] || 0) + 1;
    const draft = fields['outreach draft'] || '';
    if (draft && !String(draft).startsWith('[') && String(draft).length > 10) {
      stats.outreach_count = (stats.outreach_count || 0) + 1;
    }
  }

  const platformText = Object.entries(stats.platforms).map(([key, value]) => `${key}: ${value}`).join(' | ');
  stats.outreach_count = stats.outreach_count || 0;
  stats.summary = `[NyxID ICP Hunter] 写入 ${stats.total_written} 条: P0=${stats.p0_count} (${stats.outreach_count} drafted), P1=${stats.p1_count}, P2=${stats.p2_count}`;
  stats.lark_card = JSON.stringify({
    header: {
      title: {
        tag: 'plain_text',
        content: '🎯 NyxID ICP Hunter 运行报告'
      },
      template: 'blue'
    },
    elements: [
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**📊 新增总数**\n${stats.total_written} 条`
            }
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**📅 运行时间**\n${stats.run_time.slice(0, 19).replace('T', ' ')}`
            }
          }
        ]
      },
      { tag: 'hr' },
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**🔴 P0 高触达**\n${stats.p0_count} 人 (${stats.outreach_count} drafted)`
            }
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**🟡 P1 轻量互动**\n${stats.p1_count} 人`
            }
          }
        ]
      },
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**🟢 P2 暂存观察**\n${stats.p2_count} 人`
            }
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**📍 平台分布**\n${platformText}`
            }
          }
        ]
      },
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '📋 打开 NyxID ICP Hunter CRM 表'
            },
            url: DEFAULT_BASE_VIEW_URL,
            type: 'primary'
          }
        ]
      }
    ]
  });
  return stats;
}

function sendMessagePayload(stats, input) {
  const receiveId = stringValue(firstValue(input, ['receiveId', 'receive_id', 'chatId', 'chat_id'])) || DEFAULT_RECEIVE_ID;
  return {
    resource: 'message',
    operation: 'send',
    receive_id_type: 'chat_id',
    receive_id: { __rl: true, value: receiveId, mode: 'id' },
    msg_type: 'interactive',
    content: stats.lark_card,
    options: {}
  };
}

function extractScoringContent(input) {
  const item = input.scoringResponse || input.geminiResponse || input.response || input;
  if (item.candidates && item.candidates[0]) return item.candidates[0].content.parts[0].text || '';
  if (item.choices && item.choices[0]) return item.choices[0].message.content || '';
  if (item.content && item.content[0]) return item.content[0].text || '';
  return '';
}

function isPlaceholder(handle) {
  const patterns = [
    /^user\d+_/i,
    /^op\b/i,
    /^(reddit|github|twitter|x|n8n)\s*user/i,
    /^(unknown|null|undefined|placeholder|tbd|n\/a|none|original\s+poster)$/i,
    /^[0-9]+$/,
    /^anonymous/i,
    /^poster\b/i
  ];
  if (!handle || typeof handle !== 'string') return true;
  const trimmed = handle.trim();
  if (trimmed.length < 3) return true;
  return patterns.some((pattern) => pattern.test(trimmed));
}

function parseScoring(input) {
  if (Array.isArray(input.users)) return { users: input.users, _users: input.users, _placeholder_dropped: 0 };
  try {
    let content = extractScoringContent(input);
    content = String(content).replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    const users = Array.isArray(parsed.users) ? parsed.users : [];
    if (users.length === 0) return { _empty: true, users: [] };
    const validUsers = users.filter((user) => !isPlaceholder(user.username));
    const droppedCount = users.length - validUsers.length;
    if (validUsers.length === 0) {
      return { _empty: true, users: [], _placeholder_dropped: droppedCount };
    }
    return { users: validUsers, _users: validUsers, _placeholder_dropped: droppedCount };
  } catch (error) {
    return { _error: true, message: `Parse failed: ${error.message}` };
  }
}

function inputUsers(input) {
  if (Array.isArray(input.users)) return input.users;
  if (Array.isArray(input._users)) return input._users;
  if (input.scoringResponse || input.geminiResponse || input.response) {
    const parsed = parseScoring(input);
    return Array.isArray(parsed.users) ? parsed.users : [];
  }
  return null;
}

function buildPayloads(input) {
  const users = inputUsers(input);
  const missing = [];
  if (!Array.isArray(users)) missing.push('users');
  const runTime = firstValue(input, ['runTime', 'run_time']);
  if (!hasValue(runTime)) missing.push('runTime');
  if (missing.length) return { needs_more_information: true, missing };

  const defaults = {
    weekTag: firstValue(input, ['weekTag', 'week_tag']),
    batchId: firstValue(input, ['batchId', 'batch_id'])
  };
  const existingRecords = firstValue(input, ['existingRecords', 'larkRecords', 'existing_lark_records']) || [];
  const deduped = dedupeUsers(users, existingRecords, defaults);
  const mapped = mapUsersToRecords(deduped.users, {
    fallbackPostDate: firstValue(input, ['fallbackPostDate', 'fallback_post_date', 'postCreatedDate', 'post_created_date'])
  });

  if (mapped.missing.length) {
    return { needs_more_information: true, missing: mapped.missing };
  }
  if (mapped.records.length === 0) {
    return {
      skip: true,
      reason: 'no valid new users to write',
      records: [],
      diagnostics: {
        dropped_vs_lark: deduped.droppedVsLark,
        dropped_in_batch: deduped.droppedInBatch,
        dropped_incomplete: mapped.droppedIncomplete,
        dropped_map_duplicate: mapped.droppedMapDuplicate
      }
    };
  }

  const createRecordPayloads = mapped.records.map((record) => recordPayload(record, input));
  const stats = buildStats(mapped.records, runTime);
  const messagePayload = sendMessagePayload(stats, input);

  return {
    message_type: 'icp_hunter_scoring_lark_payloads',
    summary: stats.summary,
    records: mapped.records,
    createRecordPayloads,
    stats,
    sendMessagePayload: messagePayload,
    lark: {
      base: {
        createRecordPayloads
      },
      message: {
        sendMessagePayload: messagePayload
      }
    },
    diagnostics: {
      input_users: users.length,
      new_users_after_lark_dedup: deduped.users.length,
      records_to_write: mapped.records.length,
      dropped_vs_lark: deduped.droppedVsLark,
      dropped_in_batch: deduped.droppedInBatch,
      dropped_incomplete: mapped.droppedIncomplete,
      dropped_map_duplicate: mapped.droppedMapDuplicate
    }
  };
}

function buildPayload(input) {
  const record = source(input || {});
  const mode = record.mode || 'build_payloads';
  if (mode === 'parse_scoring') return parseScoring(record);
  if (mode === 'build_payloads') return buildPayloads(record);
  return { skip: true, reason: `unsupported mode: ${mode}` };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildPayload(readInput()), null, 2)}\n`);
}

module.exports = { buildPayload };
