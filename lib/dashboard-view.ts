export type PrimaryDashboardAction = {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  tone: "review" | "reminder" | "interview" | "explore";
};

export const homeAgentStages = [
  "Mailbox triage agent",
  "Workflow extraction agent",
  "Evidence/review agent",
  "Resume/context agent",
  "Reminder/notification agent",
  "Model router/provider layer"
];

export function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Waiting for first sync";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function stageLabel(stage: string) {
  return stage.replace("_", " ");
}

export function activityTone(type: string) {
  if (type.includes("rejected")) return "bg-[var(--red-soft)] text-[var(--red)]";
  if (type.includes("interview")) return "bg-[var(--accent-soft)] text-[var(--accent-ink)]";
  if (type.includes("review")) return "bg-[var(--yellow-soft)] text-[var(--yellow)]";
  if (type.includes("created")) return "bg-[var(--blue-soft)] text-[var(--blue)]";
  return "bg-[var(--green-soft)] text-[var(--green)]";
}

export function reminderTone(kind: string) {
  if (kind === "critical") return "bg-[var(--red-soft)] text-[var(--red)]";
  if (kind === "warning") return "bg-[var(--yellow-soft)] text-[var(--yellow)]";
  return "bg-[var(--blue-soft)] text-[var(--brand-blue-ink)]";
}

export function modelHint(status: string, modelTag: string) {
  if (status === "ready") return `Gemma ready · ${modelTag}`;
  if (status === "model_missing") return `${modelTag} is not available to this Ollama account`;
  if (status === "unavailable") return "Check Ollama Cloud key or stay deterministic";
  if (status === "disabled") return "Optional Ollama Cloud is disabled";
  return "Verify Ollama Cloud API setup";
}

export function primaryDashboardAction({
  openReviews,
  dueSoon,
  interviews,
  offers,
  workspaceEmpty,
  connectorStatus
}: {
  openReviews: number;
  dueSoon: number;
  interviews: number;
  offers: number;
  workspaceEmpty: boolean;
  connectorStatus?: string;
}): PrimaryDashboardAction {
  if (workspaceEmpty && connectorStatus !== "connected") {
    return {
      eyebrow: "Gmail sync",
      title: "Open the judge demo or connect your inbox",
      body: "The public judge demo works with sanitized sample evidence and no keys. Real workspaces start from readonly Gmail sync, with optional Gemma checks in Settings.",
      href: "/settings?section=gmail",
      cta: "Connect Gmail",
      tone: "explore"
    };
  }
  if (workspaceEmpty) {
    return {
      eyebrow: "Gmail sync",
      title: "Sync recruiting mail to build the pipeline",
      body: "Gmail is connected. Sync recent recruiting messages, then CareerOS will triage, extract, review, and track the job workflow.",
      href: "/settings?section=gmail",
      cta: "Sync Gmail",
      tone: "explore"
    };
  }
  if (openReviews > 0) {
    return {
      eyebrow: "Review queue",
      title: `${openReviews} update${openReviews === 1 ? "" : "s"} need your decision`,
      body: "Uncertain or model-backed updates wait here until you accept, correct, or dismiss them.",
      href: "/review",
      cta: "Open review queue",
      tone: "review"
    };
  }
  if (dueSoon > 0) {
    return {
      eyebrow: "Reminders",
      title: `${dueSoon} reminder${dueSoon === 1 ? "" : "s"} due`,
      body: "Recruiter follow-ups and deadlines that need a decision.",
      href: "/notifications",
      cta: "Open notifications",
      tone: "reminder"
    };
  }
  if (offers > 0) {
    return {
      eyebrow: "Offers",
      title: `${offers} offer${offers === 1 ? "" : "s"} on the table`,
      body: "Compare evidence, deadlines, and recruiter notes before you decide.",
      href: "/applications",
      cta: "Open applications",
      tone: "interview"
    };
  }
  if (interviews > 0) {
    return {
      eyebrow: "Interviews",
      title: `${interviews} interview${interviews === 1 ? "" : "s"} in flight`,
      body: "Keep prep notes, JD links, and recruiter context near each application.",
      href: "/applications",
      cta: "Open applications",
      tone: "interview"
    };
  }
  return {
    eyebrow: "Judge demo",
    title: "Inspect the sample mailbox workflow",
    body: "Use the judge demo for the sanitized Kaggle story. Your workspace data stays separate.",
    href: "/judge-demo",
    cta: "Open judge demo",
    tone: "explore"
  };
}

export function actionToneClass(tone: PrimaryDashboardAction["tone"]) {
  switch (tone) {
    case "review":
      return "bg-[var(--yellow-soft)] text-[var(--yellow)]";
    case "reminder":
      return "bg-[var(--accent-soft)] text-[var(--accent-ink)]";
    case "interview":
      return "bg-[var(--blue-soft)] text-[var(--blue)]";
    default:
      return "bg-[var(--green-soft)] text-[var(--green)]";
  }
}
