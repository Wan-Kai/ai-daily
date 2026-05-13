# 本地 Codex 日报流程

本项目不要求为编辑总结流程配置 OpenAI API Key。日报的 LLM 编辑层由本地 Codex 完成。

目标流程如下：

1. 本地 Codex 自动任务每天 05:00（Asia/Shanghai）运行。
2. Codex 拉取最新的 `main` 分支。
3. Codex 先检查可用的补充发现源，例如 Gmail 中 `daodi154@gmail.com` 最近 24 小时收到的 AINews.com 邮件；如果有高价值邮件，提取标题、正文要点、图片、视频和 `Sources` 中的一手链接，写入 `data/email-candidates/YYYY-MM-DD.json`。
4. Codex 执行 `npm run generate`，抓取 RSS/Atom/社媒 RSS 等信息源，并合并 `data/email-candidates/YYYY-MM-DD.json` 中的临时候选后生成日报 JSON。
5. Codex 使用本地会话模型编辑生成后的日报：
   - 将标题和摘要改写为中文，摘要需要完整交代发生了什么、为什么值得关注。
   - `whyItMatters` 只作为内部判断信号，不在页面上单独展示。
   - 研究、实践案例等长内容按金字塔原理总结：先写核心结论，再写支撑证据、关键数据、适用场景或限制条件。
   - 论文解读需要说人话，避免「不是……而是……」这类模板句式；优先用 `核心结论`、`支撑证据`、`我的判断` 等结构化小段落回答两个问题：论文阐述的是什么，以及它用哪些证据解释/证明。
   - 摘要中需要适度加粗关键概念、核心结论、重要数据、模型名、产品名、限制条件和行动判断，方便扫读；不要整句大面积加粗。
   - 保留来源链接和基础元数据。
   - 不编造来源标题或摘要里没有支撑的信息。
   - 图片需要从候选图片中按尺寸、横纵比、来源类型和清晰度选择更适合正文展示的一张；头像、小缩略图、低清图片或无法确认尺寸的图片不要展示。
   - 如果来源提供可直接播放的视频地址，可以在日报详情页展示视频；如果只提供普通页面链接，则保留原文链接。
6. Codex 执行 `npm run build` 验证静态站点构建。
7. Codex 提交 `data/reports/*.json` 以及相关页面生成结果。
8. Codex 推送到 `origin/main`。
9. GitHub Actions 在推送后部署静态站点到 GitHub Pages。

## 本地命令

```bash
git pull --ff-only
npm run generate
npm run build
git add data/reports
git commit -m "更新 AI 日报"
git push
```

Codex 自动任务只在日报内容或站点构建结果变化时提交。

## 邮件发现源

AINews.com 站点本身没有稳定公开 RSS，且普通命令行抓取容易触发 Cloudflare challenge；如果用户用 `daodi154@gmail.com` 订阅了 AINews.com，优先把邮件当作补充发现源。

邮件源处理原则：

- 只检索最近 24 小时内收到的 AINews.com 邮件。
- AINews.com 是二级发现源，不直接作为产品快讯的一手来源。
- 优先提取邮件正文里的 `Sources`、官方链接或原始报道链接；如果找到一手来源，日报条目的 `link` 使用一手来源，`source` 可保留为 `AINews.com 邮件订阅`。
- 如果一手来源已被当天或前一天日报收录，丢弃邮件候选，避免重复报道。
- 只有当邮件内容本身提供了独家整理、实践案例、研究脉络或高价值背景时，才允许使用 AINews.com 文章链接作为最终链接。
- 邮件候选写入 `data/email-candidates/YYYY-MM-DD.json`，该文件是本地临时候选文件，不提交到仓库。
- 如果自动化上下文暂时无法使用 Gmail 插件，邮件源视为本次不可用，记录原因并继续执行 `npm run daily`；邮件源不可用不能阻断 RSS、Twitter、Folo、GitHub 等主信息源生成。

临时候选格式：

```json
{
  "items": [
    {
      "title": "OpenAI B2B Signals Shows Enterprise AI Needs More Than Access",
      "titleZh": "OpenAI B2B Signals 显示企业 AI 不只是工具可用性问题",
      "link": "https://openai.com/index/introducing-b2b-signals/",
      "publishedAt": "2026-05-13T05:30:00+08:00",
      "source": "AINews.com 邮件订阅",
      "sourceType": "social",
      "section": "social_shares",
      "channel": "email_discovery",
      "trust": "expert",
      "sourceWeight": 5,
      "summaryZh": "先写核心结论，再写 AINews 邮件和一手来源如何支撑这个判断。",
      "imageCandidates": [
        { "url": "https://example.com/image.jpg", "source": "email-image" }
      ]
    }
  ]
}
```

## 编辑准则

- 展示给用户看的内容使用中文。
- 每条资讯要适合日报阅读，但摘要必须自洽，读者不需要额外的“为什么重要”字段也能理解价值。
- 不要过度压缩关键事实。如果来源包含功能清单、产品能力、发布时间、支持范围、指标、限制或命名集成，中文摘要要保留这些信息。
- 保留事实不确定性，不把传闻写成确定事实。
- 将“为什么值得关注”的判断融入摘要正文。
- 保留原始链接。
- 除非来源后来恢复成功，否则不要删除抓取异常诊断。
- 如果 RSS 抓取整体失败，不要用空日报覆盖已有的有效日报。

## GitHub Actions 角色

GitHub Actions 不再负责 LLM 编辑或日报生成，只在本地 Codex 推送后构建并部署静态站点。
