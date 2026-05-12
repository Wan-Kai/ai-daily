# 本地 Codex 日报流程

本项目不要求为编辑总结流程配置 OpenAI API Key。日报的 LLM 编辑层由本地 Codex 完成。

目标流程如下：

1. 本地 Codex 自动任务每天 05:00（Asia/Shanghai）运行。
2. Codex 拉取最新的 `main` 分支。
3. Codex 执行 `npm run generate`，抓取 RSS/Atom/社媒 RSS 等信息源并生成日报 JSON。
4. Codex 使用本地会话模型编辑生成后的日报：
   - 将标题和摘要改写为中文，摘要需要完整交代发生了什么、为什么值得关注。
   - `whyItMatters` 只作为内部判断信号，不在页面上单独展示。
   - 研究、实践案例等长内容按金字塔原理总结：先写核心结论，再写支撑证据、关键数据、适用场景或限制条件。
   - 保留来源链接和基础元数据。
   - 不编造来源标题或摘要里没有支撑的信息。
   - 图片需要先确认尺寸和可读性，头像、小缩略图、低清图片或无法确认尺寸的图片不要展示。
5. Codex 执行 `npm run build` 验证静态站点构建。
6. Codex 提交 `data/reports/*.json` 以及相关页面生成结果。
7. Codex 推送到 `origin/main`。
8. GitHub Actions 在推送后部署静态站点到 GitHub Pages。

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
