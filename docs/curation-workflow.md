# 精选内容工作流

入口页长期保留三类精选内容：

- 精选论文
- 精选播客
- 精选博客

## 数据文件

- `data/curation-sources.json`：精选候选源配置。
- `data/curation/papers.json`：已发布精选论文。
- `data/curation/podcasts.json`：已发布精选播客。
- `data/curation/blogs.json`：已发布精选博客。

## 自动更新

`npm run curate` 会抓取候选源、计算质量分、按链接和标题去重，并把高分内容追加到对应精选库。`npm run daily` 已包含 `npm run curate`，因此每天定时任务会自动尝试更新精选内容。

精选内容不要求每天更新。没有足够好的内容时，应保持空缺或维持旧内容，不要为了填充而发布低质量条目。

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

摘要需要保留关键事实、数据和限制条件，避免“值得关注”这类空泛结尾。
