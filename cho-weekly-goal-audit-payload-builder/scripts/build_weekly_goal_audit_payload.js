#!/usr/bin/env node
'use strict';

const fs = require('fs');

const APP_TOKEN = 'BASE_APP_TOKEN_PLACEHOLDER_1';
const TABLE_ID = 'TABLE_ID_PLACEHOLDER_4';
const DEFAULT_CHO_OPEN_ID = 'ou_PLACEHOLDER_OPEN_ID_1';
const ALLOWED_DIMS = ['风险降低', '效率提升', '收入创造', '成本降低', '长期资产', '主动发现与改善'];

const EMPLOYEE_ROSTER = {
  eb739378: { name: 'Melissa Chng', email: 'user21@example.com' },
  '6fba74ca': { name: 'Lexa', email: 'user11@example.com' },
  bd929agb: { name: 'Frank', email: 'user12@example.com' },
  ee1fd2ea: { name: 'Ruby', email: 'user28@example.com' },
  g5c1b4e9: { name: 'Dimitri', email: 'user08@example.com' },
  d2a5f9c6: { name: 'Jesse Liu', email: 'user15@example.com' },
  '3f3gf75a': { name: 'Stephan Su', email: 'user16@example.com' },
  '2gd8c5bd': { name: 'Amy Liu', email: 'user04@example.com' },
  bdfg1fc3: { name: 'Yvonne Ang', email: 'user31@example.com' },
  '187c4fe7': { name: 'Nicholas Tan', email: 'user22@example.com' },
  '8b53dd94': { name: 'Dionne Ng', email: 'user09@example.com' },
  b1e4311c: { name: 'Wendy Wang', email: 'user27@example.com' },
  '831cg5af': { name: 'Crystal Wu', email: 'user06@example.com' },
  ee689459: { name: 'Albinia Leow', email: 'user03@example.com' },
  USER_ID_PLACEHOLDER_2: { name: 'Ada', email: 'user02@example.com' },
  '3146b4ag': { name: 'Lydia Feng', email: 'user20@example.com' },
  '37ebb3bc': { name: 'Zoe Fan', email: 'user32@example.com' },
  '44bfg3f5': { name: 'Josie Jiang', email: 'user10@example.com' },
  '7faf1924': { name: 'Dannick Young', email: 'user07@example.com' },
  '93cfg4bd': { name: 'Shaw Zheng', email: 'user30@example.com' },
  USER_ID_PLACEHOLDER_1: { name: 'Abigail Deng', email: 'user01@example.com' },
  dd95397e: { name: 'Calvin Tan', email: 'user05@example.com' },
  '4a8a8g8d': { name: 'Haylee Wang', email: 'user13@example.com' },
  '6816bcb1': { name: 'Wang Shining', email: 'user25@example.com' },
  '8ce88cca': { name: 'Ean Zhao', email: 'user29@example.com' },
  '9f34f53e': { name: 'Louis Li', email: 'user19@example.com' },
  '9ggff8ae': { name: 'Potter Sun', email: 'user23@example.com' },
  '6b15c721': { name: 'Jason Wang', email: 'user14@example.com' },
  b559dfgb: { name: 'Richard Huang', email: 'user24@example.com' },
  '39a4gdc5': { name: 'Lim Kai Huei', email: 'user17@example.com' },
  '6g952f2e': { name: 'Lim Kai Wei', email: 'user18@example.com' }
};

function readInput() {
  const text = fs.readFileSync(0, 'utf8');
  return text.trim() ? JSON.parse(text) : {};
}

function bodySource(input) {
  return input && input.body && typeof input.body === 'object' ? input.body : input;
}

function firstValue(record, names) {
  for (const name of names) {
    const value = record ? record[name] : undefined;
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

function missingObject(fields) {
  const missing = Object.entries(fields)
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
    .map(([key]) => key);
  return missing.length ? { needs_more_information: true, missing } : null;
}

function larkId(value) {
  return { __rl: true, mode: 'id', value: String(value || '') };
}

function larkFixedId(value) {
  return { __rl: true, value: String(value || ''), mode: 'id' };
}

let resolvedAppToken = APP_TOKEN;
let resolvedTableId = TABLE_ID;

function appToken() {
  return { __rl: true, value: resolvedAppToken, mode: 'id' };
}

function tableId() {
  return { __rl: true, value: resolvedTableId, mode: 'id' };
}

function pickTextsFromPostObj(obj) {
  if (!obj || typeof obj !== 'object') return [];
  const lines = Array.isArray(obj.content) ? obj.content : [];
  const flat = lines.flatMap(line => Array.isArray(line) ? line : [line]);
  return flat.map(x => (x && x.text) || '').filter(Boolean);
}

function extractMessageText(parsed) {
  if (!parsed || typeof parsed !== 'object') return '';
  if (typeof parsed.text === 'string' && parsed.text.trim()) return parsed.text.trim();
  const p1 = pickTextsFromPostObj((parsed.post && (parsed.post.zh_cn || parsed.post.en_us)) || parsed.post);
  if (p1.length) return p1.join('\n').trim();
  const p2 = pickTextsFromPostObj(parsed.zh_cn || parsed.content);
  if (p2.length) return p2.join('\n').trim();
  return '';
}

function deepCollectText(obj, out) {
  if (obj == null) return out;
  if (typeof obj === 'string') return out;
  if (Array.isArray(obj)) {
    for (const x of obj) deepCollectText(x, out);
    return out;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if ((k === 'text' || k === 'title') && typeof v === 'string' && v.trim()) out.push(v.trim());
      if (typeof v === 'object' && v) deepCollectText(v, out);
    }
  }
  return out;
}

function parseContentText(rawCandidates) {
  let text = '';
  let parsedContent = {};
  for (const raw of rawCandidates.filter(v => v != null)) {
    if (text) break;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        parsedContent = parsed;
        text = extractMessageText(parsed);
        if (!text) {
          const extra = deepCollectText(parsed, []);
          if (extra.length) text = [...new Set(extra)].join('\n');
        }
      } catch (_) {
        if (raw.trim() && !raw.trim().startsWith('{')) text = raw.trim();
      }
    } else if (typeof raw === 'object') {
      parsedContent = raw;
      text = extractMessageText(raw);
      if (!text) {
        const extra = deepCollectText(raw, []);
        if (extra.length) text = [...new Set(extra)].join('\n');
      }
    }
  }
  return { text, parsedContent };
}

