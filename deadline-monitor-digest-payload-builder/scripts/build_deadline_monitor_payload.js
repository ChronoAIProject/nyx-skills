#!/usr/bin/env node
'use strict';

const fs = require('fs');

function readInput() {
  const text = fs.readFileSync(0, 'utf8');
  return text.trim() ? JSON.parse(text) : {};
}

function source(input) {
  return input && input.body && typeof input.body === 'object' ? input.body : input;
}

function own(record, name) {
  return Object.prototype.hasOwnProperty.call(record || {}, name);
}

function valueFor(record, names) {
  for (const name of names) {
    if (own(record, name)) return { found: true, value: record[name] };
  }
  return { found: false, value: undefined };
}

function firstValue(record, names) {
  for (const name of names) {
    const value = record ? record[name] : undefined;
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

function flattenRecords(value, repoHint) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.flatMap(item => flattenRecords(item, repoHint));
  if (typeof value !== 'object') return [];
  const hint = firstValue(value, ['repo', 'repository', 'repositoryFullName', 'repoName']) || repoHint;
  if (own(value, 'json')) return flattenRecords(value.json, hint);
  if (Array.isArray(value.items)) return flattenRecords(value.items, hint);
  if (Array.isArray(value.milestones)) return flattenRecords(value.milestones, hint);
  if (Array.isArray(value.issues)) return flattenRecords(value.issues, hint);
  const record = { ...value };
  if (!record.repo && hint) record.repo = hint;
  return [record];
}

function recordsFrom(record, names) {
  const found = valueFor(record || {}, names);
  if (!found.found) return { found: false, records: [] };
  return { found: true, records: flattenRecords(found.value) };
}

function dateOnly(value) {
  if (value === undefined || value === null || String(value).trim() === '') return '';
  return String(value).trim().substring(0, 10);
}

function localDate(value) {
  const text = dateOnly(value);
  if (!text) return null;
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function subtractDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() - days);
  return copy;
}

function daysRemaining(dueOn, today) {
  const due = localDate(dueOn);
  const now = localDate(today);
  if (!due || !now) return null;
  return Math.ceil((due - now) / 86400000);
}

function parseFullRepoFromGithubUrl(url) {
  if (!url) return '';
  const parts = String(url).replace('https://github.com/', '').split('/');
  return parts.slice(0, 2).join('/');
}

function parseRepoNameFromGithubUrl(url) {
  if (!url) return '';
  const parts = String(url).replace('https://github.com/', '').split('/');
  return parts[1] || '';
}

function webhookBody(message) {
  return { msg_type: 'text', content: { text: message } };
}

function withWebhookPayload(base, message) {
  const body = webhookBody(message);
  return {
    ...base,
    message,
    larkBody: JSON.stringify(body),
    lark: { body }
  };
}

function requireToday(record) {
  const today = firstValue(record, ['today', 'date', 'runDate', 'run_date', 'todayStr']);
  if (!today) return { error: { needs_more_information: true, missing: ['today'] } };
  const normalized = dateOnly(today);
  if (!localDate(normalized)) return { error: { needs_more_information: true, missing: ['today'] } };
  return { today: normalized };
}

function computeDailyRisks(milestones, today) {
  const results = [];
  for (const ms of milestones) {
    if (!ms || ms.noRisks || !ms.due_on || !ms.html_url) continue;
    const remaining = daysRemaining(ms.due_on, today);
    if (remaining === null) continue;
    const openIssues = Number(ms.open_issues || 0);
    let riskLevel = null;
    let riskEmoji = '';
    let riskMsg = '';
    if (remaining < 0) {
      riskLevel = 'OVERDUE';
      riskEmoji = '⚫';
      riskMsg = `已逾期 ${Math.abs(remaining)} 天，仍有 ${openIssues} 个 Issues 未完成`;
    } else if (remaining <= 3 && openIssues > 0) {
      riskLevel = 'CRITICAL';
      riskEmoji = '🔴';
      riskMsg = `距 deadline 仅剩 ${remaining} 天，还有 ${openIssues} 个 Issues 未完成`;
    }
    if (riskLevel) {
      results.push({
        repo: parseFullRepoFromGithubUrl(ms.html_url),
        riskLevel,
        riskEmoji,
        riskMsg,
        milestoneTitle: ms.title,
        milestoneUrl: ms.html_url,
        dueDate: dateOnly(ms.due_on),
        daysRemaining: remaining,
        openIssues
      });
    }
  }
  return results;
}

