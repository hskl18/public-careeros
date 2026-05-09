# Browser Smoke - 2026-05-08

Scope: local CareerOS product dashboard after frontend polish.

## Commands

- `pnpm check`: passed.
- `pnpm test`: passed.
- `pnpm build`: passed.
- `./scripts/dev-up.sh`: passed after build, seeded demo data and served on `http://localhost:3000`.
- `./scripts/dev-down.sh`: run after smoke to stop the local stack.
- Windows PowerShell fallback: `pnpm install`, `pnpm seed`, then
  `pnpm dev --hostname 127.0.0.1 --port 3000`; verified locally on
  2026-05-08 because this environment routed `bash` to WSL without `/bin/bash`.

Note: `next build` rewrites `.next`; if `next dev` is already running, restart
with `./scripts/dev-down.sh` then `./scripts/dev-up.sh` before browser smoke, or
stop/restart the PowerShell fallback dev server with `Ctrl+C` and
`pnpm dev --hostname 127.0.0.1 --port 3000`.

## Routes

Verified in browser at desktop width and at a 390px mobile viewport:

| Route | Result | Primary heading |
| --- | --- | --- |
| `/` | Pass | Operational job pipeline |
| `/applications` | Pass | Dense pipeline list |
| `/review` | Pass | Confirm uncertain updates |
| `/resume` | Pass | Analyze local resume text |
| `/notifications` | Pass | Operational notification window |
| `/settings` | Pass | Local runtime controls |
| `/judge-demo` | Pass | Static public demo remains provider-free |

## State Coverage

- First run with seeded demo data: visible in global status strip and settings local data.
- Empty workspace: represented in settings/dashboard copy and empty states.
- Local deterministic-only mode: visible in global status strip, dashboard, and settings.
- Ollama disabled: current local state; settings shows disabled diagnostics.
- Ollama unreachable, selected model missing, model ready: explicit settings state cells document each runtime outcome without forcing a model download.
- Gmail not connected: visible as optional connector status; local use remains separate.
- Connector needs attention: represented in notifications/settings state path for connector failures.
- Review item blocks update: seeded review item visible in dashboard, review, notifications, and applications.
- Deadline due soon: seeded reminders/deadline notifications visible.
- Recruiter reply detected: notification state represented; current seed has no recruiter reply row.
- Resume text pasted but not analyzed: verified by saving a draft-only resume.
- Resume analysis completed: verified by submitting a deterministic resume analysis.
- Notification dismissed or reviewed: verified by marking one notification read and dismissing one notification.

## Visual Check

Desktop and compact screenshots were captured under `.artifacts/browser-smoke/` for local inspection. The mobile sidebar was adjusted after an overlap issue was found; navigation now stacks cleanly and long content wraps instead of overlapping.