function cleanGoalText(text) {
  return String(text || '')
    .replace(/@_user_\d+/g, '')
    .replace(/^@\S+\s*/gm, '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseGoals(cleanedGoal, isPdfMessage) {
  const rawLines = cleanedGoal.split('\n').map(s => s.trim()).filter(Boolean);
  const lines = rawLines.filter(l => !/^本周目标[:：]?$/i.test(l));
  const goals = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    if (/^\d+[\.|、|\)]\s*$/.test(cur) && i + 1 < lines.length) {
      const next = lines[i + 1].replace(/^\d+[\.|、|\)]\s*/, '').trim();
      if (next) goals.push(next);
      i += 1;
      continue;
    }
    const m = cur.match(/^\d+[\.|、|\)]\s*(.+)$/);
    if (m && m[1].trim()) {
      goals.push(m[1].trim());
      continue;
    }
    if (!/^@\S+$/.test(cur)) goals.push(cur);
  }
  const isCodeFence = s => !s || /^\s*```\s*$/.test(s) || s.trim() === '```json' || /^\s*```\s*json\s*$/i.test(s);
  let dedupGoals = [];
  for (const goal of goals) if (goal && !dedupGoals.includes(goal)) dedupGoals.push(goal);
  dedupGoals = dedupGoals.filter(g => !isCodeFence(g));
  if (dedupGoals.length === 0 && cleanedGoal.length > 20 && !isCodeFence(cleanedGoal)) {
    const fallback = cleanedGoal
      .split(/\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .filter(l => !isCodeFence(l) && !/^本周目标[:：]?$/i.test(l));
    if (fallback.length) dedupGoals = [...fallback];
  }
  const goalsForAudit = dedupGoals.map((g, i) => ({ id: i + 1, original: g }));
  return {
    hasGoalItems: goalsForAudit.length > 0 || isPdfMessage,
    goalTextNormalized: dedupGoals.map((g, i) => `${i + 1}. ${g}`).join('\n') || '（未识别到可审计目标）',
    goalsForAudit
  };
}

function intentFromGoal(goalText, submitTime) {
  const ts = Date.parse(String(submitTime || ''));
  const day = Number.isFinite(ts) ? new Date(ts).getDay() : -1;
  const isReview = [5, 6, 0].includes(day) ||
    /^\s*(本周已完成|已完成|本周总结|本周复盘|复盘|工作总结|主要贡献|[Rr]ecap|[Ss]ummary|SUMMARY|[Ww]eekly\s*[Rr]eview|[Ww]eekly\s*[Ss]ummary)/.test(String(goalText || ''));
  return isReview ? 'review' : 'audit';
}

function parseEvent(input) {
  const payload = bodySource(input || {});
  if (payload.type === 'url_verification' && payload.challenge) {
    return {
      skip: true,
      isChallenge: true,
      challenge: payload.challenge,
      webhookResponse: { responseCode: 200, body: { challenge: payload.challenge } }
    };
  }

  const required = {
    weekKey: firstValue(input, ['weekKey', 'week_key']),
    submitTime: firstValue(input, ['submitTime', 'submit_time']),
    attemptId: firstValue(input, ['attemptId', 'attempt_id'])
  };
  const missing = missingObject(required);
  if (missing) return missing;

  const event = payload.event || (payload.data && payload.data.event) || {};
  const header = payload.header || {};
  const eventType = header.event_type || payload.event_type || '';
  const eventId = header.event_id || payload.event_id || '';
  const message = event.message || {};
  const messageId = message.message_id || event.message_id || '';
  const messageType = message.message_type || event.message_type || '';
  const isReceiveEvent = eventType === 'im.message.receive_v1';

  const senderType = (event.sender && event.sender.sender_type) || '';
  const senderId = (event.sender && event.sender.sender_id) || {};
  const senderOpenId = senderId.open_id || '';
  const senderUserId = senderId.user_id || '';
  const senderUnionId = senderId.union_id || '';
  const botOpenId = String(firstValue(input, ['botOpenId', 'bot_open_id']) || '');
  const botUserId = String(firstValue(input, ['botUserId', 'bot_user_id']) || '');
  const botUnionId = String(firstValue(input, ['botUnionId', 'bot_union_id']) || '');
  const isFromBotById = (botOpenId && senderOpenId === botOpenId) ||
    (botUserId && senderUserId === botUserId) ||
    (botUnionId && senderUnionId === botUnionId);
  const isFromBot = senderType === 'app' || senderType === 'bot' || isFromBotById;

  const parsed = parseContentText([
    message.content,
    message.body && message.body.content,
    event.content,
    payload.message && payload.message.content
  ]);
  let text = parsed.text;
  let parsedContent = parsed.parsedContent;
  if (!text) {
    const extra = deepCollectText(event, []);
    if (extra.length) text = [...new Set(extra)].join('\n');
  }

  const roster = input.employeeRoster && typeof input.employeeRoster === 'object' ? input.employeeRoster : EMPLOYEE_ROSTER;
  const openId = senderOpenId || senderUnionId || '';
  const employeeUserId = senderUserId || '';
  const rosterHit = roster[String(employeeUserId || '')] || null;
  const employeeDisplayName = (rosterHit && rosterHit.name ? String(rosterHit.name).trim() : '') || employeeUserId || openId || 'unknown_user';
  const employeeEmail = (rosterHit && rosterHit.email ? String(rosterHit.email).trim().toLowerCase() : '');
  const chatType = message.chat_type || event.chat_type || '';
  const isGroupChat = chatType === 'group';
  const mentionList = Array.isArray(message.mentions) ? message.mentions : (Array.isArray(parsedContent.mentions) ? parsedContent.mentions : []);
  const mentionedOpenIds = mentionList.map(m => (m && m.id && m.id.open_id) || (m && m.open_id) || '').filter(Boolean);
  const hasAtToken = /@_user_\d+/i.test(String(text || ''));
  const botMentioned = botOpenId ? mentionedOpenIds.includes(botOpenId) : (mentionList.length > 0 || hasAtToken || /^@\S+/.test(String(text || '')));

  const fileKey = parsedContent.file_key || parsedContent.fileKey || (parsedContent.file && parsedContent.file.file_key) || '';
  const fileName = parsedContent.file_name || parsedContent.fileName || (parsedContent.file && parsedContent.file.name) || '';
  const isPdfByName = /\.pdf$/i.test(String(fileName || ''));
  const isPdfByType = String(parsedContent.file_type || parsedContent.type || '').toLowerCase() === 'pdf';
  const isPdfMessage = String(messageType || '').toLowerCase() === 'file' && (isPdfByName || isPdfByType || Boolean(fileKey));
  const cleanedGoal = cleanGoalText(text || (isPdfMessage ? `【PDF】${fileName || '未命名文件'}` : ''));
  const goalInfo = parseGoals(cleanedGoal, isPdfMessage);

  const dedupeKeys = [...new Set(
    String(messageId || '').trim()
      ? [String(messageId).trim(), String(eventId || '').trim(), eventId && messageId ? `${eventId}::${messageId}` : ''].filter(Boolean)
      : [String(eventId || '').trim()].filter(Boolean)
  )];
  const seenDedupeKeys = Array.isArray(input.seenDedupeKeys) ? input.seenDedupeKeys.map(String) : [];
  const isDuplicate = Boolean(input.isDuplicate) || dedupeKeys.some(k => seenDedupeKeys.includes(k));
  const isLikelyAuditEcho = /输入原文回显（系统锁定）|🚦\s*审计结果|请根据优化建议修改后再次发送给机器人/.test(cleanedGoal);
  const supportedMessageType = ['text', 'post', 'file'].includes(String(messageType || '').toLowerCase());
  const isMessageEvent = isReceiveEvent && supportedMessageType && !isFromBot && !isDuplicate && !isLikelyAuditEcho && goalInfo.hasGoalItems && (!isGroupChat || botMentioned);

  if (!isMessageEvent) {
    let reason = 'not a target message event';
    if (!isReceiveEvent) reason = 'not im.message.receive_v1';
    else if (!supportedMessageType) reason = 'unsupported message type';
    else if (isFromBot) reason = 'message is from bot';
    else if (isDuplicate) reason = 'duplicate message';
    else if (isLikelyAuditEcho) reason = 'audit echo message';
    else if (!goalInfo.hasGoalItems) reason = 'no goal items';
    else if (isGroupChat && !botMentioned) reason = 'bot not mentioned in group chat';
    return { skip: true, reason, isMessageEvent: false, webhookResponse: { responseCode: 200, body: { code: 0, msg: 'ok' } } };
  }

  return {
    skip: false,
    isChallenge: false,
    isMessageEvent: true,
    isDuplicate,
    isPdfMessage,
    pdfFileKey: fileKey || '',
    pdfFileName: fileName || '',
    openId,
    employeeName: employeeDisplayName,
    employeeDisplayName,
    employeeEmail,
    employeeUserId,
    goalText: cleanedGoal || '（用户未提供可识别文本）',
    goalTextNormalized: goalInfo.goalTextNormalized,
    goalsForAudit: goalInfo.goalsForAudit,
    messageId,
    weekKey: String(required.weekKey).trim(),
    submitTime: String(required.submitTime).trim(),
    attemptId: String(required.attemptId).trim(),
    intent: intentFromGoal(cleanedGoal, required.submitTime),
    debugEventType: eventType,
    debugChatType: chatType,
    debugMessageType: messageType,
    debugSupportedMessageType: supportedMessageType,
    debugMentionCount: mentionList.length,
    debugIsFromBot: isFromBot,
    debugIsLikelyAuditEcho: isLikelyAuditEcho,
    debugHasGoalItems: goalInfo.hasGoalItems,
    debugIsPdfMessage: isPdfMessage,
    debugPdfFileName: fileName || '',
    debugPdfFileKey: fileKey || '',
    debugDedupeKeys: dedupeKeys,
    rawEvent: payload,
    webhookResponse: { responseCode: 200, body: { code: 0, msg: 'ok' } }
  };
}

