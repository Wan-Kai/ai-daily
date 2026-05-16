# 精选内容工作流

入口页长期保留三类精选内容：

- 精选论文
- 精选播客
- 精选博客

## 数据文件

- `data/curation-sources.json`：精选候选源配置。
- `data/curation-candidates/YYYY-MM-DD.json`：自动抓取后等待人工审核的候选池。
- `data/curation-rejections.json`：被拒绝的候选记录，用于后续去重和避免反复出现。
- `data/curation/papers.json`：已发布精选论文。
- `data/curation/podcasts.json`：已发布精选播客。
- `data/curation/blogs.json`：已发布精选博客。

## 自动更新

`npm run curate` 会抓取候选源、计算质量分、按链接和标题去重，并把高分内容写入当天的待审核候选池。它不会直接写入正式发布库。

`npm run curate:apply` 会读取标题包含「精选内容审批」的 GitHub Issue，解析其中的审批 JSON，把通过的论文/博客候选写入 `data/curation/*.json`，把拒绝的候选写入 `data/curation-rejections.json` 并从待审库移除，暂不处理的候选继续保留。

精选播客是两阶段发布：第一次审批通过只能触发或确认本地 Whisper medium 转写，脚本会把候选标记为 `reviewStatus: "needs_ai_review"`、`transcriptAiReviewStatus: "needs_review"` 并继续留在待审池。Codex 需要人工介入，结合标题、节目稿、上下文和转写文本校准明显错词、术语、人名、段落可读性与摘要质量；校准完成后写入 `transcriptAiReviewStatus: "approved"` 和 `transcriptAiReviewedAt`，再次审批通过时才允许写入 `data/curation/podcasts.json`。

`npm run daily` 只负责生成日报、修复媒体、审查日报、生成新的待审核候选并构建页面，不再读取精选审批 Issue。

精选审批发布改由独立命令 `npm run curation:publish` 负责。它会先执行 `npm run curate:apply` 读取标题包含「精选内容审批」的 GitHub Issue，把审批结果同步到正式发布库或拒绝库，再重新构建站点。这个命令不能代替 Codex 对播客逐字稿的 AI 校准；未带 `transcriptAiReviewStatus: "approved"` 的播客会继续留在待审池。

精选内容不要求每天更新。没有足够好的内容时，应保持空缺或维持旧内容，不要为了填充而发布低质量条目。

## 人工审批页面

构建后会生成一个不放在公开导航里的页面：`/curation-review.html`。这个页面用于审核精选论文、精选播客和精选博客候选。

页面操作流程：

1. 为每条候选选择「通过」「拒绝」或「暂不处理」。
2. 可在备注里写修改建议、拒绝原因或发布备注。
3. 点击「提交到 GitHub Issue」，页面会打开预填好的 GitHub Issue。
4. 在 GitHub 页面提交 Issue。
5. 下一次执行 `npm run curation:publish` 时，脚本会读取 Issue 并同步审批结果。

## 自动化建议

建议为 `npm run curation:publish` 单独配置一个自动化任务或工作流，让它按固定频率轮询 open 的审批 Issue。这样精选论文/博客发布不会阻塞每日日报的固定时点任务。播客仍需要本地 Codex 完成转写后的 AI 校准，GitHub Actions 这类纯脚本环境不应直接发布未校准逐字稿。

页面还保留「复制审批信息」作为兜底。如果 GitHub 页面无法打开，可以复制后发给 Codex 手动处理。

## 入选原则

精选论文优先使用 Hugging Face 周榜；arXiv、Semantic Scholar、alphaXiv 等更适合作为候选补充和质量校验，不应只凭关键词入选。

精选博客优先选择长期可回看的技术解释、工程复盘、研究解读和重要实践案例。普通产品公告、活动通知、speaker lineup、newsletter、变更日志不进入精选。

精选博客的信息源优先级为：顶尖机构官方博客、核心研究者个人博客、开源社区深度文章、综合科技媒体深度报道。当前已接入 OpenAI、Google DeepMind、Google AI、Microsoft Research、NVIDIA、Hugging Face、LangChain、Qdrant、Databricks、Simon Willison、Latent Space、Andrej Karpathy、MIT Technology Review、TechCrunch AI 等候选源；如果后续补充 Anthropic、Meta AI、李沐、Yann LeCun、Geoffrey Hinton、36 氪或 Reddit，需要优先确认是否有稳定 RSS 或可自动抓取入口，再决定是否启用。

精选博客每轮自动追加时，同一个来源最多入选 1 篇，避免 Simon Willison、OpenAI 或 Microsoft Research 这类高权重来源连续刷屏。自动入选后仍需要人工复核摘要质量，只有能讲清方法、案例、论证路径或工程取舍的文章才长期保留。

精选播客分为中文播客和英文播客。只有主题清晰、能提供一手访谈、实践经验或趋势判断的单集才进入精选。

## 人工审查

自动抓取只能做候选发现和粗筛。进入页面展示前，需要尽量把标题和摘要改成中文：

- 论文使用 `**核心结论**`、`**如何论证**`、`**阅读价值**`。篇幅可以更长，第一要点是把论文的核心观点和作者如何论证讲清楚，不要为了短而牺牲关键信息。
- 博客使用 `**核心内容**`、`**展开方式**`。不要写单独的「我的判断」或「读者能获得什么」，把文章讲了什么、如何展开、关键案例、方法细节和工程取舍讲清楚即可。
- 播客使用 `**核心内容**`、`**内容线索**`。不要写单独的「我的判断」或「读者能获得什么」，把这一期聊了什么、嘉宾/主持如何展开、关键案例和讨论脉络讲清楚即可。

待审候选页也是给人看的审核材料，不能展示「需要在摘要里讲清」「正式发布前需要补充」这类写作指令。候选摘要如果信息不足，可以在 `**审核重点**` 里直接说明哪些点需要复核，但 `**核心结论**` / `**核心内容**` 必须回答“这篇论文、文章或播客到底讲了什么”。

摘要需要保留关键事实、数据和限制条件，避免“值得关注”这类空泛结尾。
