# Local Codex Daily Workflow

This project does not require an OpenAI API key for editorial LLM processing.

The intended workflow is:

1. A local Codex automation runs every morning at 05:00 Asia/Shanghai.
2. Codex pulls the latest `main` branch.
3. Codex runs `npm run generate` to fetch RSS and Atom sources and create the daily report JSON.
4. Codex uses its local conversation model to edit the generated report:
   - rewrite summaries in Chinese and make them complete enough to explain what happened and why it matters
   - use `whyItMatters` only as an internal editorial signal; do not rely on a separate "why it matters" block in the rendered page
   - refine advantage points
   - keep source links and metadata intact
   - avoid inventing claims not supported by the source title or summary
5. Codex runs `npm run build` to verify the static site builds.
6. Codex commits `data/reports/*.json` changes.
7. Codex pushes to `origin/main`.
8. GitHub Actions deploys the static site to GitHub Pages after the push.

## Local Commands

```bash
git pull --ff-only
npm run generate
npm run build
git add data/reports
git commit -m "chore: generate daily AI report"
git push
```

The Codex automation should only commit when the generated report changed.

## Editorial Guidelines

- Write in Chinese.
- Keep each item short enough for a daily briefing, but make the summary self-contained enough that readers can understand the importance without a separate explanation field.
- Do not over-compress important facts. If the source includes concrete feature lists, product capabilities, launch timing, supported scope, metrics, limitations, or named integrations, preserve those details in the Chinese summary even when the summary becomes longer.
- Preserve factual uncertainty.
- Fold the "why it matters" judgment into the summary instead of displaying it as a separate user-facing field.
- Preserve original links.
- Do not remove source failure diagnostics unless the source later succeeds.
- If the RSS fetch fails completely, do not overwrite a useful existing report with an empty one.

## GitHub Actions Role

GitHub Actions no longer performs LLM or report generation. It only builds and deploys the static site after local Codex pushes report changes.
