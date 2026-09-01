#!/usr/bin/env node
'use strict';

const fs = require('fs');

const MESSAGE_PATH = '/open-apis/im/v1/messages?receive_id_type=open_id';
const APPROVAL_PATH = '/open-apis/approval/v4/instances';
const APPROVAL_CODE = 'BC26F7AB-3D6F-4F8F-90D0-9AC951651F23';
const SG_REGION_VALUE = 'lworxu8i-sfhnu3wcjep-0';
const CN_REGION_VALUE = 'lworxu8i-aqegeg8xra8-0';
const CN_DEPARTMENT_IDS = [];
const DEFAULT_PARSE_FAILURE_REPLY = '抱歉没理解，请告诉我假期类型、开始日期、结束日期和原因。';
const AUTO_SUBMIT_NOTE = 'Bot自动提交，请假期间如有紧急事项请联系直属上司。';

const LEAVE_TYPE_MAP_SG = {
  'Annual Leave': '7372430614034694176',
  'Off in Lieu': '7372148222342512671',
  'Sick Leave': '7372150275550822432',
  'Unpaid Leave': '7372149064747515935',
  'Childcare Leave': '7373994238427529247',
  'Hospitalisation Leave': '7372147680094470176',
  'Reservist Leave': '7372146437582274591',
  'Maternity Leave': '7372151940576215072',
  'Paternity Leave': '7372153523011649567',
  'Marriage Leave': '7409935164769402911'
};

const LEAVE_TYPE_MAP_CN = {
  'Annual Leave': 'FILL_CN',
  'Sick Leave': 'FILL_CN'
};

function readInput() {
  const text = fs.readFileSync(0, 'utf8');
  return text.trim() ? JSON.parse(text) : {};
}

function source(input) {
  return input && input.body && typeof input.body === 'object' ? input.body : input;
}

function getPath(record, path) {
  if (!record || !path) return undefined;
  return String(path).split('.').reduce((value, part) => {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value) && /^\d+$/.test(part)) return value[Number(part)];
    return value[part];
  }, record);
}

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function firstValue(records, paths) {
  const list = Array.isArray(records) ? records : [records];
  for (const record of list) {
    for (const path of paths) {
      const value = getPath(record, path);
      if (present(value)) return value;
    }
  }
  return undefined;
}

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
  } catch (_) {
    return { has_all_info: false, reply_message: DEFAULT_PARSE_FAILURE_REPLY };
  }
}

function parseBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  return String(value).trim().toLowerCase() === 'true';
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map(item => String(item));
  if (!present(value)) return [];
  return [String(value)];
}

function messageBody(openId, text) {
  return {
    receive_id: openId,
    msg_type: 'text',
    content: JSON.stringify({ text })
  };
}

function eventBody(input) {
  return input && input.body && typeof input.body === 'object' ? input.body : input;
}

function parseEvent(input) {
  const body = eventBody(input || {});
  if (body && body.type === 'url_verification') {
    return {
      skip: true,
      is_challenge: true,
      challenge: body.challenge || '',
      webhookResponse: { challenge: body.challenge || '' }
    };
  }

  const eventType = firstValue(body, ['header.event_type', 'event.type']);
  if (eventType && !String(eventType).includes('message')) {
    return { skip: true, reason: 'not a message event' };
  }

  let messageText = '';
  try {
    messageText = JSON.parse(body.event.message.content).text || '';
  } catch (_) {
    messageText = '';
  }

  let openId = '';
  let userId = '';
  let chatId = '';
  try {
    openId = body.event.sender.sender_id.open_id || '';
  } catch (_) {
    openId = '';
  }
  try {
    userId = body.event.sender.sender_id.user_id || '';
  } catch (_) {
    userId = '';
  }
  try {
    chatId = body.event.message.chat_id || '';
  } catch (_) {
    chatId = '';
  }

  return { skip: false, messageText, openId, userId, chatId };
}

function modelResult(record) {
  const value = firstValue(record, [
    'aiResult',
    'ai_result',
    'llmResult',
    'llm_result',
    'modelOutput',
    'model_output',
    'leaveRequest',
    'leave_request'
  ]);
  return parseJsonObject(value) || record;
}

function normalizedBuildFields(input) {
  const record = source(input || {});
  const roots = [record, input || {}];
  const ai = modelResult(record);
  const userInfo = firstValue(record, ['userInfo', 'user_info', 'contactUser', 'contact_user']);
  const userRoots = [parseJsonObject(userInfo) || {}, record, input || {}];

  return {
    openId: firstValue(roots, [
      'openId',
      'open_id',
      'senderOpenId',
      'sender_open_id',
      'msgInfo.openId',
      'messageInfo.openId',
      'event.sender.sender_id.open_id'
    ]),
    userId: firstValue(userRoots, [
      'user_id',
      'userId',
      'employeeUserId',
      'employee_user_id',
      'msgInfo.userId',
      'messageInfo.userId',
      'event.sender.sender_id.user_id'
    ]),
    leaderUserId: firstValue(userRoots, [
      'leader_user_id',
      'leaderUserId',
      'managerUserId',
      'manager_user_id'
    ]),
    departmentIds: normalizeArray(firstValue(userRoots, [
      'department_ids',
      'departmentIds'
    ])),
    hasAllInfoRaw: firstValue(ai, ['has_all_info', 'hasAllInfo']),
    leaveTypeName: firstValue(ai, ['leave_type_name', 'leaveTypeName']),
    startDate: firstValue(ai, ['start_date', 'startDate']),
    endDate: firstValue(ai, ['end_date', 'endDate']),
    days: firstValue(ai, ['days']),
    reason: firstValue(ai, ['reason']),
    replyMessage: firstValue(ai, ['reply_message', 'replyMessage'])
  };
}