function normalizeRisk(item, index) {
  const milestoneUrl = firstValue(item, ['milestoneUrl', 'milestone_url', 'html_url', 'url']);
  const due = firstValue(item, ['dueDate', 'due_date', 'due_on']);
  const openIssues = Number(firstValue(item, ['openIssues', 'open_issues']) || 0);
  const remaining = firstValue(item, ['daysRemaining', 'days_remaining']);
  const riskLevel = firstValue(item, ['riskLevel', 'risk_level']);
  const repo = firstValue(item, ['repo', 'repository']) || parseFullRepoFromGithubUrl(milestoneUrl);
  const milestoneTitle = firstValue(item, ['milestoneTitle', 'milestone_title', 'title']);
  let riskMsg = firstValue(item, ['riskMsg', 'risk_msg']);
  if (!riskMsg && riskLevel === 'OVERDUE' && remaining !== undefined) {
    riskMsg = `已逾期 ${Math.abs(Number(remaining))} 天，仍有 ${openIssues} 个 Issues 未完成`;
  }
  if (!riskMsg && riskLevel === 'CRITICAL' && remaining !== undefined) {
    riskMsg = `距 deadline 仅剩 ${Number(remaining)} 天，还有 ${openIssues} 个 Issues 未完成`;
  }
  const missing = [];
  if (!repo) missing.push(`risks[${index}].repo`);
  if (!riskLevel) missing.push(`risks[${index}].riskLevel`);
  if (!milestoneTitle) missing.push(`risks[${index}].milestoneTitle`);
  if (!due) missing.push(`risks[${index}].dueDate`);
  if (!riskMsg) missing.push(`risks[${index}].riskMsg`);
  if (!milestoneUrl) missing.push(`risks[${index}].milestoneUrl`);
  return {
    missing,
    item: {
      repo: String(repo || ''),
      riskLevel: String(riskLevel || ''),
      riskMsg: String(riskMsg || ''),
      milestoneTitle: String(milestoneTitle || ''),
      milestoneUrl: String(milestoneUrl || ''),
      dueDate: dateOnly(due),
      openIssues
    }
  };
}

function buildDailyRiskDigest(record) {
  const todayResult = requireToday(record);
  if (todayResult.error) return todayResult.error;
  const today = todayResult.today;
  const riskSource = recordsFrom(record, ['risks', 'riskItems', 'risk_items']);
  const milestoneSource = recordsFrom(record, ['milestones', 'items']);
  if (!riskSource.found && !milestoneSource.found) {
    return { needs_more_information: true, missing: ['risks_or_milestones'] };
  }
  const rawRisks = riskSource.found ? riskSource.records : computeDailyRisks(milestoneSource.records, today);
  const normalized = [];
  const missing = [];
  rawRisks.forEach((risk, index) => {
    const result = normalizeRisk(risk, index);
    missing.push(...result.missing);
    normalized.push(result.item);
  });
  if (missing.length) return { needs_more_information: true, missing };
  const risks = normalized.filter(item => item.riskLevel === 'OVERDUE' || item.riskLevel === 'CRITICAL');
  if (risks.length === 0) return { skip: true, reason: 'no deadline risks' };

  const overdueItems = risks.filter(item => item.riskLevel === 'OVERDUE');
  const criticalItems = risks.filter(item => item.riskLevel === 'CRITICAL');
  const totalRisks = overdueItems.length + criticalItems.length;
  const sep = '================================';
  const lines = [];
  lines.push('🚨 Chrono AI | 紧急预警 | 需立即处理');
  lines.push(`📅 ${today}   ⛔ 共 ${totalRisks} 个紧急任务`);
  lines.push(sep);
  if (overdueItems.length > 0) {
    lines.push('');
    lines.push('⚫ OVERDUE 已逾期 — 立即上报！');
    overdueItems.forEach(item => {
      lines.push(`  ▸ ${item.repo}`);
      lines.push(`    📌 ${item.milestoneTitle}  (due: ${item.dueDate})`);
      lines.push(`    ❗ ${item.riskMsg}`);
      lines.push(`    ${item.milestoneUrl}`);
    });
  }
  if (criticalItems.length > 0) {
    lines.push('');
    lines.push('🔴 CRITICAL — 3 天内到期，还有未完成 Issues！');
    criticalItems.forEach(item => {
      lines.push(`  ▸ ${item.repo}`);
      lines.push(`    📌 ${item.milestoneTitle}  (due: ${item.dueDate})`);
      lines.push(`    ❗ ${item.riskMsg}`);
      lines.push(`    ${item.milestoneUrl}`);
    });
  }
  lines.push('');
  lines.push(sep);
  lines.push('⏰ 相关负责人今日内必须与 leader 同步方案！');
  lines.push('📝 进度落后但未逾期？→ 本人会收到私信 Check-in，无需在此回复。');

  return withWebhookPayload({
    message_type: 'deadline_daily_risk_digest',
    summary: `Deadline emergency digest for ${totalRisks} risk(s)`,
    totalRisks,
    overdueCount: overdueItems.length,
    criticalCount: criticalItems.length,
    risks
  }, lines.join('\n'));
}

