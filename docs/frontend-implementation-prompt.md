# Frontend Implementation Prompt

Use this prompt when asking a frontend/design agent to implement the CareerOS
local-first dashboard experience.

```text
You are designing and implementing the CareerOS open-source local-first product
frontend. CareerOS is the reusable job pipeline system. Other Candidate is the
hosted product built on CareerOS and published at careeroc.com.

Goal:
Build the actual local dashboard product, not a marketing landing page. The
first screen should be a usable CareerOS workspace for job pipeline status,
applications, review items, resume context, notifications, local setup, optional
Gmail connector health, and optional Ollama/Gemma model status.

Read these docs first:
- README.md
- docs/local-first-product-plan.md
- docs/architecture.md
- docs/public-repo-scope.md
- docs/hackathon-writeup.md
- docs/todo.md
- source/README.md

Product boundaries:
- CareerOS is open-source, local-first, and should run before hosted providers
  are configured.
- Other Candidate is the hosted product and public demo built on CareerOS.
- Do not require Vercel, Railway, Neon, Google sign-in, Gmail OAuth, or Ollama
  to see the dashboard.
- Gmail is optional and user-controlled. The UI must work when Gmail is not
  connected.
- Ollama/Gemma is optional. Deterministic-only mode is a valid product state.
- Model output must be traceable and review-gated before risky application
  state changes.
- Do not expose private provider assumptions, real Gmail data, raw prompts,
  full model responses, local machine paths, or secrets.

Preferred route shape:
- /dashboard or /: dashboard command center.
- /applications: application pipeline list.
- /applications/[id]: application detail, evidence, timeline, reminders, and
  correction actions.
- /review: review queue for uncertain extracted updates and artifact evidence.
- /resume: local resume upload/paste, extraction, evaluation, and corrections.
- /notifications: notification window/history.
- /settings: local data, import/export/reset, Ollama/Gemma, and optional Gmail.

If the repo already has a different route convention, follow the existing
convention and update the docs. Otherwise create these routes and make the root
route land on the dashboard.

Design direction:
- This is an operational dashboard for repeated use, not a decorative SaaS
  landing page.
- Prioritize dense, scan-friendly information, practical controls, and stable
  layouts.
- Keep the app calm: restrained color, clear hierarchy, readable tables/lists,
  and status labels that can be understood without color alone.
- Use cards only for repeated items, modals, and genuinely framed tools. Do not
  nest cards inside cards.
- Use full-width bands or clean constrained sections for dashboard areas.
- Avoid oversized hero sections, gradient blobs, decorative orbs, generic
  AI-themed decoration, and empty marketing copy.
- Use icons for repeated actions and status where appropriate, with accessible
  labels/tooltips.
- Build real states for every control: empty, loading, error, disabled,
  configured, offline, model-missing, Gmail-unconnected, and review-blocked.

App shell:
- Persistent navigation with Dashboard, Applications, Review, Resume,
  Notifications, and Settings.
- Top status strip showing local workspace state, model mode, Gmail state, and
  last import/sync result.
- Notification button/drawer available from all primary routes.
- Mobile navigation must remain usable without hiding critical setup/model
  warnings.
- Keep summary/header areas stable; long lower sections should scroll within
  their own surface when needed.

Global state variants to implement:
- Seeded demo data loaded.
- Empty workspace before import.
- Local import in progress.
- Local import completed with partial errors.
- API/database unavailable.
- Ollama disabled by user.
- Ollama server unreachable.
- Selected Gemma model missing.
- Model health check passed.
- Model returned invalid output.
- Deterministic-only fallback active.
- Gmail not connected.
- Gmail connected and healthy.
- Gmail connector needs attention or re-auth.
- Review item blocks an application state update.
- Deadline due soon or overdue.
- Recruiter reply detected.
- Resume not uploaded.
- Resume uploaded but not analyzed.
- Resume analysis completed with corrections available.

Dashboard requirements:
- Show a command-center view on first load.
- Include pipeline summary: total applications, active applications, needs
  action, in review, overdue/due soon, and recent recruiter replies.
- Include "Needs attention" with review blocks, deadlines, model/Gmail setup
  issues, import errors, and resume gaps.
- Include recent recruiting changes with evidence source, confidence when
  available, and deep links to application detail or review.
- Include application stage overview with counts by stage.
- Include model status: disabled, deterministic-only, Ollama unreachable,
  selected model missing, health check passed, or invalid output blocked.
- Include Gmail status: not connected, connected, syncing, needs attention, or
  skipped.
- Include a compact notification window with severity, timestamp, source, linked
  next action, and mark-reviewed/dismiss action where supported.
- Empty dashboard state should invite seeded demo data, JSON/local import,
  manual application creation, and resume paste/upload. It must not push Gmail as
  a required first step.

Applications requirements:
- List applications with company, role, stage/status, priority, last activity,
  next action, deadline, evidence count, review status, and source.
- Support dense list/table scanning on desktop and readable stacked rows on
  mobile.
- Provide filters for stage/status, needs action, in review, due soon, source,
  and search by company/role.
- Show row-level indicators for recruiter reply, deadline, missing evidence,
  and review blocked.
- Empty state should support creating a manual application, loading seeded demo
  data, or importing local JSON. Gmail connection should be shown as optional.
- Loading/error states should preserve the layout size and show retry actions.

Application detail requirements:
- Header: company, role, status/stage, priority, source, last activity, action
  required, and primary next action.
- Show application timeline/activity with bounded rows and a clear "load more"
  or pagination pattern if needed.
- Show evidence cards for emails, local imports, resume/context matches, and
  artifact evidence. Evidence cards should show safe snippets, source labels,
  confidence, review reason, and trace summary when available.
- Show reminders/deadlines with due time, source, status, and whether the due
  date was explicit.
- Show contacts/recruiters when available.
- Show correction controls for wrong category, wrong application match, not an
  assessment, wrong deadline, and similar source-backed corrections.
- Any model-suggested mutation must expose evidence and require explicit review
  if confidence is low, company/role matching is weak, or output is invalid.
- Gmail links must be hidden or disabled when Gmail is not connected; the local
  evidence view must still work.

Review requirements:
- Show separate queues for email-derived updates, artifact evidence, and
  application state changes if the data model distinguishes them.
- Each review row must show proposed change, current state, evidence snippet,
  confidence, review reason, model path, fallback path, and affected
  application.
- Provide explicit Accept, Edit before accept, Reject, and Defer controls.
- Accepting a review item should make the application mutation clear before the
  user confirms.
- Rejection should preserve a bounded audit trail and not silently delete source
  evidence.
- Empty review state should say there are no blocked updates and link back to
  dashboard/applications.
- Model-missing or invalid-output review states should explain that automation is
  paused or routed to review, not failed silently.

Resume requirements:
- Support local resume paste/upload entry points and an empty state that works
  without Gmail or Ollama.
- States: no resume, uploaded but not analyzed, deterministic extraction only,
  model analysis running, model unavailable, selected model missing, analysis
  complete, corrections available, and analysis failed safely.
- Show extracted sections, evaluation summary, score or qualitative result if
  available, matched application/recruiting context, gaps, and suggested edits.
- Corrections must be explicit and reviewable; do not silently rewrite the
  user's resume.
- Show when analysis is deterministic-only versus Gemma-backed.
- Avoid storing or displaying raw full model prompts/responses.

Notifications requirements:
- Implement an in-app notification list/window before operating-system
  notifications.
- Notification types: recruiter reply detected, deadline approaching, overdue
  deadline, follow-up reminder due, model disabled/unreachable/missing, invalid
  model output blocked, review required, Gmail connector needs attention, import
  completed, import partial failure, resume analysis completed, and resume
  correction available.
- Each notification needs severity/status, timestamp, source, short message,
  destination link, and reviewed/dismissed state where supported.
- Notifications should be derived from pipeline state, reminders, review items,
  model status, connector health, and resume results. Do not make notifications
  a conflicting source of truth.
- Empty state should be useful: no current notifications, with links to
  Applications, Review, Resume, and Settings.

Settings requirements:
- Local data section: seeded demo data load/reset, local JSON import, export,
  delete local data, and destructive confirmation.
- Model section: Ollama enabled toggle, server URL, selected Gemma model tag,
  installed model list if available, copyable pull command, health check action,
  last health result, and deterministic fallback explanation.
- Gmail section: optional connector status, connect/reconnect/disconnect
  controls, last sync status, and clear "not required for local use" messaging.
- Privacy/safety section: what is stored locally, what is redacted, and whether
  raw Gmail/model content is stored.
- Settings empty/offline states should tell the user what can still be used
  locally.

Model and connector status language:
- "Deterministic-only" means local rules are active and model-backed analysis is
  unavailable or disabled.
- "Ollama unreachable" means the configured server URL did not respond.
- "Selected model missing" means Ollama responded but the configured Gemma tag is
  not installed.
- "Health check passed" means a small bounded prompt succeeded and model-backed
  analysis can be enabled.
- "Invalid model output" means the output was rejected and routed to review or
  deterministic fallback.
- "Gmail not connected" is a normal state, not an error.
- "Gmail needs attention" means a configured connector requires re-auth,
  permission repair, or sync retry.

Interaction rules:
- The user must be able to inspect evidence before accepting a model-suggested
  application update.
- Review confirmation must be explicit.
- The dashboard must show model mode; do not hide deterministic-only or
  model-missing states only in Settings.
- Gmail connection must be clearly optional and separate from local use.
- Notification rows must deep-link to the application, review item, resume
  result, or settings panel that owns the next action.
- Destructive local data actions require confirmation.
- Large model downloads should not be triggered automatically. Provide a
  copyable command instead.
- When data is missing, explain the next useful local action rather than showing
  a blank surface.

Accessibility and responsive requirements:
- All text must fit on mobile and desktop.
- Avoid viewport-scaled font sizes.
- Keep table/list rows usable on narrow screens.
- Use semantic buttons, links, headings, lists, and landmarks.
- Provide visible focus states.
- Do not rely on color alone for status.
- Loading skeletons and empty states must have accessible names or status text.
- Dialogs and drawers must trap focus and close predictably.

Seed/demo data requirements:
- Provide realistic fake applications, events, evidence snippets, review items,
  notifications, model trace summaries, and resume context.
- Include at least one clean application update, one deadline, one recruiter
  reply, one ambiguous review-blocked update, one model-missing state, one
  Gmail-unconnected state, one empty workspace state, and one resume correction
  state.
- Use anonymized fake companies and people. Do not include real Gmail data or
  personal emails.

Validation:
- Run build/lint/type checks available in the repo.
- Browser smoke these surfaces: dashboard, applications, application detail,
  review, resume, notifications, settings.
- Browser smoke these states: seeded demo data, empty workspace, Gmail
  unconnected, Gmail needs attention, Ollama disabled, Ollama unreachable,
  selected model missing, model health passed, deterministic-only fallback,
  review-blocked update, resume uploaded but not analyzed, and resume analysis
  completed.
- Capture or inspect screenshots at desktop and mobile widths to verify no
  overlapping text, no blank primary surface, no inaccessible controls, and no
  broken responsive layout.
- Verify root navigation starts on the dashboard or redirects there.
- Verify the dashboard renders when Gmail and Ollama are both disabled.

Deliverables:
- Implemented routes/components/styles.
- Realistic seeded demo UI states.
- Updated docs when route names, setup behavior, model behavior, or connector
  behavior changes.
- Validation notes with exact commands run.
- No commit or push unless explicitly requested.
```
