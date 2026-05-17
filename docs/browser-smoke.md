# Browser Smoke And Screenshot Proof

Run after `pnpm build`:

```bash
pnpm smoke:browser
```

The smoke script launches local Chrome in headless mode, starts `next start`
against temporary CareerOS data directories, and does not touch the developer's
`.careeros-data` workspace. It runs both a seeded judge fixture and a clean
workspace fixture, then produces the screenshot set used as local judge proof for
the public demo.

Pair this with `pnpm eval:pipeline` for executable product-loop proof. The eval
command writes `eval/results.json` and `docs/media/eval-results.png`.

Verified routes:

- `/`
- `/judge-demo`
- `/applications`
- `/applications/app_atlas`
- `/review`
- `/resume`
- `/agents`
- `/settings`
- `/settings?section=gmail`
- `/notifications`

Checks:

- desktop and mobile viewport render
- required judge/demo and empty-workspace setup copy is visible
- no page-level horizontal overflow
- no legacy page links
- screenshots are written to `test-results/browser-smoke/`

The seeded fixture uses sanitized sample recruiting evidence. The clean fixture
verifies that first-run empty states point to judge demo, Gmail setup, and Gemma
setup without looking like a broken product. Neither fixture requires Gmail, API
keys, Ollama Cloud, desktop Ollama, or model downloads.

## Screenshot Proof Set

Curated public assets:

- `docs/media/judge-demo.png` — README-ready screenshot copied from the
  sanitized judge-demo browser smoke.
- `docs/media/submission-thumbnail-560x280.png` — cropped Kaggle card image from
  the same sanitized judge demo.
- `docs/media/architecture.png` — polished README/Kaggle
  architecture diagram for the Gemma multi-agent pipeline.
- `docs/media/eval-results.png` — pipeline eval graph for the Kaggle writeup
  and README.

Generated files:

- `seeded-desktop-judge-demo.png` / `seeded-mobile-judge-demo.png`
- `seeded-desktop-home.png` / `seeded-mobile-home.png`
- `seeded-desktop-applications.png`
- `seeded-desktop-applications-app_atlas.png`
- `seeded-desktop-review.png`
- `seeded-desktop-resume.png`
- `seeded-desktop-agents.png`
- `seeded-desktop-settings.png`
- `seeded-desktop-notifications.png`
- `empty-desktop-home.png` / `empty-mobile-home.png`
- `empty-desktop-applications.png`
- `empty-desktop-settings-section-gmail.png`
- `empty-desktop-notifications.png`

Use these for Kaggle thumbnail/video planning only after a final privacy pass.
They are ignored by git because screenshots are generated artifacts.
