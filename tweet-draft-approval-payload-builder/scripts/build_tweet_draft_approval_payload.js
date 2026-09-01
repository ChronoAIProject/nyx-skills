#!/usr/bin/env node
'use strict';

const fs = require('fs');

const LARK_MESSAGE_PATH = '/open-apis/im/v1/messages?receive_id_type=chat_id';
const ADMIN_OPEN_ID_LITERAL = 'ou_PLACEHOLDER_OPEN_ID_1';

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

function missingFields(record, names) {
  return names.filter((name) => {
    const value = record ? record[name] : undefined;
    return value === undefined || value === null || String(value).trim() === '';
  });
}

function larkMessageBody(chatId, msgType, contentObject) {
  return {
    receive_id: chatId,
    msg_type: msgType,
    content: JSON.stringify(contentObject)
  };
}

function parseMessageContent(content) {
  const raw = content === undefined || content === null ? '' : String(content);
  try {
    const parsed = JSON.parse(raw);
    return String(parsed.text || '').replace(/^@_user_\d+\s*/g, '').trim();
  } catch (_) {
    return raw;
  }
}

function parseEvent(input) {
  const body = source(input || {});
  if (body.type === 'url_verification' || body.challenge) {
    return {
      skip: true,
      is_challenge: true,
      challenge: body.challenge || '',
      webhook: {
        responseBody: { challenge: body.challenge || '' }
      }
    };
  }

  let isCard = 'false';
  let action = '';
  let chatId = '';
  let employeeId = '';
  let tweetDraft = '';

  if (body.action && body.action.value) {
    isCard = 'true';
    action = body.action.value.action || '';
    chatId = body.action.value.chat_id || '';
    employeeId = body.action.value.employee_id || '';
    tweetDraft = body.action.value.tweet_draft || '';
  } else if (body.event && body.event.action && body.event.action.value) {
    isCard = 'true';
    action = body.event.action.value.action || '';
    chatId = body.event.action.value.chat_id || '';
    employeeId = body.event.action.value.employee_id || '';
    tweetDraft = body.event.action.value.tweet_draft || '';
  } else if (body.event && body.event.message) {
    isCard = 'false';
    chatId = body.event.message.chat_id || '';
    if (body.event.sender && body.event.sender.sender_id) {
      employeeId = body.event.sender.sender_id.open_id || '';
    }
    tweetDraft = parseMessageContent(body.event.message.content);
  } else {
    return { skip: true, reason: 'not a Lark message or card action event' };
  }

  return {
    skip: false,
    is_card: isCard,
    action,
    chat_id: chatId,
    employee_id: employeeId,
    tweet_draft: tweetDraft
  };
}

function cleanAiOutput(output) {
  return String(output || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();
}

function parseAiResult(input) {
  const record = input || {};
  const output = firstValue(record, ['ai_output', 'aiOutput', 'text', 'output']) || '';
  let status = 'REJECTED';
  let report = 'AI 输出格式解析失败。';

  try {
    const parsed = JSON.parse(cleanAiOutput(output));
    status = parsed.status || 'REJECTED';
    report = parsed.report || output;
  } catch (_) {
    const raw = String(output || '');
    const statusMatch = raw.match(/"status"\s*:\s*"([^"]+)"/i);
    if (statusMatch) status = statusMatch[1];

    const reportMatch = raw.match(/"report"\s*:\s*"([\s\S]*)"\s*\}/i);
    if (reportMatch) {
      report = reportMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } else {
      report = `【AI 返回了非标准格式，以下为原始输出】\n\n${raw}`;
    }
  }

  const parsed = {
    status,
    report,
    chat_id: firstValue(record, ['chat_id', 'chatId']) || '',
    employee_id: firstValue(record, ['employee_id', 'employeeId', 'open_id', 'openId']) || '',
    tweet_draft: firstValue(record, ['tweet_draft', 'tweetDraft', 'draft']) || ''
  };

  return parsed;
}

function normalizeReviewInput(input) {
  const parsedAi = firstValue(input, ['status', 'report']) ? input : parseAiResult(input);
  return {
    status: firstValue(parsedAi, ['status']) || 'REJECTED',
    report: firstValue(parsedAi, ['report']) || '',
    chat_id: firstValue(parsedAi, ['chat_id', 'chatId']) || '',
    employee_id: firstValue(parsedAi, ['employee_id', 'employeeId', 'open_id', 'openId']) || '',
    tweet_draft: firstValue(parsedAi, ['tweet_draft', 'tweetDraft', 'draft']) || ''
  };
}

function aiRejectedPost(report) {
  return {
    zh_cn: {
      title: 'AI审计未通过',
      content: [
        [
          { tag: 'text', text: `你的推文未通过审计，请按建议修改后重提。\n\n${report}` }
        ]
      ]
    }
  };
}

