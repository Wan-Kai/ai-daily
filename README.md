# AI Daily

AI Daily is a lightweight static site for publishing a daily digest of AI news, papers, and major lab or vendor blog updates.

## What It Does

- Tracks configured AI information sources in `data/sources.json`
- Fetches RSS and Atom feeds with a scheduled GitHub Actions workflow
- Builds a dated daily report under `data/reports/`
- Highlights likely advantage points such as releases, benchmarks, research claims, safety updates, and developer impact
- Publishes the generated static site to GitHub Pages

## Local Usage

```bash
npm run daily
```

The built site is written to `dist/`.

## Add Or Edit Sources

Edit `data/sources.json`.

```json
{
  "name": "OpenAI Blog",
  "url": "https://openai.com/news/rss.xml",
  "type": "blog",
  "weight": 5
}
```

Supported `type` values:

- `company`
- `research`
- `paper`
- `blog`
- `community`

## GitHub Pages

After the repository is pushed to GitHub:

1. Open repository settings.
2. Go to **Pages**.
3. Set source to **GitHub Actions**.
4. The `Daily AI Digest` workflow will generate and deploy the site every day.

## Notes

This first version intentionally avoids runtime dependencies. It uses Node.js built-ins so the scheduled workflow stays easy to operate. A future version can add LLM-based summarization by using an API key in GitHub Actions secrets.
