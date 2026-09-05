# fin-invoice-precheck-approval

> Lark FIN-01 发票预检 workflow 路由。用户说‘帮我预检刚上传的发票’、‘发票预检’、‘检查发票’、‘检查刚上传的发票’、‘发票审批’、‘付款审批’、‘发起付款’、‘invoice precheck’或 fin-invoice-precheck-approval 时，优先加载这个精确 skill；附件和申请日期齐备后执行 workflow，缺项时先索取；不要走通用 OCR。

---

**Mirrored from [Ornn](https://ornn.chrono-ai.fun/skills/fin-invoice-precheck-approval) — read-only.**

Edits here are NOT propagated back. Submit changes on Ornn.

- Latest version: `15.0`
- Last synced: `2026-09-05T00:00:09.623Z`

## Install

```bash
npx skills add ChronoAIProject/nyx-skills/fin-invoice-precheck-approval
```

## Use

See `SKILL.md` in this folder for the full instructions an AI agent
follows when this skill is loaded.
