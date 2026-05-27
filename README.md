# AI Daily

AI Daily is a lightweight static site for publishing a daily digest of AI news, papers, and major lab or vendor blog updates.

## 在线访问

- [AI Daily 日报目录](https://wan-kai.github.io/ai-daily/index.html#daily)

## What It Does

- Tracks configured AI information sources in `data/sources.json`
- Fetches RSS and Atom feeds with a scheduled GitHub Actions workflow
- Builds a dated daily report under `data/reports/`
- Highlights likely advantage points such as releases, benchmarks, research claims, safety updates, and developer impact
- Publishes the generated static site to GitHub Pages

## Local Usage

```bash
npm run generate
```

生成后需要先人工中文化并修订当天报告（见 `docs/local-codex-daily-workflow.md`），再依次执行：

```bash
npm run repair-media
npm run review
npm run build
```

构建产物写入 `dist/`。

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
4. The `Deploy AI Daily` workflow will generate and deploy the site every day.

## Notes

This project intentionally avoids heavy runtime dependencies. Daily reports are edited and localized to Chinese manually before publishing.