function stripFences(s) {
  let t = String(s || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  return t.trim();
}

function sliceBalancedJson(s) {
  const start = String(s || '').indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  const text = String(s || '');
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractJsonStringValue(text, key) {
  const re = new RegExp(`"${key}"\\s*:\\s*"`, 'm');
  const m = String(text || '').match(re);
  if (!m) return '';
  let i = m.index + m[0].length;
  let out = '';
  let esc = false;
  const src = String(text || '');
  for (; i < src.length; i++) {
    const c = src[i];
    if (esc) {
      if (c === 'n') out += '\n';
      else if (c === 'r') out += '\r';
      else if (c === 't') out += '\t';
      else out += c;
      esc = false;
      continue;
    }
    if (c === '\\') {
      esc = true;
      continue;
    }
    if (c === '"') break;
    out += c;
  }
  return out;
}

function rawModelText(input, aliases) {
  const value = firstValue(input, aliases);
  if (typeof value === 'string') return value;
  const item = value && typeof value === 'object' ? value : input;
  return String(
    (item.candidates && item.candidates[0] && item.candidates[0].content && item.candidates[0].content.parts && item.candidates[0].content.parts[0] && item.candidates[0].content.parts[0].text) ||
    item.text ||
    item.output ||
    item.content ||
    (item.message && item.message.content) ||
    ''
  );
}

function parseJsonFromRaw(raw) {
  const text = String(raw || '').trim();
  try {
    return JSON.parse(text);
  } catch (_) {
    const slice = sliceBalancedJson(stripFences(text)) || sliceBalancedJson(text);
    if (slice) {
      try {
        return JSON.parse(slice);
      } catch (_) {
        try {
          const sanitized = slice.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, match => match.replace(/\n/g, '\\n').replace(/\r/g, ''));
          return JSON.parse(sanitized);
        } catch (_) {
          return null;
        }
      }
    }
  }
  return null;
}

function isCodeFenceStr(s) {
  return !s || /^\s*```\s*$/.test(String(s)) || String(s).trim() === '```json' || /^\s*```\s*json\s*$/i.test(String(s));
}

function hasMetric(text) {
  return /\d|%|>=|≤|<|>|kpi|arr|转化|成功率|曝光|投诉|上线|提交|完成|conversion|rate|success|views|launch|submit|complete|reduce|increase|deliver/i.test(String(text || ''));
}

function hasDeliverable(text) {
  return /报告|文档|清单|合同|测试|工单|流程|系统|功能|版本|上线|提交|发布|脚本|报表|自动化|report|doc|document|checklist|contract|agreement|ticket|process|feature|version|release|dashboard|automation|brief|paper|pdf/i.test(String(text || ''));
}

function detectViolations(goal) {
  const v = [];
  const t = String(goal || '');
  if (!hasMetric(t)) v.push('二进制验证');
  if (/(跟进|沟通|尝试|研究|优化|负责|推进|协助|follow up|communicate|try|research|optimize|responsible|drive|assist|support|maintain|execute)/i.test(t)) v.push('禁止努力动词');
  if (!hasDeliverable(t)) v.push('价值外向');
  if (!/(ARR|获客|成本|稳定性|转化|收入|效率|风险|留存|投诉|成功率|cac|cost|stability|conversion|revenue|efficiency|risk|retention|complaint|success|spend|liability)/i.test(t)) v.push('战略对齐');
  if (!/(本周|周五|\d+条|\d+份|\d+个|上线|完成|this week|friday|eow|complete|deliver|launch|\d+\s*(items|docs|pages))/i.test(t)) v.push('时间匹配');
  return v;
}

function fallbackRewrite(goal) {
  const g = String(goal || '').trim();
  return `在本周五前完成：${g}。【验收标准要求补充】：1) 产出可测试的物理里程碑或交付物；2) 至少1个量化结果；3) 明确与一个核心业务指标或战略杠杆的对应关系。`;
}

function classifyValueDimensionsRule(text) {
  const t = String(text || '');
  const dims = [];
  if (/(发现|痛点|重构|重塑|创新|破局|结合AI|利用AI|AI解决|引入AI|改善现状)/i.test(t)) dims.push('主动发现与改善');
  if (/(自动化|效率|流程|提效|工时|耗时|记账|工资单|个税|工作流)/i.test(t)) dims.push('效率提升');
  if (/(收入|获客|转化|ARR|曝光|营销|推文|增长|付费|留资)/i.test(t)) dims.push('收入创造');
  if (/(投诉|故障|稳定性|风控|合规|KYC|税务|错误|异常|风险|修复)/i.test(t)) dims.push('风险降低');
  if (/(降本|成本|费用|节省|开支)/i.test(t)) dims.push('成本降低');
  if (!dims.length) dims.push('长期资产');
  return [...new Set(dims)];
}

function normalizeAiDims(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(x => String(x || '').trim()).filter(x => ALLOWED_DIMS.includes(x)))];
}

