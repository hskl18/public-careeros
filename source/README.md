# Selected Source

This folder contains reviewed source excerpts copied from the private CareerOS
implementation for the public CareerOS release candidate.

Other Candidate is the hosted product built on top of CareerOS.

The excerpts are intentionally narrow:

- `web/app/judge-demo/page.tsx`: the public, static, Gmail-free judge demo route.
- `web/components/*` and `web/lib/site-metadata.ts`: supporting public-page
  metadata and presentation helpers used by the judge demo.
- `contracts/*`: public DTO shapes for trace summaries, application artifact
  evidence, and review queue evidence cards.
- `application/Services/AgentTraceSummaryBuilder.cs`: model trace metadata
  normalization.
- `application/Services/ApplicationArtifactEvidenceService.cs`: the narrow
  artifact-to-evidence-card path with size/type validation, redaction, and
  review-gate behavior.

The repository root now contains the standalone CareerOS local runtime with a
replaceable persistence interface, deterministic fallback, bounded optional
Ollama analysis, SQLite local persistence, optional Gmail connector placeholders,
and review-gated model output. This `source/` folder remains an
archive of reviewed excerpts copied from the hosted implementation so reviewers
can inspect the lineage without exposing private deployment settings, Gmail
data, account-specific diagnostics, or local runtime artifacts.
