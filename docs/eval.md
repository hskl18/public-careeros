# CareerOS Pipeline Eval Proof

This eval exists to prove the Kaggle/Gemma hackathon product loop, not to claim
a broad production benchmark. The question is narrow:

> Can CareerOS turn bounded recruiting mailbox evidence into extracted
> application state, review-gated risky updates, reminders, and safe ignores?

Current result:

![CareerOS pipeline eval results](media/eval-results.png)

## Result

| Metric           | Result | What it checks                                                           |
| ---------------- | -----: | ------------------------------------------------------------------------ |
| Overall          |  15/15 | Every eval fixture passed its expected action, stage, and safety checks. |
| Action routing   |  15/15 | The pipeline chose apply, review, or ignore correctly.                   |
| Stage extraction |  10/10 | Recruiting cases were assigned to the expected application stage.        |
| Review gate      |  15/15 | Risky or ambiguous cases were sent to review; safe/noise cases were not. |
| Mutation safety  |  15/15 | Risky cases did not silently mutate application state.                   |

Run it locally:

```bash
pnpm eval:pipeline
```

The command reads `eval/pipeline-fixtures.json`, runs the local
pipeline against a clean in-memory workspace, writes machine-readable results
to `eval/results.json`, and regenerates `docs/media/eval-results.png`.
The chart is rendered by `tools/render_eval_graph.py` with Python/matplotlib;
CI installs matplotlib before running the public release gate.

## Dataset Strategy

There is no single public Kaggle dataset that directly represents the full
CareerOS task: Gmail recruiting threads -> evidence -> extracted application
state -> review gate -> reminders. The eval therefore uses public dataset
components plus judge-safe synthetic recruiting fixtures.

| Component                         | Source                                                                                          | Why it maps to CareerOS                                                                                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enron Email Dataset               | <https://www.kaggle.com/datasets/wcukierski/enron-email-dataset>                                | Large public email corpus for mailbox/thread style, noisy non-product text, sender/subject/body patterns.                                                                                                              |
| SpamAssassin Email Classification | <https://www.kaggle.com/datasets/ganiyuolalekan/spam-assassin-email-classification-dataset>     | Spam/ham mail patterns used to validate that the mailbox triage layer can ignore non-recruiting noise.                                                                                                                 |
| LinkedIn Job Postings 2023-2024   | <https://www.kaggle.com/datasets/arshkon/linkedin-job-postings/data>                            | Job title, company, location, salary, job URL, application URL, and skill fields for application-state extraction.                                                                                                     |
| Resume dataset                    | <https://www.kaggle.com/datasets/haidermaseeh/resume-dataset>                                   | Resume/category/text component for resume-context and candidate-memory handling.                                                                                                                                       |
| Fake vs Real Job Postings         | <https://www.kaggle.com/datasets/khushikyad001/fake-vs-real-job-postings-synthetic-nlp-dataset> | Fraud/suspicious-job patterns that should route to review instead of trusted state mutation.                                                                                                                           |
| Synthetic recruiting fixtures     | Local judge-safe fixtures                                                                       | OA deadlines, interview invites, offer signals, rejections, ambiguous recruiter replies, and resume context are created as sanitized examples because public email datasets do not label these career-workflow states. |

The fixtures do not copy private Gmail or real candidate data. They are
sanitized, local, and shaped to exercise the same route as Gmail sync/import:
bounded text enters the pipeline, agents classify/extract, and risky output
goes to review.

## What The Eval Caught

The first run was intentionally useful: it passed only 10/15 cases. The weak
spots were exactly the places that matter for the product:

- high-confidence application receipts were being over-sent to review
- phone screens were not review-gated strongly enough
- password-reset noise was incorrectly treated as workflow evidence
- resume-context records lacked enough confidence signal
- job-posting fields were underweighted

The pipeline was then tightened:

- richer stage detection for OA, phone screen, technical interview, offer,
  rejection, recruiter next steps, and job-posting metadata
- natural-date parsing for deadlines such as `May 22, 2026`
- explicit non-recruiting noise suppression before extraction
- confidence boosts for source URL, resume version, cover letter, JD link,
  salary, and location fields
- review gating for assessments, interviews, offers, rejections, deadlines,
  and ambiguous records

After those fixes, the eval reaches 15/15 while keeping the high-stakes path
review-gated.

## What This Does Not Claim

- It is not a full live Gmail benchmark.
- It is not a broad open-domain email classifier score.
- It is not proof that every recruiter email is parsed perfectly.
- It does not claim OpenAI, Anthropic, OpenRouter, MLX, llama.cpp, LiteRT,
  vLLM, or SGLang adapters are shipped.

It is proof that this public demo has a real executable pipeline test for the
Kaggle story: evidence -> extraction -> review gate -> application/reminder
state, with safe deterministic fallback.
