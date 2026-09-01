#!/usr/bin/env node
'use strict';

const fs = require('fs');

const BASE_RECORDS_PATH = '/open-apis/bitable/v1/apps/Z1FSb2bmFaDdlWsTen8lwtKLgyh/tables/tblCIDFBnAfPPUi7/records';
const MESSAGE_PATH = '/open-apis/im/v1/messages?receive_id_type=chat_id';
const GROUP_CHAT_ID = 'oc_922f242b5105f8f32c737c003d2f1b22';
const AUTO_GENERATED_SUFFIX = '\n\n【via lark-cli (auto-generated)】';

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

function pad2(value) {
  return String(value).padStart(2, '0');
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function daysFromCivil(year, month, day) {
  let y = year;
  y -= month <= 2 ? 1 : 0;
  const era = Math.trunc((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400;
  const m = month + (month > 2 ? -3 : 9);
  const doy = Math.trunc((153 * m + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.trunc(yoe / 4) - Math.trunc(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(days) {
  let z = days + 719468;
  const era = Math.trunc((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.trunc((doe - Math.trunc(doe / 1460) + Math.trunc(doe / 36524) - Math.trunc(doe / 146096)) / 365);
  let year = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.trunc(yoe / 4) - Math.trunc(yoe / 100));
  const mp = Math.trunc((5 * doy + 2) / 153);
  const day = doy - Math.trunc((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;
  return { year, month, day };
}

function parseDateOnly(value) {
  const raw = String(value || '').trim();
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateOnly) return null;
  const year = Number(dateOnly[1]);
  const month = Number(dateOnly[2]);
  const day = Number(dateOnly[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day, days: daysFromCivil(year, month, day) };
}

function formatDateOnly(civil) {
  if (!civil) return '';
  return `${civil.year}-${pad2(civil.month)}-${pad2(civil.day)}`;
}

function nextFridayFrom(todayValue) {
  const today = parseDateOnly(todayValue);
  if (!today) return '';
  const day = mod(today.days + 4, 7);
  const daysToFri = (5 - day + 7) % 7 || 7;
  return formatDateOnly(civilFromDays(today.days + daysToFri));
}

function daysUntil(deadlineValue, todayValue) {
  const deadline = parseDateOnly(deadlineValue || '');
  const today = parseDateOnly(todayValue);
  if (!deadline || !today) return Number.NaN;
  return deadline.days - today.days;
}

function larkTextMessage(text) {
  return {
    receive_id: GROUP_CHAT_ID,
    msg_type: 'text',
    content: JSON.stringify({ text: `${text}${AUTO_GENERATED_SUFFIX}` })
  };
}

function parseTaskArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const content = value.choices && value.choices[0] && value.choices[0].message
      ? value.choices[0].message.content
      : undefined;
    if (content !== undefined) return parseTaskArray(content);
    if (Array.isArray(value.tasks)) return value.tasks;
    return [value];
  }
  if (typeof value === 'string') {
    const clean = value.replace(/```json|```/g, '').trim();
    try {
      const parsed = JSON.parse(clean);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (_) {
      const match = clean.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return Array.isArray(parsed) ? parsed : [parsed];
      }
      throw new Error(`AI 返回格式无法解析: ${clean.substring(0, 200)}`);
    }
  }
  return undefined;
}

function taskInput(record) {
  return firstValue(record, ['tasks', 'aiTasks', 'extractedTasks', 'modelOutput', 'model_output', 'llmOutput', 'llm_output', 'groqResponse', 'groq_response']);
}

function priorityLabel(priority) {
  if (priority === 'high') return 'High';
  if (priority === 'medium') return 'Medium';
  return 'Low';
}

function normalizeTasks(rawTasks, meetingDate, weekFriday) {
  return rawTasks.map((task, index) => {
    const t = task || {};
    return {
      task_id: `TASK-${String(meetingDate || '').replace(/-/g, '')}-${String(index + 1).padStart(2, '0')}`,
      task: t.task || 'Unnamed',
      task_type: t.task_type || 'action_item',
      owner: t.owner || 'Unassigned',
      owner_role: t.owner_role || '',
      deadline: t.deadline || weekFriday,
      priority: t.priority || 'medium',
      infer_reason: t.infer_reason || '',
      source_quote: t.source_quote || '',
      has_inferred: (t.inferred_fields || []).length > 0,
      meeting_date: meetingDate
    };
  });
}

function buildBaseBodies(tasks) {
  return tasks.map((t) => ({
    fields: {
      Task: t.task,
      Owner: t.owner,
      Deadline: t.deadline,
      Priority: priorityLabel(t.priority),
      Status: 'Not Started',
      'Boss Quote': t.source_quote
    }
  }));
}

function typeLabel(taskType) {
  return taskType === 'boss_requirement' ? '【老板需求】' : '【执行任务】';
}

function buildTaskMessage(tasks, meetingDate, weekFriday) {
  const high = tasks.filter((t) => t.priority === 'high');
  const medium = tasks.filter((t) => t.priority === 'medium');
  const low = tasks.filter((t) => t.priority === 'low');
  let msg = '📋 本周任务清单\n';
  msg += `📅 会议日期：${meetingDate}\n`;
  msg += `${'─'.repeat(20)}\n`;
  let counter = 1;

  function appendGroup(group, heading) {
    if (group.length === 0) return;
    msg += heading;
    group.forEach((t) => {
      const deadlineLabel = t.deadline === weekFriday ? '本周五' : t.deadline;
      msg += `${counter}. ${typeLabel(t.task_type)} ${t.task}\n`;
      msg += `   👤 ${t.owner}　　📅 ${deadlineLabel}\n`;
      msg += `   💬 "${t.source_quote}"\n\n`;
      counter += 1;
    });
  }

  appendGroup(high, '\n🔴 P0 本周必须完成\n\n');
  appendGroup(medium, '🟡 P1 重要任务\n\n');
  appendGroup(low, '🟢 P2 一般任务\n\n');
  msg += `${'─'.repeat(20)}\n`;
  msg += `共 ${tasks.length} 个任务，完成后请更新多维表格 ✅`;
  return msg;
}

function buildTaskPayloads(input) {
  const record = source(input || {});
  const meetingDate = firstValue(record, ['Meeting Date', 'meetingDate', 'meeting_date', 'date']);
  const today = firstValue(record, ['today', 'runDate', 'run_date', 'executionDate', 'execution_date', 'currentDate', 'current_date']);
  const explicitFriday = firstValue(record, ['weekFriday', 'week_friday', 'fridayStr', 'friday_str', 'fallbackDeadline', 'fallback_deadline', 'defaultDeadline', 'default_deadline']);
  const rawTaskInput = taskInput(record);
  const missing = [];
  if (!meetingDate) missing.push('meetingDate');
  if (!rawTaskInput) missing.push('tasks');
  if (!explicitFriday && !today) missing.push('today');
  if (missing.length) return { needs_more_information: true, missing };

  const weekFriday = String(explicitFriday || nextFridayFrom(today)).trim();
  if (!weekFriday) return { needs_more_information: true, missing: ['today'] };
  const rawTasks = parseTaskArray(rawTaskInput);
  if (!rawTasks || rawTasks.length === 0) return { skip: true, reason: 'no tasks' };
  const tasks = normalizeTasks(rawTasks, String(meetingDate).trim(), weekFriday);
  const message = buildTaskMessage(tasks, String(meetingDate).trim(), weekFriday);
  const baseBodies = buildBaseBodies(tasks);
  return {
    message_type: 'lark_meeting_tasks',
    summary: `Meeting task payloads for ${String(meetingDate).trim()}`,
    meeting: {
      meetingDate: String(meetingDate).trim(),
      taskCount: tasks.length,
      chatId: GROUP_CHAT_ID,
      weekFriday
    },
    tasks,
    message,
    lark: {
      base: {
        path: BASE_RECORDS_PATH,
        bodies: baseBodies
      },
      message: {
        path: MESSAGE_PATH,
        body: larkTextMessage(message)
      }
    }
  };
}

function extractRecords(record) {
  if (Array.isArray(record.records)) return record.records;
  if (Array.isArray(record.items)) return record.items;
  if (record.data && Array.isArray(record.data.items)) return record.data.items;
  return undefined;
}

function reminderStatus(days, suffix) {
  if (days < 0) return 'OVERDUE';
  if (days === 0) return 'TODAY';
  return `${days}${suffix}`;
}

function buildReminderMessage(records, today) {
  const todayDate = parseDateOnly(today);
  const day = todayDate ? mod(todayDate.days + 4, 7) : Number.NaN;
  const isMonday = day === 1;
  const isWed = day === 3;
  const unfinished = records.filter((record) => record.fields && record.fields.Status !== 'Done');
  if (unfinished.length === 0) return { skip: true, reason: 'no unfinished tasks' };

  let msg = '';
  if (isMonday) {
    msg = 'Weekly Summary / 每周汇报 (Before meeting / 开会前)\n------------------------------\n\n';
    msg += `${unfinished.length} tasks unfinished / 项未完成:\n\n`;
    unfinished.forEach((record, index) => {
      const fields = record.fields || {};
      const days = daysUntil(fields.Deadline || '', today);
      msg += `${index + 1}. ${fields.Task || ''}\n   ${fields.Owner || ''} | ${reminderStatus(days, ' days left')}\n\n`;
    });
  } else {
    const label = isWed ? 'Mid-week Reminder / 周中提醒' : 'Deadline Reminder / 截止提醒';
    msg = `${label}\n------------------------------\n\n`;
    unfinished.slice(0, 8).forEach((record, index) => {
      const fields = record.fields || {};
      const days = daysUntil(fields.Deadline || '', today);
      msg += `${index + 1}. ${fields.Task || ''}\n   ${fields.Owner || ''} | ${reminderStatus(days, 'd left')}\n\n`;
    });
  }
  msg += 'Update Lark Base / 请更新多维表格状态';
  return { skip: false, message: msg, unfinishedCount: unfinished.length };
}

function buildReminderPayload(input) {
  const record = source(input || {});
  const today = firstValue(record, ['today', 'runDate', 'run_date', 'executionDate', 'execution_date', 'currentDate', 'current_date']);
  const records = extractRecords(record);
  const missing = [];
  if (!today) missing.push('today');
  if (!records) missing.push('records');
  if (missing.length) return { needs_more_information: true, missing };
  const reminder = buildReminderMessage(records, today);
  if (reminder.skip) return reminder;
  return {
    message_type: 'lark_meeting_reminder',
    summary: 'Meeting task reminder payload',
    skip: false,
    reminderMessage: reminder.message,
    unfinishedCount: reminder.unfinishedCount,
    lark: {
      message: {
        path: MESSAGE_PATH,
        body: larkTextMessage(reminder.message)
      }
    }
  };
}

function buildPayload(input) {
  const record = source(input || {});
  const mode = (input && input.mode) || (record && record.mode) || 'build_task_payloads';
  if (mode === 'build_reminder_payload') return buildReminderPayload(input);
  return buildTaskPayloads(input);
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildPayload(readInput()), null, 2)}\n`);
}

module.exports = { buildPayload };