function adminReviewCard(record) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '✅ AI审计通过，等待管理员复核' },
      template: 'blue'
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**发起人**：<at id="${record.employee_id}"></at>\n**拟发布内容**：\n${record.tweet_draft}`
        }
      },
      { tag: 'hr' },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**AI审计报告**：\n${record.report}`
        }
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '同意发布' },
            type: 'primary',
            value: {
              action: 'approve',
              chat_id: record.chat_id,
              employee_id: record.employee_id,
              tweet_draft: record.tweet_draft
            }
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '驳回重写' },
            type: 'danger',
            value: {
              action: 'reject',
              chat_id: record.chat_id,
              employee_id: record.employee_id,
              tweet_draft: record.tweet_draft
            }
          }
        ]
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `请管理员审批：<at id="${firstValue(record, ['admin_open_id', 'adminOpenId', 'admin_id']) || ADMIN_OPEN_ID_LITERAL}"></at>`
        }
      }
    ]
  };
}

function buildAiReviewPayload(input) {
  const record = normalizeReviewInput(input || {});
  const missing = missingFields(record, ['chat_id', 'employee_id', 'tweet_draft', 'report']);
  if (missing.length) return { needs_more_information: true, missing };

  if (record.status === 'APPROVED') {
    const card = adminReviewCard(record);
    return {
      message_type: 'lark_interactive_message',
      stage: 'ai_approved_admin_review',
      summary: 'Tweet draft passed AI audit; admin review card ready.',
      status: record.status,
      report: record.report,
      lark: {
        path: LARK_MESSAGE_PATH,
        body: larkMessageBody(record.chat_id, 'interactive', card)
      },
      card
    };
  }

  const post = aiRejectedPost(record.report);
  return {
    message_type: 'lark_post_message',
    stage: 'ai_rejected',
    summary: 'Tweet draft failed AI audit; rejection message ready.',
    status: record.status,
    report: record.report,
    lark: {
      path: LARK_MESSAGE_PATH,
      body: larkMessageBody(record.chat_id, 'post', post)
    },
    post
  };
}

function normalizeAdminInput(input) {
  const record = source(input || {});
  if (record.event || (record.action && typeof record.action === 'object')) {
    const parsed = parseEvent(input);
    if (parsed.skip || parsed.needs_more_information) return parsed;
    return parsed;
  }

  return {
    skip: false,
    is_card: 'true',
    action: firstValue(record, ['action']) || '',
    chat_id: firstValue(record, ['chat_id', 'chatId']) || '',
    employee_id: firstValue(record, ['employee_id', 'employeeId', 'open_id', 'openId']) || '',
    tweet_draft: firstValue(record, ['tweet_draft', 'tweetDraft', 'draft']) || ''
  };
}

function adminApprovedPost(record) {
  return {
    zh_cn: {
      title: '🎉 审批通过，可以发布！',
      content: [
        [
          { tag: 'at', user_id: record.employee_id },
          { tag: 'text', text: ` 管理员已同意，请手动发布以下内容：\n\n${record.tweet_draft}` }
        ]
      ]
    }
  };
}

function adminRejectedPost(record) {
  return {
    zh_cn: {
      title: '🛑 管理员已驳回',
      content: [
        [
          { tag: 'at', user_id: record.employee_id },
          { tag: 'text', text: ' 你的推文草稿已被管理员驳回，请按要求修改后重新发送。' }
        ]
      ]
    }
  };
}

function buildAdminActionPayload(input) {
  const record = normalizeAdminInput(input || {});
  if (record.skip || record.needs_more_information) return record;
  if (record.is_card !== 'true') return { skip: true, reason: 'not an admin card action' };

  const missing = missingFields(record, ['action', 'chat_id', 'employee_id', 'tweet_draft']);
  if (missing.length) return { needs_more_information: true, missing };

  const approved = record.action === 'approve';
  const post = approved ? adminApprovedPost(record) : adminRejectedPost(record);
  return {
    message_type: 'lark_post_message',
    stage: approved ? 'admin_approved' : 'admin_rejected',
    summary: approved ? 'Admin approved tweet draft; publish notification ready.' : 'Admin rejected tweet draft; rewrite notification ready.',
    action: record.action,
    lark: {
      path: LARK_MESSAGE_PATH,
      body: larkMessageBody(record.chat_id, 'post', post)
    },
    post
  };
}

function buildAuto(input) {
  const parsed = parseEvent(input || {});
  if (parsed.skip || parsed.needs_more_information) return parsed;
  if (parsed.is_card === 'true') return buildAdminActionPayload(parsed);
  return parsed;
}

function buildPayload(input) {
  const mode = (input && input.mode) || 'build_ai_review_payload';
  if (mode === 'parse_event') return parseEvent(input);
  if (mode === 'parse_ai_result') return parseAiResult(input || {});
  if (mode === 'build_admin_action_payload') return buildAdminActionPayload(input || {});
  if (mode === 'auto') return buildAuto(input || {});
  return buildAiReviewPayload(input || {});
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildPayload(readInput()), null, 2)}\n`);
}

module.exports = { buildPayload };