function mergeDims(aiDims, ruleDims) {
  const a = normalizeAiDims(aiDims);
  const r = normalizeAiDims(ruleDims);
  if (!a.length) return r.length ? r : ['长期资产'];
  const merged = [...new Set([...a, ...r])];
  return merged.length ? merged : ['长期资产'];
}

function classifyGoalTypeByDims(dims, text) {
  const t = String(text || '');
  if (dims.includes('收入创造') || /(收入|获客|转化|ARR|曝光|营销|增长)/i.test(t)) return 'Revenue Move';
  if (dims.includes('风险降低') || /(投诉|故障|稳定性|风控|合规|KYC|税务|异常|风险)/i.test(t)) return 'Risk Control Move';
  return 'Structure Move';
}

function isMaintenanceLike(text) {
  const t = String(text || '');
  return /(跟进|沟通|协调|维护|支持|处理日常|例行)/.test(t) && !/(交付|报告|文档|上线|完成|提交|发布)/.test(t);
}

function parseAuditAnalysis(input) {
  const src = input.event && typeof input.event === 'object' ? { ...input.event, ...input } : input;
  let goals = Array.isArray(src.goalsForAudit) ? src.goalsForAudit : [];
  let lockedEcho = String(src.goalTextNormalized || src.goalText || '').trim();
  const raw = rawModelText(input, ['auditOutput', 'audit_output', 'llmOutput', 'llm_output', 'modelOutput', 'model_output']).trim();
  let parsed = parseJsonFromRaw(raw);

  if (!parsed && raw.length > 80 && /[\u4e00-\u9fa5a-zA-Z0-9]/.test(raw)) {
    const normalized = raw.replace(/\r/g, '').replace(/\n/g, '\n').replace(/\t/g, ' ');
    const looksLikeAiOutput = /存在违规|违反准则|扣分原因|choNote|"reason"|"rewrite"|可验证的验收指标|努力提升用户满意度|valueDimensions|redFlags|highlights/.test(normalized);
    if (!looksLikeAiOutput) {
      const extracted = [];
      for (const line of normalized.split(/\n/).map(s => s.trim()).filter(Boolean)) {
        const m = line.match(/^\d+[\.、\)]\s*(.+)$/);
        const t = m ? m[1].trim() : line;
        if (/完成|上线|发布|修复|提交|交付|达成|优化|测试|搭建|实现|对齐|推进|降低|提升|目标|计划|本周|里程碑|验收|KPI|ARR|自动化|与.*确认|发布.*推文/.test(t) && t.length >= 6) extracted.push(t);
      }
      if (extracted.length) {
        goals = extracted.map((g, i) => ({ id: i + 1, original: g }));
        const looksLikeAiJson = /^\s*\{|[\s\S]*"score"\s*:|[\s\S]*"items"\s*:/.test(normalized);
        lockedEcho = looksLikeAiJson ? goals.map(g => `${g.id}. ${g.original}`).join('\n') : normalized.slice(0, 3000);
      }
    }
  }

  const echoIsJson = s => {
    const t = String(s || '').trim();
    return t.startsWith('{') || t.startsWith('[') || /"score"\s*:|"items"\s*:|"highlights"\s*:/.test(t);
  };
  if (echoIsJson(lockedEcho) && goals.length) lockedEcho = goals.map(g => `${g.id}. ${g.original}`).join('\n');
  else if (echoIsJson(lockedEcho)) lockedEcho = '（原文未单独保留，请以下方逐条审计中的原文为准）';

  if (goals.some(g => isCodeFenceStr(g.original)) || (goals.length === 1 && String(goals[0].original || '').length < 15)) {
    const fallbackGoals = String(src.goalText || src.goalTextNormalized || '')
      .replace(/\r/g, '')
      .split(/\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .filter(l => !/^本周目标[:：]?$/i.test(l) && !/输入原文回显|审计结果|违反准则|choNote|^\s*```/.test(l) && l.length >= 6);
    if (fallbackGoals.length) goals = fallbackGoals.map((g, i) => ({ id: i + 1, original: g }));
  }
  if (goals.length === 0 && (src.goalText || src.goalTextNormalized)) {
    const fallbackGoals = String(src.goalText || src.goalTextNormalized || '')
      .replace(/\r/g, '')
      .split(/\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .filter(l => !/^本周目标[:：]?$/i.test(l) && !/输入原文回显|审计结果|违反准则|choNote/.test(l));
    if (fallbackGoals.length) goals = fallbackGoals.map((g, i) => ({ id: i + 1, original: g }));
  }
  if (lockedEcho && isCodeFenceStr(lockedEcho) && goals.length) lockedEcho = goals.map(g => `${g.id}. ${g.original}`).join('\n');

  let valid = parsed && typeof parsed === 'object' && parsed.error !== 'unaligned';
  const items = Array.isArray(parsed && parsed.items) ? parsed.items : [];
  const itemMap = new Map(items.map(it => [Number(it && it.id), it]));
  if (goals.length === 0) valid = false;
  for (const g of goals) if (!itemMap.has(Number(g.id))) valid = false;

  let score = Number(parsed && parsed.score);
  if (!Number.isFinite(score)) score = null;
  let finalItems = [];
  let highlights = [];
  let redFlags = [];
  let choNote = '';

  if (valid) {
    finalItems = goals.map(g => {
      const it = itemMap.get(Number(g.id)) || {};
      const ruleDims = classifyValueDimensionsRule(g.original);
      const finalDims = mergeDims(it.valueDimensions, ruleDims);
      let reason = String(it.reason || '').trim();
      let rewrite = String(it.rewrite || '').trim();
      if (!reason || reason.length < 10) {
        const v = Array.isArray(it.violations) ? it.violations.filter(Boolean) : detectViolations(g.original);
        reason = v.length ? `该目标存在：${v.join('、')}。建议补充量化验收标准、交付物和战略杠杆。` : '该目标基本可执行，建议补充最终交付系统/链接作为验收凭证。';
      }
      if (!rewrite) rewrite = fallbackRewrite(g.original);
      return {
        id: g.id,
        original: g.original,
        violations: Array.isArray(it.violations) ? it.violations.filter(Boolean) : [],
        reason,
        rewrite,
        valueDimensions: finalDims
      };
    });
    highlights = Array.isArray(parsed.highlights) ? parsed.highlights : [];
    redFlags = Array.isArray(parsed.redFlags) ? parsed.redFlags : [];
    choNote = String(parsed.choNote || '').trim();
    const isGenericNote = /先保证每条目标|可交付物\+量化标准|再追求表达完整度/.test(choNote);
    if (isGenericNote && finalItems.length) {
      const noFence = x => !isCodeFenceStr(x.original);
      const strong = finalItems.filter(noFence).filter(x => x.violations.length <= 1).slice(0, 2).map(x => x.original.slice(0, 14));
      const weak = finalItems.filter(noFence).filter(x => x.violations.length >= 2).slice(0, 1).map(x => x.original.slice(0, 14));
      let built = '';
      if (strong.length) built = `本周期「${strong.join('」「')}」等目标可执行性较好`;
      if (weak.length) built += (built ? '；' : '') + `「${weak[0]}」建议补足验收标准与交付物`;
      choNote = built ? `${built}。` : `共${finalItems.length}条目标，建议每条都明确一个可验证结果与交付物。`;
    }
  } else {
    finalItems = goals.map(g => {
      const violations = detectViolations(g.original);
      const reason = violations.length
        ? `该目标存在：${violations.join('、')}。建议补充量化验收标准、交付物和战略指标对齐。`
        : '该目标基本可执行，建议补充最终交付截图/链接作为验收凭证。';
      return {
        id: g.id,
        original: g.original,
        violations,
        reason,
        rewrite: fallbackRewrite(g.original),
        valueDimensions: classifyValueDimensionsRule(g.original)
      };
    });
    const weakCount = finalItems.filter(x => x.violations.length >= 3).length;
    score = Math.max(1, 10 - weakCount - Math.ceil(finalItems.length / 3));
    const goodItems = finalItems.filter(x => !x.violations.length);
    highlights = goodItems.length > 0
      ? goodItems.slice(0, 2).map(x => `目标${x.id} 已具备较强可执行性（量化标准/交付边界较清晰）。`)
      : ['无明显亮点：当前目标整体仍需加强杠杆与战略对齐。'];
    const vCount = { 二进制验证: 0, 禁止努力动词: 0, 价值外向: 0, 战略对齐: 0, 时间匹配: 0 };
    for (const it of finalItems) for (const v of it.violations) if (vCount[v] !== undefined) vCount[v] += 1;
    const topIssues = Object.entries(vCount)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, c]) => `${k}（${c}/${finalItems.length}）`);
    redFlags = [];
    if (topIssues.length) redFlags.push(`当前目标主要风险集中在：${topIssues.join('、')}。`);
    if (finalItems.filter(x => x.violations.includes('战略对齐')).length >= Math.ceil(finalItems.length / 2)) redFlags.push('超过一半目标缺少与核心业务指标（ARR/转化/成本/稳定性等）的明确对齐。');
    if (finalItems.filter(x => x.violations.includes('二进制验证')).length > 0) redFlags.push('部分目标缺少明确验收边界，周五复盘难以做“达成/失败”二元判断。');
    redFlags.push('本次为规则审计降级结果（模型结构化失败自动启用），建议继续提升模型结构化稳定性。');
    const noFence = x => !isCodeFenceStr(x.original);
    const strong = finalItems.filter(noFence).filter(x => x.violations.length <= 1).slice(0, 2).map(x => x.original.slice(0, 12));
    const weak = finalItems.filter(noFence).filter(x => x.violations.length >= 3).slice(0, 1).map(x => x.original.slice(0, 12));
    const parts = [];
    if (strong.length) parts.push(`本周期如「${strong.join('」「')}」等目标已具可验证性`);
    if (weak.length) parts.push(`「${weak[0]}」等建议补足量化与交付物`);
    choNote = parts.length ? `${parts.join('；')}。` : '请为每条目标补足可交付物与至少一个量化标准，便于周五复盘。';
  }

  const dimCount = { 风险降低: 0, 效率提升: 0, 收入创造: 0, 成本降低: 0, 长期资产: 0, 主动发现与改善: 0 };
  const typeCount = { 'Structure Move': 0, 'Revenue Move': 0, 'Risk Control Move': 0 };
  let maintenanceCount = 0;
  for (const it of finalItems) {
    const dims = normalizeAiDims(it.valueDimensions);
    for (const d of (dims.length ? dims : ['长期资产'])) if (dimCount[d] !== undefined) dimCount[d] += 1;
    typeCount[classifyGoalTypeByDims(dims, it.original)] += 1;
    if (isMaintenanceLike(it.original)) maintenanceCount += 1;
  }
  const totalItems = Math.max(1, finalItems.length);
  const primaryValueDimension = Object.entries(dimCount).sort((a, b) => b[1] - a[1])[0][0] || '';
  const valueDimensions = Object.entries(dimCount).filter(([, c]) => c > 0).map(([k]) => k);
  const valueDimensionMix = `💡主动发现与改善 ${Math.round(dimCount['主动发现与改善'] * 100 / totalItems)}% / 风险降低 ${Math.round(dimCount['风险降低'] * 100 / totalItems)}% / 效率提升 ${Math.round(dimCount['效率提升'] * 100 / totalItems)}% / 收入创造 ${Math.round(dimCount['收入创造'] * 100 / totalItems)}% / 成本降低 ${Math.round(dimCount['成本降低'] * 100 / totalItems)}% / 长期资产 ${Math.round(dimCount['长期资产'] * 100 / totalItems)}%`;
  const goalTypeMix = `Structure Move ${Math.round(typeCount['Structure Move'] * 100 / totalItems)}% / Revenue Move ${Math.round(typeCount['Revenue Move'] * 100 / totalItems)}% / Risk Control Move ${Math.round(typeCount['Risk Control Move'] * 100 / totalItems)}%`;
  const maintenanceRatio = `${Math.round(maintenanceCount * 100 / totalItems)}%`;

  const lines = [];
  lines.push(`已收到你的本周目标（${src.weekKey}）。`);
  lines.push('');
  lines.push('### 输入原文回显（系统锁定）');
  lines.push(lockedEcho);
  lines.push('');
  lines.push(`### 🚦 审计结果：${score ?? 'N/A'}/10`);
  if (highlights.length) {
    lines.push('- **亮点**：');
    for (const h of highlights) lines.push(`  - ${h}`);
  }
  if (redFlags.length) {
    lines.push('- **警示区**：');
    for (const r of redFlags) lines.push(`  - ${r}`);
  }
  lines.push('');
  lines.push('### 逐条审计与改写');
  for (const it of finalItems) {
    lines.push(`- **目标${it.id} 原文**：${it.original}`);
    lines.push(`  - 违反准则：${it.violations.length ? it.violations.join('、') : '无'}`);
    lines.push(`  - 扣分原因：${it.reason}`);
    lines.push(`  - 改写指导（重点看这里）：${it.rewrite}`);
  }
  lines.push('');
  lines.push('### 📊 价值结构');
  lines.push(`- 主创造维度：${primaryValueDimension || '长期资产'}`);
  lines.push(`- 价值维度占比：${valueDimensionMix}`);
  lines.push(`- 目标类型占比：${goalTypeMix}`);
  lines.push(`- 维护型占比：${maintenanceRatio}`);
  lines.push('');
  lines.push('### 💡 CHO 寄语');
  lines.push(choNote || '请聚焦可验证交付物与战略对齐，减少过程型目标。');

  const auditText = lines.join('\n');
  const isEnglish = (lockedEcho.match(/[a-zA-Z]/g) || []).length > (lockedEcho.match(/[\u4e00-\u9fa5]/g) || []).length * 2;
  return {
    auditText,
    score,
    primaryValueDimension,
    valueDimensions,
    valueDimensionMix,
    goalTypeMix,
    maintenanceRatio,
    isEnglish,
    larkReply: `${auditText}\n\n---\n请根据优化建议修改后再次发送给机器人；每次提交都会重新评分并保留历史记录。`,
    finalItems,
    highlights,
    redFlags,
    choNote
  };
}

function parseTranslationOutput(input) {
  const explicit = firstValue(input, ['translatedReply', 'translated_reply', 'finalReply', 'final_reply']);
  if (explicit !== undefined) return String(explicit).trim();
  const value = firstValue(input, ['translationOutput', 'translation_output', 'translationResult', 'translation_result']);
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  return rawModelText(value, ['translationOutput', 'translation_output']).trim();
}

function buildBitableFields(item, larkReplyForRecord) {
  const submitTime = firstValue(item, ['submitTime', 'submit_time']);
  const ts = Date.parse(String(submitTime || ''));
  if (!Number.isFinite(ts)) return { needs_more_information: true, missing: ['submitTime'] };
  const fields = {
    员工OpenID: String(item.openId || ''),
    员工标识: String(item.employeeEmail ? `${item.employeeDisplayName || item.employeeName || ''} <${item.employeeEmail}>` : (item.employeeDisplayName || item.employeeName || item.employeeUserId || '')),
    周次: String(item.weekKey || ''),
    版本ID: String(item.attemptId || ''),
    消息ID: String(item.messageId || ''),
    原始周目标: String(item.goalText || ''),
    审计全文: String(larkReplyForRecord || item.auditText || ''),
    提交时间: ts
  };
  const scoreNum = Number(item.score);
  if (Number.isFinite(scoreNum)) fields['审计分数'] = scoreNum;
  const multiDims = Array.isArray(item.valueDimensions) ? item.valueDimensions.filter(v => ALLOWED_DIMS.includes(v)) : [];
  if (multiDims.length > 0) {
    fields['价值主维度'] = [...new Set(multiDims)];
  } else {
    const rawDim = String(item.primaryValueDimension || '');
    const dimValues = ALLOWED_DIMS.filter(v => rawDim.includes(v));
    if (dimValues.length > 0) fields['价值主维度'] = [...new Set(dimValues)];
  }
  if (item.goalTypeMix) fields['目标类型占比'] = String(item.goalTypeMix);
  if (item.maintenanceRatio) fields['维护型占比'] = String(item.maintenanceRatio);
  return fields;
}

function buildAuditPayloads(input) {
  const src = input.event && typeof input.event === 'object' ? { ...input.event, ...input } : input;
  const required = {
    openId: firstValue(src, ['openId', 'open_id']),
    weekKey: firstValue(src, ['weekKey', 'week_key']),
    submitTime: firstValue(src, ['submitTime', 'submit_time']),
    attemptId: firstValue(src, ['attemptId', 'attempt_id']),
    goalText: firstValue(src, ['goalText', 'goal_text'])
  };
  const missing = missingObject(required);
  if (missing) return missing;
  if (!Array.isArray(src.goalsForAudit) || !src.goalsForAudit.length) return { needs_more_information: true, missing: ['goalsForAudit'] };
  if (!rawModelText(input, ['auditOutput', 'audit_output', 'llmOutput', 'llm_output', 'modelOutput', 'model_output']).trim()) {
    return { needs_more_information: true, missing: ['auditOutput'] };
  }

  const audit = parseAuditAnalysis(src);
  const recordSource = { ...src, ...audit };
  const bitableFields = buildBitableFields(recordSource, audit.larkReply);
  if (bitableFields.needs_more_information) return bitableFields;
  const bitableBody = { fields: bitableFields };
  const translatedReply = parseTranslationOutput(input);
  const larkReply = translatedReply || audit.larkReply;

  return {
    message_type: 'cho_weekly_goal_audit_payloads',
    audit: { ...audit, larkReply },
    bitableBody,
    lark: {
      employeeMessage: {
        resource: 'message',
        operation: 'send',
        receive_id: larkId(required.openId),
        content: { text: larkReply },
        options: {}
      },
      createRecord: {
        resource: 'base',
        operation: 'createRecord',
        app_token: appToken(),
        table_id: tableId(),
        body: bitableBody,
        options: {}
      }
    }
  };
}

function buildReviewSearch(input) {
  const openId = firstValue(input, ['openId', 'open_id']);
  const weekKey = firstValue(input, ['weekKey', 'week_key']);
  const missing = missingObject({ openId, weekKey });
  if (missing) return missing;
  const body = {
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: '员工OpenID', operator: 'is', value: [String(openId)] },
        { field_name: '周次', operator: 'is', value: [String(weekKey)] }
      ]
    }
  };
  return {
    message_type: 'cho_weekly_goal_review_search',
    lark: {
      searchRecords: {
        resource: 'base',
        operation: 'searchRecords',
        app_token: appToken(),
        table_id: tableId(),
        body,
        options: {}
      }
    }
  };
}

