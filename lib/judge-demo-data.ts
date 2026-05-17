type ProviderTone = "hero" | "default" | "roadmap";

export const judgeAgentStages = [
  {
    label: "01",
    title: "Mailbox triage agent",
    body: "Classifies recruiter mail, OA invites, follow-ups, rejections, offers, and vague emails with missing context.",
    output: "intent: recruiter_oa_follow_up"
  },
  {
    label: "02",
    title: "Workflow extraction agent",
    body: "Maps the thread to company, role, source, JD link, resume version, recruiter contact, deadline, and action.",
    output: "proposal: update_application"
  },
  {
    label: "03",
    title: "Evidence/review agent",
    body: "Attaches bounded evidence snippets and blocks low-confidence updates behind explicit review.",
    output: "review_gate: required"
  },
  {
    label: "04",
    title: "Resume/context agent",
    body: "Adds candidate context so the system can prioritize replies, fit, and preparation work.",
    output: "context: candidate_ready"
  },
  {
    label: "05",
    title: "Reminder/notification agent",
    body: "Creates deadline and follow-up notifications after review, then suppresses stale reminders once the thread moves.",
    output: "notify: oa_due_no_stale_followup"
  },
  {
    label: "06",
    title: "Model router/provider layer",
    body: "Prefers Gemma via Ollama Cloud when the API key is ready, falls back to deterministic parsing when unavailable.",
    output: "provider: gemma_or_rules"
  }
];

export const judgeMailboxThread = [
  {
    from: "candidate note",
    subject: "What role is this recruiter email for?",
    body: "I have 83 applications in a spreadsheet and cannot tell which role this OA belongs to.",
    tag: "real pain"
  },
  {
    from: "mira.chen@heliosdata.example",
    subject: "Helios Data online assessment reminder",
    body: "Your OA for the Machine Learning Platform Intern role is due Friday at 5:00 PM PT. Use the JD link from Handshake if you need the role details.",
    tag: "recruiter email"
  },
  {
    from: "mira.chen@heliosdata.example",
    subject: "Re: Helios Data online assessment reminder",
    body: "You applied with resume-ml-v4.pdf. Reply here when the OA is complete and I can confirm the next interview window.",
    tag: "evidence"
  }
];

export const judgeExtractedUpdate = [
  ["Company", "Helios Data"],
  ["Role", "Machine Learning Platform Intern"],
  ["Source", "Handshake"],
  ["JD link", "helios.example/jobs/ml-platform-intern"],
  ["Resume version", "resume-ml-v4.pdf"],
  ["Recruiter contact", "Mira Chen"],
  ["Deadline", "May 15, 5:00 PM PT"],
  ["Next action", "Complete OA and suppress stale follow-up"],
  ["Confidence", "81%"]
];

export const judgeHandoffSteps = [
  ["Email evidence", "random recruiter thread"],
  ["Structured proposal", "fields + confidence"],
  ["Review gate", "accept, correct, or dismiss"],
  ["Tracker state", "deadline + notification"]
];

export const judgePainSignals = [
  "random recruiter email with missing context",
  "spreadsheet drift after 50-100 applications",
  "stale follow-up reminders when the process moves",
  "JD, resume version, source, contact, and notes tracked together"
];

export function providerTone(adapter: { id: string; implementation: string }): ProviderTone {
  if (adapter.implementation === "implemented" && adapter.id === "ollama") return "hero";
  if (adapter.implementation === "implemented") return "default";
  return "roadmap";
}

export function providerStatusLabel(adapter: {
  implementation: string;
  kind: string;
  trust: string;
  id: string;
}): string {
  if (adapter.id === "ollama") return "Primary cloud path";
  if (adapter.id === "deterministic") return "Always available";
  if (adapter.kind === "hosted-byok") return "BYOK adapter roadmap";
  return "Advanced adapter roadmap";
}

export function modelStatusLabel(status: string) {
  if (status === "ready") return "Gemma ready";
  if (status === "model_missing") return "Gemma model missing";
  if (status === "unavailable") return "Ollama Cloud unreachable";
  if (status === "disabled") return "Deterministic fallback";
  return status.replaceAll("_", " ");
}