function buildOrphanMilestoneDigest(record) {
  const todayResult = requireToday(record);
  if (todayResult.error) return todayResult.error;
  const today = todayResult.today;
  if (record.noOrphans === true) return { skip: true, reason: 'no orphan issues' };
  const issueSource = recordsFrom(record, ['issues', 'openIssues', 'open_issues', 'items']);
  if (!issueSource.found) return { needs_more_information: true, missing: ['issues'] };

  const repoCount = {};
  let total = 0;
  for (const issue of issueSource.records) {
    if (!issue || issue.milestone || !issue.number || !issue.html_url) continue;
    const repo = parseRepoNameFromGithubUrl(issue.html_url);
    repoCount[repo] = (repoCount[repo] || 0) + 1;
    total++;
  }
  if (total === 0) return { skip: true, reason: 'no orphan issues' };

  const sorted = Object.entries(repoCount).sort((a, b) => b[1] - a[1]);
  const sep = '================================';
  const lines = [];
  lines.push('📋 每周提醒 | 无 Deadline 任务');
  lines.push(`📅 ${today}   共 ${total} 个 Issues 未分配 Milestone`);
  lines.push(sep);
  lines.push('');
  lines.push('按 Repo 汇总（Issues 数量最多的排前）：');
  lines.push('');
  sorted.slice(0, 15).forEach(([repo, count]) => {
    lines.push(`  ${repo.padEnd(30)}${count} 个  ${'▪'.repeat(Math.min(count, 10))}`);
  });
  if (sorted.length > 15) lines.push(`  ...还有 ${sorted.length - 15} 个 repo 也有未分配任务`);
  lines.push('');
  lines.push(sep);
  lines.push('⏰ 各 leader 请 48h 内为自己 repo 分配 Milestone！');
  lines.push('📌 没有 Milestone = 监控盲区 = 出问题 HR 不知道');

  return withWebhookPayload({
    message_type: 'deadline_orphan_milestone_digest',
    summary: `No-milestone digest for ${total} issue(s)`,
    total,
    repoCount: sorted.length,
    repoCounts: sorted.map(([repo, count]) => ({ repo, count }))
  }, lines.join('\n'));
}

function buildFridayProgressReport(record) {
  const todayResult = requireToday(record);
  if (todayResult.error) return todayResult.error;
  const today = todayResult.today;
  const milestoneSource = recordsFrom(record, ['milestones', 'items']);
  if (!milestoneSource.found) return { needs_more_information: true, missing: ['milestones'] };

  const todayDate = localDate(today);
  const oneWeekAgo = subtractDays(todayDate, 7);
  let completedCount = 0;
  let overdueCount = 0;
  let upcomingCount = 0;
  const overdueList = [];
  const upcomingList = [];

  for (const ms of milestoneSource.records) {
    if (!ms || !ms.title) continue;
    const repo = String(firstValue(ms, ['repo', 'repository']) || 'unknown');
    if (ms.state === 'closed' && ms.closed_at && new Date(ms.closed_at) >= oneWeekAgo) completedCount++;
    if (ms.state === 'open' && ms.due_on) {
      const remaining = daysRemaining(ms.due_on, today);
      if (remaining === null) continue;
      const openIssues = Number(ms.open_issues || 0);
      const repoName = repo.replace('ChronoAIProject/', '');
      if (remaining < 0 && openIssues > 0) {
        overdueCount++;
        overdueList.push(`• ${repoName} — ${ms.title}`);
      } else if (remaining >= 0 && remaining <= 7 && openIssues > 0) {
        upcomingCount++;
        upcomingList.push(`• ${repoName} — ${ms.title}（${remaining}天后到期）`);
      }
    }
  }

  const sep = '================================';
  const lines = [];
  lines.push('📊 Chrono AI | 周五进度复盘');
  lines.push(`📅 ${today}   本周总结`);
  lines.push(sep);
  lines.push('');
  lines.push(`✅ 本周完成 Milestone：${completedCount} 个`);
  lines.push(`⚫ 当前逾期 Milestone：${overdueCount} 个${overdueCount > 0 ? '  ← ⚠️ 需关注！' : '  ✓ 无逾期'}`);
  lines.push(`🔴 下周到期 Milestone：${upcomingCount} 个${upcomingCount > 0 ? '  ← 准备好了吗？' : '  ✓ 暂无'}`);
  if (overdueList.length > 0) {
    lines.push('');
    lines.push('【逾期中 — 需立即处理】');
    overdueList.slice(0, 5).forEach(item => lines.push(item));
    if (overdueList.length > 5) lines.push(`  ...还有 ${overdueList.length - 5} 个`);
  }
  if (upcomingList.length > 0) {
    lines.push('');
    lines.push('【下周到期 — 提前确认进度】');
    upcomingList.slice(0, 5).forEach(item => lines.push(item));
    if (upcomingList.length > 5) lines.push(`  ...还有 ${upcomingList.length - 5} 个`);
  }
  lines.push('');
  lines.push(sep);
  lines.push('⏰ 今天下班前请与 leader 同步进度！');

  return withWebhookPayload({
    message_type: 'deadline_friday_progress_report',
    summary: `Friday deadline progress report for ${today}`,
    completedCount,
    overdueCount,
    upcomingCount,
    overdueList,
    upcomingList
  }, lines.join('\n'));
}