function latestRecord(input) {
  const direct = firstValue(input, ['recordId', 'record_id']);
  if (direct) {
    return {
      recordId: String(direct),
      originalGoalText: String(firstValue(input, ['originalGoalText', 'original_goal_text']) || '')
    };
  }
  const candidate = firstValue(input, ['records', 'searchRecordsResult', 'search_records_result', 'searchResult', 'search_result']);
  let records = [];
  if (Array.isArray(candidate)) records = candidate;
  else if (candidate && Array.isArray(candidate.items)) records = candidate.items;
  else if (candidate && Array.isArray(candidate.records)) records = candidate.records;
  if (!records.length) return { recordId: '', originalGoalText: '未找到历史记录' };
  const record = records[records.length - 1];
  let rawGoal = (record.fields && (record.fields['原始周目标'] || record.fields['审计全文'])) || '内容为空';
  if (Array.isArray(rawGoal) && rawGoal.length > 0 && rawGoal[0] && rawGoal[0].text) {
    rawGoal = rawGoal.map(t => t.text).join('\n');
  }
  return { recordId: record.record_id || '', originalGoalText: String(rawGoal || '') };
}

function extractText(obj) {
  if (typeof obj === 'string') return obj;
  if (obj === null || obj === undefined) return '';
  if (Array.isArray(obj)) return obj.map(extractText).join('\n');
  if (typeof obj === 'object') {
    return Object.entries(obj).map(([k, v]) => `**${k}**: ${extractText(v)}`).join('\n\n');
  }
  return String(obj);
}

