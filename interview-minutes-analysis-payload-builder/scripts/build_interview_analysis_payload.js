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

function present(value) {
  return value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== '');
}

function firstValue(record, names) {
  for (const name of names) {
    const value = record ? record[name] : undefined;
    if (present(value)) return value;
  }
  return undefined;
}

function asString(value) {
  return value === undefined || value === null ? '' : String(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function errorAnalysis(message) {
  return {
    overall: 'Error',
    score: 0,
    summary: 'AI解析失败',
    strengths: [],
    red_flags: [`错误:${message}`],
    key_moments: [],
    culture_fit: 'Unknown',
    culture_fit_reason: '',
    next_step: '请手动评估',
    suggested_questions: [],
    veto_check: {},
    veto_count: 0
  };
}

function extractAnalysis(record) {
  const direct = firstValue(record, ['analysis', 'aiAnalysis', 'interviewAnalysis']);
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) return { value: direct };

  const groqResponse = firstValue(record, ['groqResponse', 'groq_response']);
  const response = groqResponse || (record && Array.isArray(record.choices) ? record : undefined);
  const rawFromResponse = response && response.choices && response.choices[0] &&
    response.choices[0].message && response.choices[0].message.content;
  const raw = present(rawFromResponse)
    ? rawFromResponse
    : firstValue(record, ['modelOutput', 'model_output', 'llmOutput', 'llm_output']);

  if (!present(raw)) return { missing: true };
  if (typeof raw === 'object' && !Array.isArray(raw)) return { value: raw };

  try {
    const text = String(raw);
    const jsonText = (text.match(/\{[\s\S]*\}/) || [text])[0];
    return { value: JSON.parse(jsonText) };
  } catch (error) {
    return { value: errorAnalysis(error.message) };
  }
}

function normalize(record) {
  const analysisResult = extractAnalysis(record);
  const fields = {
    analysis: analysisResult.missing ? undefined : analysisResult.value,
    hrOpenId: firstValue(record, ['hrOpenId', 'hr_open_id']),
    atsAppToken: firstValue(record, ['atsAppToken', 'ats_app_token']),
    atsTableId: firstValue(record, ['atsTableId', 'ats_table_id']),
    recordId: firstValue(record, ['recordId', 'record_id']),
    generatedAt: firstValue(record, ['generatedAt', 'generated_at', 'analysisTime', 'analysis_time', 'sourceTime', 'source_time'])
  };
  const missing = Object.entries(fields)
    .filter(([, value]) => !present(value))
    .map(([key]) => key);
  if (missing.length) return { missing };

  return {
    analysis: fields.analysis,
    hrOpenId: asString(fields.hrOpenId).trim(),
    atsAppToken: asString(fields.atsAppToken).trim(),
    atsTableId: asString(fields.atsTableId).trim(),
    recordId: asString(fields.recordId).trim(),
    generatedAt: asString(fields.generatedAt).trim(),
    candidateName: asString(firstValue(record, ['candidateName', 'candidate_name']) || '候选人'),
    jobTitle: asString(firstValue(record, ['jobTitle', 'job_title']) || ''),
    minuteTitle: asString(firstValue(record, ['minuteTitle', 'minute_title']) || '')
  };
}

function buildPayload(input) {
  const record = source(input || {});
  const mode = record.mode || 'build_payload';
  if (mode !== 'build_payload') return { skip: true, reason: 'unsupported mode' };

  const normalized = normalize(record);
  if (normalized.missing) return { needs_more_information: true, missing: normalized.missing };

  const a = normalized.analysis || {};
  const decision = a.score >= 3 ? '✅ 推进下一轮' : '❌ 淘汰';
  const scoreEmoji = { 1: '🔴', 2: '🟠', 3: '🟡', 4: '🟢', 5: '⭐' }[a.score] || '⚪';
  const headerColor = a.score >= 4 ? 'green' : a.score === 3 ? 'yellow' : 'red';
  const overallTag = {
    'Strong Hire': '🟢 Strong Hire',
    Hire: '🟢 Hire',
    Maybe: '🟡 Maybe',
    Pass: '🔴 Pass',
    'Strong Pass': '🔴 Strong Pass',
    Error: '⚠️ Error'
  }[a.overall] || a.overall;

  const vetoCheck = a.veto_check || {};
  const vetoLines = Object.entries(vetoCheck)
    .filter(([, value]) => value && value !== 'N/A')
    .map(([key, value]) => {
      const text = String(value);
      return `${text.startsWith('VETO') ? '🚫' : '✅'} ${key}: ${text}`;
    });
  const vetoCount = a.veto_count || 0;
  const vetoSummary = vetoCount === 0 ? '✅ 全部通过' : `🚫 触发 ${vetoCount} 条否决`;
  const strengths = asArray(a.strengths);
  const redFlags = asArray(a.red_flags);
  const keyMoments = asArray(a.key_moments);
  const suggestedQuestions = asArray(a.suggested_questions);

  const notesText = [
    `${decision}  ${overallTag}  ${scoreEmoji} ${a.score}/5  ${vetoSummary}`, '',
    '🔍 否决条件检查:', ...vetoLines, '',
    `📝 总结: ${a.summary}`, '',
    '✅ 亮点:', ...(strengths.length ? strengths.map(s => `• ${s}`) : ['• 无']), '',
    '⚠️ 风险信号:', ...(redFlags.length ? redFlags.map(r => `• ${r}`) : ['• 无']), '',
    '🎯 关键时刻:', ...keyMoments.map(m => `[${m.timestamp}] ${m.content}`), '',
    `➡️ 建议: ${a.next_step}`, '',
    '❓ 下轮追问:', ...(suggestedQuestions.length ? suggestedQuestions.map((q, i) => `${i + 1}. ${q}`) : ['• 无（已淘汰）']), '',
    `——— AI 分析 · ${normalized.minuteTitle || ''}`
  ].join('\n');

  const mkDiv = (title, lines) => ({
    tag: 'div',
    text: { tag: 'lark_md', content: `**${title}**\n${lines.join('\n')}` }
  });

  const card = {
    config: { wide_screen_mode: true },
    header: {
      title: { content: `🤖 面试分析 — ${normalized.candidateName || '候选人'} · ${normalized.jobTitle || ''}`, tag: 'plain_text' },
      template: headerColor
    },
    elements: [
      {
        tag: 'div',
        fields: [
          { is_short: true, text: { tag: 'lark_md', content: `**决策**\n${decision}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**评级**\n${overallTag}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**评分**\n${scoreEmoji} ${a.score}/5` } },
          { is_short: true, text: { tag: 'lark_md', content: `**否决条数**\n${vetoSummary}` } }
        ]
      },
      { tag: 'hr' },
      mkDiv('🔍 否决条件检查', vetoLines.length ? vetoLines : ['✅ 全部通过']),
      { tag: 'hr' },
      { tag: 'div', text: { tag: 'lark_md', content: `**📝 总结**\n${a.summary}` } },
      { tag: 'hr' },
      mkDiv('✅ 亮点', strengths.length ? strengths.map(s => `• ${s}`) : ['• 无突出亮点']),
      mkDiv('⚠️ 风险信号', redFlags.length ? redFlags.map(r => `• ${r}`) : ['• 无']),
      { tag: 'hr' },
      mkDiv('🎯 关键时刻', keyMoments.map(m => `\`${m.timestamp}\` ${m.content}`)),
      { tag: 'hr' },
      { tag: 'div', text: { tag: 'lark_md', content: `**➡️ 建议下一步**\n${a.next_step}` } },
      ...(suggestedQuestions.length
        ? [mkDiv('❓ 下轮追问', suggestedQuestions.map((q, i) => `${i + 1}. ${q}`))]
        : []),
      { tag: 'hr' },
      {
        tag: 'note',
        elements: [
          { tag: 'plain_text', content: `来源: 妙记逐字稿 · ${normalized.minuteTitle || ''} · ${normalized.generatedAt}` }
        ]
      }
    ]
  };
  const larkCardJson = JSON.stringify(card);

  return {
    message_type: 'lark_interview_minutes_analysis_payloads',
    summary: `Interview analysis for ${normalized.candidateName}`,
    analysis: a,
    notes_text: notesText,
    card,
    lark_card_json: larkCardJson,
    lark: {
      bitableUpdate: {
        method: 'PUT',
        path: `/open-apis/bitable/v1/apps/${normalized.atsAppToken}/tables/${normalized.atsTableId}/records/${normalized.recordId}`,
        body: {
          fields: {
            'AI Interview Notes': notesText
          }
        }
      },
      cardMessage: {
        method: 'POST',
        path: '/open-apis/im/v1/messages?receive_id_type=open_id',
        body: {
          receive_id: normalized.hrOpenId,
          msg_type: 'interactive',
          content: larkCardJson
        }
      }
    }
  };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(buildPayload(readInput()), null, 2)}\n`);
}

module.exports = { buildPayload };