function normalizeCheckin(item, index) {
  const fields = {
    issueNumber: firstValue(item, ['issueNumber', 'issue_number', 'number']),
    issueTitle: firstValue(item, ['issueTitle', 'issue_title', 'title']),
    issueUrl: firstValue(item, ['issueUrl', 'issue_url', 'html_url', 'url']),
    repo: firstValue(item, ['repo', 'repository']),
    assigneeLogin: firstValue(item, ['assigneeLogin', 'assignee_login', 'assignee']),
    larkUserId: firstValue(item, ['larkUserId', 'lark_user_id', 'user_id', 'userId']),
    dueDate: firstValue(item, ['dueDate', 'due_date', 'due_on']),
    tPercent: firstValue(item, ['tPercent', 't_percent'])
  };
  const missing = Object.entries(fields)
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
    .map(([key]) => `checkins[${index}].${key}`);
  return { missing, fields };
}

function buildCheckinPayloads(record) {
  if (record.noCheckins === true) return { skip: true, reason: 'no check-in tasks' };
  const checkinSource = recordsFrom(record, ['checkins', 'checkinItems', 'checkin_items', 'items']);
  if (!checkinSource.found) return { needs_more_information: true, missing: ['checkins'] };
  if (checkinSource.records.length === 0) return { skip: true, reason: 'no check-in tasks' };

  const missing = [];
  const items = checkinSource.records.map((item, index) => {
    const normalized = normalizeCheckin(item, index);
    missing.push(...normalized.missing);
    const d = normalized.fields;
    const msgText = `[Deadline 提醒] ${d.issueTitle}\n\n` +
      `Hi ${d.assigneeLogin}，你负责的「${d.issueTitle}」已经过了一半时间，deadline 是 ${dateOnly(d.dueDate)}。\n\n` +
      '如果进度有变化或需要调整 deadline，在 issue 下更新一下就好：\n' +
      `${d.issueUrl}\n\n` +
      '不需要回复这条消息。';
    const larkBody = {
      receive_id: String(d.larkUserId || ''),
      msg_type: 'text',
      content: JSON.stringify({ text: msgText })
    };
    const commentText = `⏰ **Deadline 提醒**\n\n此任务已过一半时间（T=${d.tPercent}%），deadline 是 **${dateOnly(d.dueDate)}**。\n\n如进度有变化或需要调整 deadline，请在此回复更新。不需要另外发消息给 HR。`;
    const githubBody = { body: commentText };
    return {
      issueNumber: Number(d.issueNumber),
      issueTitle: String(d.issueTitle || ''),
      issueUrl: String(d.issueUrl || ''),
      repo: String(d.repo || ''),
      assigneeLogin: String(d.assigneeLogin || ''),
      larkUserId: String(d.larkUserId || ''),
      dueDate: dateOnly(d.dueDate),
      tPercent: Number(d.tPercent),
      message: msgText,
      larkMsgBody: JSON.stringify(larkBody),
      githubCommentBody: JSON.stringify(githubBody),
      lark: {
        path: '/open-apis/im/v1/messages?receive_id_type=user_id',
        body: larkBody
      },
      github: {
        path: `/repos/${d.repo}/issues/${d.issueNumber}/comments`,
        body: githubBody
      }
    };
  });
  if (missing.length) return { needs_more_information: true, missing };
  return {
    message_type: 'deadline_checkin_payloads',
    summary: `Deadline check-in payloads for ${items.length} issue(s)`,
    count: items.length,
    items
  };
}

function buildPayload(input) {
  const record = source(input || {});
  const mode = String((input && input.mode) || (record && record.mode) || 'daily_risk_digest');
  if (mode === 'daily_risk_digest') return buildDailyRiskDigest(record || {});
  if (mode === 'orphan_milestone_digest') return buildOrphanMilestoneDigest(record || {});
  if (mode === 'friday_progress_report') return buildFridayProgressReport(record || {});
  if (mode === 'checkin_payloads') return buildCheckinPayloads(record || {});
  return { needs_more_information: true, missing: ['mode'], supported_modes: ['daily_risk_digest', 'orphan_milestone_digest', 'friday_progress_report', 'checkin_payloads'] };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildPayload(readInput()), null, 2)}\n`);
}

module.exports = { buildPayload };