function peelToChoInsightText(raw, extractFn) {
  let t = String(raw || '').trim();
  let prev = '';
  for (let d = 0; d < 6 && t !== prev; d++) {
    prev = t;
    const looksWrapped = /^```(?:json)?/i.test(t) ||
      /^\s*\{\s*"\s*status\s*"/i.test(t) ||
      (/^\s*\{/.test(t) && t.includes('"employeeEcho"') && t.includes('"choInsight"'));
    if (!looksWrapped) break;
    const unfenced = stripFences(t);
    const candidate = unfenced.trim().startsWith('{') ? unfenced.trim() : t;
    const slice = sliceBalancedJson(candidate) || sliceBalancedJson(unfenced) || sliceBalancedJson(t);
    if (slice) {
      try {
        const o = JSON.parse(slice);
        if (o && typeof o.choInsight === 'string' && o.choInsight.trim()) {
          t = o.choInsight.trim();
          continue;
        }
      } catch (_) {}
      const ex = extractFn(slice, 'choInsight');
      if (ex && ex.trim()) {
        t = ex.trim();
        continue;
      }
    }
    const ex2 = extractFn(t, 'choInsight');
    if (ex2 && ex2.trim() && ex2.trim() !== t) {
      t = ex2.trim();
      continue;
    }
    break;
  }
  return t;
}

function stripTrailingJsonArtifacts(s) {
  let t = String(s || '').replace(/\r\n/g, '\n').trimEnd();
  for (let i = 0; i < 8; i++) {
    const before = t;
    t = t.replace(/\n```[a-z]*\s*$/gi, '');
    t = t.replace(/\n\}"\s*$/g, '');
    t = t.replace(/\}"\s*$/g, '');
    t = t.replace(/\n"\}\s*$/g, '');
    t = t.replace(/\n\}\s*$/g, '');
    t = t.replace(/\n"\s*$/g, '');
    if (t === before) break;
  }
  return t.trimEnd();
}