function missingFields(fields, names) {
  return names.filter(name => !present(fields[name]));
}

function buildForm(fields, regionValue, leaveTypeId) {
  return [
    {
      id: 'widgetLeaveGroupV2',
      type: 'leaveGroupV2',
      value: [
        { id: 'widgetLeaveGroupType', type: 'radioV2', value: leaveTypeId },
        { id: 'widgetLeaveGroupStartTime', type: 'date', value: `${fields.startDate || ''}T09:00:00+08:00` },
        { id: 'widgetLeaveGroupEndTime', type: 'date', value: `${fields.endDate || ''}T18:00:00+08:00` },
        { id: 'widgetLeaveGroupInterval', type: 'radioV2', value: 'DAY' },
        { id: 'widgetLeaveGroupUnit', type: 'radioV2', value: 'DAY' },
        { id: 'widgetLeaveGroupReason', type: 'input', value: fields.reason || '' },
        { id: 'widgetLeaveCertification', type: 'image', value: [] }
      ]
    },
    { id: 'widget17168025974580001', type: 'radioV2', value: regionValue },
    { id: 'widget17167999750490001', type: 'text', value: '' },
    { id: 'widget17542769722230001', type: 'contact', value: [fields.leaderUserId] },
    { id: 'widget17362411277050001', type: 'contact', value: [fields.userId] },
    { id: 'widget17167999853160001', type: 'input', value: AUTO_SUBMIT_NOTE }
  ];
}

function buildPayloads(input) {
  const fields = normalizedBuildFields(input || {});
  if (!present(fields.hasAllInfoRaw)) {
    return { needs_more_information: true, missing: ['has_all_info'] };
  }

  const hasAllInfo = parseBoolean(fields.hasAllInfoRaw);
  if (!hasAllInfo) {
    const missing = missingFields(fields, ['openId', 'replyMessage']);
    if (missing.length) return { needs_more_information: true, missing };
    return {
      message_type: 'lark_hr_leave_more_info_message',
      has_all_info: false,
      lark: {
        path: MESSAGE_PATH,
        moreInfoBody: messageBody(String(fields.openId).trim(), String(fields.replyMessage))
      }
    };
  }

  const missing = missingFields(fields, [
    'openId',
    'userId',
    'leaderUserId',
    'leaveTypeName',
    'startDate',
    'endDate',
    'reason',
    'replyMessage'
  ]);
  if (missing.length) return { needs_more_information: true, missing };

  const isCN = fields.departmentIds.some(id => CN_DEPARTMENT_IDS.includes(id));
  const regionValue = isCN ? CN_REGION_VALUE : SG_REGION_VALUE;
  const leaveMap = isCN ? LEAVE_TYPE_MAP_CN : LEAVE_TYPE_MAP_SG;
  const leaveTypeId = leaveMap[String(fields.leaveTypeName).trim()] || '';
  if (!leaveTypeId) {
    return {
      needs_more_information: true,
      missing: ['leaveTypeId'],
      unsupported_leave_type_name: String(fields.leaveTypeName).trim()
    };
  }

  const normalized = {
    openId: String(fields.openId).trim(),
    userId: String(fields.userId).trim(),
    leaderUserId: String(fields.leaderUserId).trim(),
    leave_type_name: String(fields.leaveTypeName).trim(),
    leaveTypeId,
    regionValue,
    start_date: String(fields.startDate).trim(),
    end_date: String(fields.endDate).trim(),
    days: present(fields.days) ? fields.days : null,
    reason: String(fields.reason),
    reply_message: String(fields.replyMessage)
  };
  const form = buildForm({
    startDate: normalized.start_date,
    endDate: normalized.end_date,
    reason: normalized.reason,
    userId: normalized.userId,
    leaderUserId: normalized.leaderUserId
  }, normalized.regionValue, normalized.leaveTypeId);
  const formJson = JSON.stringify(form);
  const successText = `✅ 审批已提交！\n\n${normalized.reply_message}\n\n请等待审批结果通知。`;

  return {
    message_type: 'lark_hr_leave_approval',
    summary: `HR leave approval for ${normalized.userId} from ${normalized.start_date} to ${normalized.end_date}`,
    leaveRequest: normalized,
    form,
    formJson,
    lark: {
      approvalPath: APPROVAL_PATH,
      approvalBody: {
        approval_code: APPROVAL_CODE,
        user_id: normalized.userId,
        user_id_type: 'user_id',
        form: formJson
      },
      messagePath: MESSAGE_PATH,
      successBody: messageBody(normalized.openId, successText)
    }
  };
}

function buildPayload(input) {
  const mode = input && input.mode ? String(input.mode) : 'build_payloads';
  if (mode === 'parse_event') return parseEvent(input || {});
  if (mode === 'build_payloads') return buildPayloads(input || {});
  return { skip: true, reason: `unsupported mode: ${mode}` };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildPayload(readInput()), null, 2)}\n`);
}

module.exports = { buildPayload };
