import {
  AlertTriangle,
  Bell,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  GitPullRequestArrow,
  HeartPulse,
  Inbox,
  MailCheck,
  ShieldCheck,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type StatusTone = "good" | "warn" | "danger" | "info" | "neutral";

export type ApplicationStage =
  | "Applied"
  | "Assessment"
  | "Interviewing"
  | "Offer"
  | "Rejected"
  | "Watching";

export type ApplicationSource = "seeded demo" | "local import" | "manual" | "gmail optional";

export type TimelineEvent = {
  id: string;
  title: string;
  timestamp: string;
  source: string;
  confidence?: number;
  reviewReason?: string;
};

export type EvidenceCard = {
  id: string;
  type: "email" | "local import" | "resume context" | "artifact";
  title: string;
  snippet: string;
  source: string;
  confidence?: number;
  reviewReason?: string;
  trace: string;
};

export type Reminder = {
  id: string;
  title: string;
  due: string;
  source: string;
  status: "due soon" | "overdue" | "scheduled" | "complete";
  explicit: boolean;
};

export type Contact = {
  name: string;
  role: string;
  source: string;
  lastSeen: string;
};

export type Application = {
  id: string;
  company: string;
  role: string;
  stage: ApplicationStage;
  priority: "high" | "medium" | "low";
  lastActivity: string;
  nextAction: string;
  deadline?: string;
  evidenceCount: number;
  reviewStatus: "clear" | "blocked" | "needs review";
  source: ApplicationSource;
  recruiterReply: boolean;
  actionRequired: boolean;
  missingEvidence: boolean;
  timeline: TimelineEvent[];
  evidence: EvidenceCard[];
  reminders: Reminder[];
  contacts: Contact[];
};

export type ReviewItem = {
  id: string;
  queue: "email update" | "artifact evidence" | "state change";
  proposedChange: string;
  currentState: string;
  evidenceSnippet: string;
  confidence: number;
  reviewReason: string;
  modelPath: string;
  fallbackPath: string;
  applicationId: string;
  applicationLabel: string;
};

export type NotificationItem = {
  id: string;
  severity: StatusTone;
  status: "new" | "reviewed" | "dismissed";
  timestamp: string;
  source: string;
  message: string;
  destination: string;
  destinationLabel: string;
};

export type StateVariant = {
  id: string;
  label: string;
  tone: StatusTone;
  description: string;
  owner: "workspace" | "api" | "model" | "gmail" | "review" | "resume";
};

export const applications: Application[] = [
  {
    id: "northstar-labs",
    company: "Northstar Labs",
    role: "Software Engineer Intern",
    stage: "Interviewing",
    priority: "high",
    lastActivity: "2026-05-07T17:42:00-07:00",
    nextAction: "Confirm Tuesday interview availability",
    deadline: "2026-05-09T16:00:00-07:00",
    evidenceCount: 5,
    reviewStatus: "clear",
    source: "seeded demo",
    recruiterReply: true,
    actionRequired: true,
    missingEvidence: false,
    timeline: [
      {
        id: "northstar-t1",
        title: "Recruiter reply detected and tied to application",
        timestamp: "2026-05-07T17:42:00-07:00",
        source: "seeded demo email thread",
        confidence: 0.91,
      },
      {
        id: "northstar-t2",
        title: "Technical interview schedule extracted from artifact",
        timestamp: "2026-05-07T12:20:00-07:00",
        source: "calendar screenshot artifact",
        confidence: 0.86,
      },
      {
        id: "northstar-t3",
        title: "Resume context matched backend systems bullets",
        timestamp: "2026-05-06T15:10:00-07:00",
        source: "resume analysis",
        confidence: 0.78,
      },
    ],
    evidence: [
      {
        id: "northstar-e1",
        type: "email",
        title: "Interview availability request",
        snippet:
          "Recruiter asks for Tuesday or Thursday availability and repeats the Software Engineer Intern role.",
        source: "safe email snippet",
        confidence: 0.91,
        trace: "deterministic filter -> Gemma extraction -> trusted stage update",
      },
      {
        id: "northstar-e2",
        type: "artifact",
        title: "Calendar invite screenshot",
        snippet: "Tech screen, Tue May 12, 10:30 AM PT. Video link and candidate name hidden.",
        source: "local artifact evidence",
        confidence: 0.86,
        trace: "artifact OCR -> Gemma evidence classifier -> schedule evidence accepted",
      },
    ],
    reminders: [
      {
        id: "northstar-r1",
        title: "Send availability reply",
        due: "2026-05-09T16:00:00-07:00",
        source: "explicit recruiter request",
        status: "due soon",
        explicit: true,
      },
    ],
    contacts: [
      {
        name: "Maya Chen",
        role: "University recruiter",
        source: "safe sender metadata",
        lastSeen: "2026-05-07T17:42:00-07:00",
      },
    ],
  },
  {
    id: "atlas-robotics",
    company: "Atlas Robotics",
    role: "Backend Engineer",
    stage: "Assessment",
    priority: "high",
    lastActivity: "2026-05-06T09:15:00-07:00",
    nextAction: "Complete online assessment",
    deadline: "2026-05-08T18:00:00-07:00",
    evidenceCount: 4,
    reviewStatus: "clear",
    source: "local import",
    recruiterReply: false,
    actionRequired: true,
    missingEvidence: false,
    timeline: [
      {
        id: "atlas-t1",
        title: "Assessment invite imported with explicit Friday deadline",
        timestamp: "2026-05-06T09:15:00-07:00",
        source: "local JSON import",
        confidence: 0.88,
      },
      {
        id: "atlas-t2",
        title: "Reminder created from explicit due date",
        timestamp: "2026-05-06T09:18:00-07:00",
        source: "deterministic deadline parser",
      },
    ],
    evidence: [
      {
        id: "atlas-e1",
        type: "local import",
        title: "Assessment invite",
        snippet: "One-hour backend assessment is due Friday at 6:00 PM PT.",
        source: "local JSON import",
        confidence: 0.88,
        trace: "local import -> deterministic due date parse -> reminder",
      },
    ],
    reminders: [
      {
        id: "atlas-r1",
        title: "Finish backend assessment",
        due: "2026-05-08T18:00:00-07:00",
        source: "explicit imported deadline",
        status: "overdue",
        explicit: true,
      },
    ],
    contacts: [],
  },
  {
    id: "signal-foundry",
    company: "Signal Foundry",
    role: "Product Engineer",
    stage: "Watching",
    priority: "medium",
    lastActivity: "2026-05-05T13:03:00-07:00",
    nextAction: "Review ambiguous next-steps email",
    evidenceCount: 2,
    reviewStatus: "blocked",
    source: "gmail optional",
    recruiterReply: false,
    actionRequired: false,
    missingEvidence: true,
    timeline: [
      {
        id: "signal-t1",
        title: "Model suggested application update but company match is weak",
        timestamp: "2026-05-05T13:03:00-07:00",
        source: "optional Gmail connector",
        confidence: 0.54,
        reviewReason: "Weak sender identity and ambiguous role title.",
      },
    ],
    evidence: [
      {
        id: "signal-e1",
        type: "email",
        title: "Ambiguous next steps",
        snippet: "Sender mentions next steps but does not clearly identify the company or role.",
        source: "safe email snippet",
        confidence: 0.54,
        reviewReason: "Could attach to the wrong application.",
        trace: "deterministic filter -> Gemma extraction -> review gate blocks mutation",
      },
    ],
    reminders: [],
    contacts: [
      {
        name: "Unknown sender",
        role: "Unverified recruiting contact",
        source: "redacted sender metadata",
        lastSeen: "2026-05-05T13:03:00-07:00",
      },
    ],
  },
  {
    id: "crescent-data",
    company: "Crescent Data",
    role: "Full-stack Engineer",
    stage: "Applied",
    priority: "low",
    lastActivity: "2026-05-02T10:30:00-07:00",
    nextAction: "Wait for recruiter response",
    evidenceCount: 1,
    reviewStatus: "clear",
    source: "manual",
    recruiterReply: false,
    actionRequired: false,
    missingEvidence: false,
    timeline: [
      {
        id: "crescent-t1",
        title: "Manual application created",
        timestamp: "2026-05-02T10:30:00-07:00",
        source: "manual entry",
      },
    ],
    evidence: [
      {
        id: "crescent-e1",
        type: "resume context",
        title: "Resume targeting note",
        snippet: "Systems and product analytics bullets are relevant to the role.",
        source: "local resume note",
        trace: "manual note -> application context",
      },
    ],
    reminders: [],
    contacts: [],
  },
];

export const reviewItems: ReviewItem[] = [
  {
    id: "review-signal-company",
    queue: "email update",
    proposedChange: "Move Signal Foundry to Interviewing and create a follow-up reminder.",
    currentState: "Watching, no action required",
    evidenceSnippet:
      "The message says next steps are ready, but sender identity and company match are weak.",
    confidence: 0.54,
    reviewReason: "Company/role matching is weak; mutation is blocked.",
    modelPath: "Gemma via Ollama when configured",
    fallbackPath: "Deterministic-only keeps evidence and waits for review.",
    applicationId: "signal-foundry",
    applicationLabel: "Signal Foundry · Product Engineer",
  },
  {
    id: "review-artifact-date",
    queue: "artifact evidence",
    proposedChange: "Attach screenshot-derived interview time to Northstar Labs.",
    currentState: "Interviewing, no confirmed time on detail page",
    evidenceSnippet: "Tech Screen · Tue May 12 · 10:30 AM PT · video link hidden",
    confidence: 0.72,
    reviewReason: "Artifact text is readable but date context should be confirmed.",
    modelPath: "Gemma artifact evidence classifier",
    fallbackPath: "Store artifact as evidence without creating a reminder.",
    applicationId: "northstar-labs",
    applicationLabel: "Northstar Labs · Software Engineer Intern",
  },
  {
    id: "review-invalid-output",
    queue: "state change",
    proposedChange: "Reject invalid model JSON and keep deterministic fallback active.",
    currentState: "Model-backed mutation paused",
    evidenceSnippet: "Model returned malformed stage output for a low-confidence update.",
    confidence: 0.0,
    reviewReason: "Invalid model output must not write application state.",
    modelPath: "Selected Gemma model",
    fallbackPath: "Route to review and keep deterministic extraction.",
    applicationId: "atlas-robotics",
    applicationLabel: "Atlas Robotics · Backend Engineer",
  },
];

export const notifications: NotificationItem[] = [
  {
    id: "n-atlas-overdue",
    severity: "danger",
    status: "new",
    timestamp: "2026-05-08T18:05:00-07:00",
    source: "deadline read model",
    message: "Atlas Robotics assessment deadline is overdue.",
    destination: "/applications/atlas-robotics",
    destinationLabel: "Open application",
  },
  {
    id: "n-northstar-reply",
    severity: "warn",
    status: "new",
    timestamp: "2026-05-07T17:42:00-07:00",
    source: "recruiter reply detector",
    message: "Northstar Labs recruiter reply needs an availability response.",
    destination: "/applications/northstar-labs",
    destinationLabel: "Review next action",
  },
  {
    id: "n-model-fallback",
    severity: "info",
    status: "reviewed",
    timestamp: "2026-05-07T10:20:00-07:00",
    source: "model health",
    message: "Ollama is disabled; deterministic-only mode is active.",
    destination: "/settings",
    destinationLabel: "Open model settings",
  },
  {
    id: "n-review-block",
    severity: "warn",
    status: "new",
    timestamp: "2026-05-05T13:04:00-07:00",
    source: "manual review gate",
    message: "One application update is blocked until evidence is confirmed.",
    destination: "/review",
    destinationLabel: "Open review",
  },
  {
    id: "n-resume-complete",
    severity: "good",
    status: "reviewed",
    timestamp: "2026-05-06T15:20:00-07:00",
    source: "resume analyzer",
    message: "Resume analysis completed with corrections available.",
    destination: "/resume",
    destinationLabel: "Open resume",
  },
];

export const stateVariants: StateVariant[] = [
  {
    id: "seeded",
    label: "Seeded demo data loaded",
    tone: "good",
    description: "The dashboard is usable immediately with local sample applications and evidence.",
    owner: "workspace",
  },
  {
    id: "empty",
    label: "Empty workspace before import",
    tone: "neutral",
    description: "Show local import, seeded demo, manual creation, and resume paste entry points.",
    owner: "workspace",
  },
  {
    id: "importing",
    label: "Local import in progress",
    tone: "info",
    description: "Rows keep stable layout while JSON import validates evidence and dates.",
    owner: "workspace",
  },
  {
    id: "partial-import",
    label: "Import completed with partial errors",
    tone: "warn",
    description: "Good records are loaded; rejected rows link to import diagnostics.",
    owner: "workspace",
  },
  {
    id: "api-offline",
    label: "API/database unavailable",
    tone: "danger",
    description: "The app keeps local setup actions visible and offers retry without blank pages.",
    owner: "api",
  },
  {
    id: "ollama-disabled",
    label: "Ollama disabled by user",
    tone: "neutral",
    description: "Deterministic-only extraction remains active and model analysis is skipped.",
    owner: "model",
  },
  {
    id: "ollama-unreachable",
    label: "Ollama server unreachable",
    tone: "warn",
    description: "The configured server URL did not respond; model-backed analysis is paused.",
    owner: "model",
  },
  {
    id: "model-missing",
    label: "Selected Gemma model missing",
    tone: "warn",
    description: "Ollama responded but the configured Gemma tag is not installed.",
    owner: "model",
  },
  {
    id: "model-healthy",
    label: "Model health check passed",
    tone: "good",
    description: "A bounded health prompt succeeded and Gemma-backed analysis can be enabled.",
    owner: "model",
  },
  {
    id: "invalid-output",
    label: "Model returned invalid output",
    tone: "danger",
    description: "The output is rejected and routed to review or deterministic fallback.",
    owner: "model",
  },
  {
    id: "gmail-unconnected",
    label: "Gmail not connected",
    tone: "neutral",
    description: "Normal local-first state; Gmail is optional and never required for dashboard use.",
    owner: "gmail",
  },
  {
    id: "gmail-healthy",
    label: "Gmail connected and healthy",
    tone: "good",
    description: "Optional connector is configured and last sync completed.",
    owner: "gmail",
  },
  {
    id: "gmail-attention",
    label: "Gmail needs attention",
    tone: "warn",
    description: "A configured connector requires re-auth, permission repair, or sync retry.",
    owner: "gmail",
  },
  {
    id: "review-blocked",
    label: "Review item blocks state update",
    tone: "warn",
    description: "Application mutation is paused until evidence is accepted, edited, rejected, or deferred.",
    owner: "review",
  },
  {
    id: "resume-missing",
    label: "Resume not uploaded",
    tone: "neutral",
    description: "The resume surface offers paste/upload without requiring Gmail or Ollama.",
    owner: "resume",
  },
  {
    id: "resume-uploaded",
    label: "Resume uploaded but not analyzed",
    tone: "info",
    description: "Deterministic extraction can run before Gemma-backed evaluation.",
    owner: "resume",
  },
  {
    id: "resume-complete",
    label: "Resume analysis completed",
    tone: "good",
    description: "Extracted sections, gaps, matched applications, and corrections are reviewable.",
    owner: "resume",
  },
];

export const setupStatuses = [
  {
    label: "Workspace",
    value: "Seeded local demo",
    tone: "good" as const,
    icon: Database,
  },
  {
    label: "Model mode",
    value: "Deterministic-only",
    tone: "neutral" as const,
    icon: Bot,
  },
  {
    label: "Gmail",
    value: "Not connected",
    tone: "neutral" as const,
    icon: MailCheck,
  },
  {
    label: "Last import",
    value: "Partial warnings",
    tone: "warn" as const,
    icon: Upload,
  },
] satisfies Array<{
  label: string;
  value: string;
  tone: StatusTone;
  icon: LucideIcon;
}>;

export const stageCounts = ["Applied", "Assessment", "Interviewing", "Offer", "Rejected", "Watching"].map(
  (stage) => ({
    stage,
    count: applications.filter((application) => application.stage === stage).length,
  }),
);

export const dashboardMetrics = [
  {
    label: "Total applications",
    value: applications.length.toString(),
    hint: "seeded, imported, and manual",
    icon: BriefcaseBusiness,
    tone: "neutral" as const,
  },
  {
    label: "Active",
    value: applications.filter((item) => !["Rejected", "Offer"].includes(item.stage)).length.toString(),
    hint: "still in motion",
    icon: HeartPulse,
    tone: "good" as const,
  },
  {
    label: "Needs action",
    value: applications.filter((item) => item.actionRequired).length.toString(),
    hint: "reply or deadline",
    icon: Clock3,
    tone: "warn" as const,
  },
  {
    label: "In review",
    value: reviewItems.length.toString(),
    hint: "blocked mutations",
    icon: GitPullRequestArrow,
    tone: "warn" as const,
  },
  {
    label: "Due soon / overdue",
    value: applications.filter((item) => item.deadline).length.toString(),
    hint: "deadline window",
    icon: AlertTriangle,
    tone: "danger" as const,
  },
  {
    label: "Recruiter replies",
    value: applications.filter((item) => item.recruiterReply).length.toString(),
    hint: "recent inbound signal",
    icon: Inbox,
    tone: "info" as const,
  },
];

export const attentionItems = [
  {
    title: "Assessment deadline overdue",
    detail: "Atlas Robotics assessment is past its imported due time.",
    href: "/applications/atlas-robotics",
    tone: "danger" as const,
    icon: Clock3,
  },
  {
    title: "Review blocked update",
    detail: "Signal Foundry update cannot mutate state until evidence is confirmed.",
    href: "/review",
    tone: "warn" as const,
    icon: ShieldCheck,
  },
  {
    title: "Model running deterministic-only",
    detail: "Ollama is disabled; Gemma-backed analysis is optional.",
    href: "/settings",
    tone: "neutral" as const,
    icon: Bot,
  },
  {
    title: "Resume corrections available",
    detail: "Backend systems bullets can be tightened before the Northstar interview.",
    href: "/resume",
    tone: "info" as const,
    icon: FileText,
  },
  {
    title: "Gmail not connected",
    detail: "This is normal for local use. Seeded and imported data still work.",
    href: "/settings",
    tone: "neutral" as const,
    icon: MailCheck,
  },
];

export const resumeState = {
  uploaded: true,
  analyzed: true,
  mode: "Deterministic extraction + Gemma-ready evaluation",
  score: "84/100",
  summary:
    "Resume is strong for backend and full-stack roles; the current gaps are quantified infrastructure impact and clearer interview-relevant project evidence.",
  sections: [
    ["Experience", "3 roles extracted; 2 need stronger metrics"],
    ["Projects", "CareerOS and document scanner align with active applications"],
    ["Education", "UCSD Computer Science context detected"],
    ["Skills", "Backend, TypeScript, .NET, PostgreSQL, and AI tooling grouped"],
  ],
  gaps: [
    "Add latency, throughput, or reliability numbers to backend systems bullets.",
    "Tie CareerOS evidence-review work to Northstar interview preparation.",
    "Clarify ownership of queue, model fallback, and data-retention safeguards.",
  ],
  corrections: [
    "Rewrite one systems bullet before accepting.",
    "Mark Atlas assessment prep as relevant context.",
    "Do not silently rewrite the uploaded resume.",
  ],
};

export const settingsSections = [
  {
    id: "local-data",
    title: "Local data",
    icon: Database,
    rows: [
      ["Seeded demo data", "Loaded; can be reset without provider accounts."],
      ["JSON import", "Ready; failed rows stay visible as partial errors."],
      ["Export", "Exports applications, events, evidence snippets, and review audit."],
      ["Delete local data", "Requires destructive confirmation."],
    ],
  },
  {
    id: "model",
    title: "Ollama and Gemma",
    icon: Bot,
    rows: [
      ["Ollama enabled", "Off by user choice."],
      ["Server URL", "http://localhost:11434"],
      ["Selected model", "gemma3:4b or configured Gemma tag"],
      ["Pull command", "ollama pull gemma3:4b"],
      ["Health result", "Not run; deterministic-only fallback active."],
    ],
  },
  {
    id: "gmail",
    title: "Optional Gmail connector",
    icon: MailCheck,
    rows: [
      ["Status", "Not connected and not required for local use."],
      ["Last sync", "Skipped."],
      ["Controls", "Connect, reconnect, disconnect, and retry are explicit actions."],
      ["Boundary", "Local import and manual entry work without Gmail."],
    ],
  },
  {
    id: "privacy",
    title: "Privacy and safety",
    icon: ShieldCheck,
    rows: [
      ["Stored locally", "Applications, reminders, review items, and redacted evidence snippets."],
      ["Redacted", "Raw Gmail bodies, full model prompts, full model responses, and secrets."],
      ["Review gate", "Low-confidence or invalid model output cannot silently write state."],
      ["Large downloads", "Never triggered automatically; copy a command instead."],
    ],
  },
];

export const emptyWorkspaceActions = [
  { label: "Load seeded demo", detail: "Explore the product with fake local data.", icon: CheckCircle2 },
  { label: "Import local JSON", detail: "Bring in applications, events, and evidence snippets.", icon: Upload },
  { label: "Create application", detail: "Track a manual application without any connector.", icon: BriefcaseBusiness },
  { label: "Paste resume", detail: "Start deterministic resume extraction locally.", icon: FileText },
  { label: "Skip Gmail", detail: "Keep Gmail disconnected until you choose to connect it.", icon: MailCheck },
  { label: "Run setup check", detail: "Check API, database, and optional Ollama status.", icon: Bell },
];

export function getApplicationById(id: string) {
  return applications.find((application) => application.id === id);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