function markdownToPlainChineseParagraphs(s) {
  let t = String(s || '').replace(/\r\n/g, '\n').trim();
  if (!t) return '';
  if (t.startsWith('【解析')) return t;
  t = t.replace(/```(?:json)?\s*\n?([\s\S]*?)```/gi, (_, inner) => `${inner.trim()}\n\n`);
  t = t.replace(/^#{1,6}\s+/gm, '');
  t = t.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_, label, url) => (/^https?:\/\//i.test(String(url || '').trim()) ? `${label}（${String(url || '').trim()}）` : (label || url)));
  for (let i = 0; i < 10; i++) {
    const before = t;
    t = t.replace(/\*\*([\s\S]*?)\*\*/g, '$1');
    t = t.replace(/__([\s\S]*?)__/g, '$1');
    if (t === before) break;
  }
  t = t.split('\n').map(line => line.replace(/^\s*[-*]\s+/, '• ').replace(/^\s*(\d+)\.\s+/, '$1. ')).join('\n');
  t = t.replace(/`([^`]+)`/g, '$1');
  t = t.replace(/^\s*[-*_]{3,}\s*$/gm, '');
  for (let j = 0; j < 6; j++) {
    const b = t;
    t = t.replace(/\*([^*\n]+)\*/g, '$1');
    if (t === b) break;
  }
  t = t.replace(/(^|\s)#{1,6}(?=\s|$)/g, '$1');
  t = t.replace(/\*{2,}/g, '');
  t = t.replace(/[ \t]{2,}/g, ' ');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

function unescapeLiteralEscapes(s) {
  if (!s || typeof s !== 'string') return s;
  if (s.startsWith('【解析')) return s;
  let t = s;
  for (let pass = 0; pass < 12; pass++) {
    const before = t;
    t = t.replace(/\uFF3C\\n/g, '\n').replace(/\uFF3C\\r/g, '\n').replace(/\uFF3C\\t/g, '\t');
    t = t.replace(/\\r\\n/g, '\n');
    t = t.replace(/\\n/g, '\n');
    t = t.replace(/\\r/g, '\n');
    t = t.replace(/\\t/g, '\t');
    if (t === before) break;
  }
  return t;
}

function finalizeTextForLark(s) {
  let t = unescapeLiteralEscapes(s);
  if (!t || typeof t !== 'string') return t;
  if (t.startsWith('【解析')) return t;
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

function parseReviewAnalysis(input) {
  const raw = rawModelText(input, ['reviewOutput', 'review_output', 'llmOutput', 'llm_output', 'modelOutput', 'model_output']);
  const jsonSlice = sliceBalancedJson(stripFences(raw)) || sliceBalancedJson(raw);
  let parsed = {};
  if (jsonSlice) {
    try {
      parsed = JSON.parse(jsonSlice);
    } catch (_) {
      try {
        const sanitized = jsonSlice.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, match => match.replace(/\n/g, '\\n').replace(/\r/g, ''));
        parsed = JSON.parse(sanitized);
      } catch (_) {
        parsed = {
          status: extractJsonStringValue(jsonSlice, 'status'),
          blockers: extractJsonStringValue(jsonSlice, 'blockers'),
          hiddenWins: extractJsonStringValue(jsonSlice, 'hiddenWins'),
          employeeEcho: extractJsonStringValue(jsonSlice, 'employeeEcho'),
          choInsight: extractJsonStringValue(jsonSlice, 'choInsight')
        };
      }
    }
  } else {
    const loose = stripFences(raw);
    parsed = {
      status: extractJsonStringValue(loose, 'status'),
      blockers: extractJsonStringValue(loose, 'blockers'),
      hiddenWins: extractJsonStringValue(loose, 'hiddenWins'),
      employeeEcho: extractJsonStringValue(loose, 'employeeEcho'),
      choInsight: extractJsonStringValue(loose, 'choInsight')
    };
  }

  let safeEmployeeEcho = extractText(parsed.employeeEcho);
  let safeChoInsight = peelToChoInsightText(extractText(parsed.choInsight), extractJsonStringValue);
  if (!safeEmployeeEcho || safeEmployeeEcho.trim() === '') safeEmployeeEcho = raw.trim() ? raw.trim().slice(0, 4000) : '复盘已收到。好好休息，下周继续加油！';
  const choInsightFallback = () => {
    let inner = extractJsonStringValue(raw, 'choInsight');
    inner = peelToChoInsightText(inner || '', extractJsonStringValue);
    if (inner && inner.trim()) return inner.trim();
    const peeledRaw = peelToChoInsightText(stripFences(raw), extractJsonStringValue);
    if (peeledRaw && peeledRaw.trim() && peeledRaw.trim() !== raw.trim()) return peeledRaw.trim();
    if (parsed && typeof parsed.choInsight === 'string' && parsed.choInsight.trim()) return peelToChoInsightText(parsed.choInsight.trim(), extractJsonStringValue);
    return '【解析降级】模型返回未稳定解析为 JSON。请打开本条 automation 的 debugRaw 或在 n8n 执行记录里查看原文。\n\n摘要提示：可检查 Gemini 是否输出 markdown 代码块、或 choInsight 内是否含未转义英文双引号。';
  };
  if (!safeChoInsight || safeChoInsight.trim() === '') safeChoInsight = choInsightFallback();
  const looksLikeFullPayload = /^```/.test(safeChoInsight.trim()) ||
    /^\s*\{\s*"\s*status\s*"/i.test(safeChoInsight.trim()) ||
    (/^\s*\{/.test(safeChoInsight.trim()) && safeChoInsight.includes('"employeeEcho"') && safeChoInsight.includes('"choInsight"'));
  if (looksLikeFullPayload) safeChoInsight = choInsightFallback();
  safeChoInsight = peelToChoInsightText(safeChoInsight, extractJsonStringValue);
  safeChoInsight = stripTrailingJsonArtifacts(safeChoInsight);
  if (/^```/.test(safeChoInsight.trim()) || (/^\s*\{/.test(safeChoInsight.trim()) && /"\s*status\s*"\s*:/.test(safeChoInsight))) {
    safeChoInsight = '【解析异常】CHO 段落仍含整包 JSON，已拒绝原样下发。请查看本节点输出的 debugRaw；建议在 Gemini 节点启用 responseMimeType: application/json。';
  }
  safeChoInsight = stripTrailingJsonArtifacts(safeChoInsight);
  safeChoInsight = unescapeLiteralEscapes(safeChoInsight);
  safeEmployeeEcho = unescapeLiteralEscapes(safeEmployeeEcho);
  safeChoInsight = markdownToPlainChineseParagraphs(safeChoInsight);
  safeEmployeeEcho = markdownToPlainChineseParagraphs(safeEmployeeEcho);
  safeChoInsight = finalizeTextForLark(safeChoInsight);
  safeEmployeeEcho = finalizeTextForLark(safeEmployeeEcho);

  return {
    parsed,
    employeeEcho: safeEmployeeEcho,
    choInsight: safeChoInsight,
    debugRaw: raw
  };
}

function buildReviewPayloads(input) {
  const src = input.event && typeof input.event === 'object' ? { ...input.event, ...input } : input;
  const openId = firstValue(src, ['openId', 'open_id']);
  const employeeDisplayName = firstValue(src, ['employeeDisplayName', 'employee_display_name', 'employeeName', 'employee_name']) || '';
  const goalText = firstValue(src, ['goalText', 'goal_text']);
  const record = latestRecord(src);
  const required = { openId, employeeDisplayName, goalText, recordId: record.recordId };
  const missing = missingObject(required);
  if (missing) return missing;
  if (!rawModelText(input, ['reviewOutput', 'review_output', 'llmOutput', 'llm_output', 'modelOutput', 'model_output']).trim()) {
    return { needs_more_information: true, missing: ['reviewOutput'] };
  }

  const review = parseReviewAnalysis(input);
  const reviewFields = {
    周末总结原文: String(goalText || ''),
    目标完成状态: String(review.parsed.status || '未知'),
    组织阻力: String(review.parsed.blockers || ''),
    隐藏成就: String(review.parsed.hiddenWins || ''),
    辅导建议: review.choInsight
  };
  const choOpenId = String(firstValue(src, ['choOpenId', 'cho_open_id']) || DEFAULT_CHO_OPEN_ID);

  return {
    message_type: 'cho_weekly_goal_review_payloads',
    recordId: record.recordId,
    originalGoalText: record.originalGoalText,
    employeeEcho: review.employeeEcho,
    choInsight: review.choInsight,
    reviewFields,
    debugRaw: review.debugRaw,
    lark: {
      updateRecord: {
        resource: 'base',
        operation: 'updateRecord',
        app_token: appToken(),
        table_id: tableId(),
        record_id: record.recordId,
        body: { fields: reviewFields },
        options: {}
      },
      employeeMessage: {
        resource: 'message',
        operation: 'send',
        receive_id: larkId(openId),
        content: { text: `【周末复盘回响】\n\n${review.employeeEcho}` },
        options: {}
      },
      choMessage: {
        resource: 'message',
        operation: 'send',
        receive_id: larkFixedId(choOpenId),
        content: JSON.stringify({ text: `🚨【微观即时探针 - 个体动能诊断书】\n\n员工：${employeeDisplayName}\n\n${String(review.choInsight)}` }),
        options: {}
      }
    }
  };
}

function buildPayload(input) {
  resolvedAppToken = String(firstValue(input, ['appToken', 'app_token', 'baseAppToken', 'base_app_token']) || APP_TOKEN);
  resolvedTableId = String(firstValue(input, ['tableId', 'table_id', 'baseTableId', 'base_table_id']) || TABLE_ID);
  const mode = input.mode || 'parse_event';
  if (mode === 'parse_event') return parseEvent(input);
  if (mode === 'build_review_search') return buildReviewSearch(input);
  if (mode === 'build_audit_payloads') return buildAuditPayloads(input);
  if (mode === 'build_review_payloads') return buildReviewPayloads(input);
  return { skip: true, reason: `unsupported mode: ${mode}` };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildPayload(readInput()), null, 2)}\n`);
}

module.exports = { buildPayload };
