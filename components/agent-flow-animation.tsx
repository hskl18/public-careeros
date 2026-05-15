const flowStages = [
  {
    index: "01",
    label: "Mailbox",
    title: "Triage",
    detail: "Recruiting signal",
    asset: "/agents/agent-inbox-triage.svg"
  },
  {
    index: "02",
    label: "Workflow",
    title: "Extract",
    detail: "Typed proposal",
    asset: "/agents/agent-workflow-extraction.svg"
  },
  {
    index: "03",
    label: "Evidence",
    title: "Review gate",
    detail: "Blocks mutation",
    asset: "/agents/agent-review-evidence.svg"
  },
  {
    index: "04",
    label: "Resume",
    title: "Context",
    detail: "Candidate facts",
    asset: "/agents/agent-resume-extraction.svg"
  },
  {
    index: "05",
    label: "Notify",
    title: "Reminders",
    detail: "No stale follow-up",
    asset: "/agents/agent-follow-up-task.svg"
  },
  {
    index: "06",
    label: "Router",
    title: "Gemma/Ollama",
    detail: "Cloud or fallback",
    asset: "/agents/agent-career-orchestrator.svg"
  }
];

type AgentFlowAnimationProps = {
  modelStatus: string;
  modelTag: string;
};

export function AgentFlowAnimation({ modelStatus, modelTag }: AgentFlowAnimationProps) {
  return (
    <section className="agent-flow-animation" aria-label="Animated multi-agent pipeline">
      <div className="agent-flow-animation__head">
        <div>
          <p className="eyebrow">Animated pipeline</p>
          <h2>How a recruiting email becomes reviewed application state</h2>
        </div>
        <div className="agent-flow-animation__status" aria-label={`Model router status ${modelStatus}`}>
          <span className={modelStatus === "ready" ? "is-ready" : "is-fallback"} />
          <strong>{modelStatus === "ready" ? "Gemma ready" : "Deterministic fallback"}</strong>
          <small>{modelTag}</small>
        </div>
      </div>

      <div className="agent-flow-track" aria-hidden="true">
        <span className="agent-flow-track__line" />
        <span className="agent-flow-packet agent-flow-packet--mail">mail</span>
        <span className="agent-flow-packet agent-flow-packet--json">json</span>
        <span className="agent-flow-packet agent-flow-packet--review">gate</span>
      </div>

      <div className="agent-flow-stages">
        {flowStages.map((stage) => (
          <article className="agent-flow-stage" key={stage.index}>
            <img className="agent-flow-stage__mascot" src={stage.asset} alt="" aria-hidden="true" />
            <span>{stage.index}</span>
            <small>{stage.label}</small>
            <strong>{stage.title}</strong>
            <em>{stage.detail}</em>
          </article>
        ))}
      </div>

      <div className="agent-flow-output">
        <div>
          <span>Input</span>
          <strong>Recruiter thread</strong>
          <small>bounded Gmail snippet</small>
        </div>
        <div>
          <span>Gate</span>
          <strong>Accept / correct / dismiss</strong>
          <small>model output never mutates directly</small>
        </div>
        <div>
          <span>Output</span>
          <strong>Application + reminder</strong>
          <small>evidence-backed local state</small>
        </div>
      </div>
    </section>
  );
}
