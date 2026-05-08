import Link from "next/link";

export default function JudgeDemoPage() {
  return (
    <div className="page">
      <header>
        <p className="eyebrow">Judge demo</p>
        <h1>Static public demo remains provider-free</h1>
        <p className="subtle">
          The runnable local app now exposes the same core surfaces with seeded state. The archived source excerpt for the
          original static demo remains under source/web/app/judge-demo.
        </p>
      </header>
      <section className="card">
        <h2>Try the local runtime</h2>
        <p className="subtle">
          Start on the dashboard, run local processing, accept or correct a review item, and inspect model status with
          Ollama disabled.
        </p>
        <Link className="button" href="/">
          Open dashboard
        </Link>
      </section>
    </div>
  );
}
