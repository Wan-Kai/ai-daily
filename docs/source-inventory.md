# 信息源台账

更新时间：2026-05-13

本文档用于整理 `data/sources.json` 中的信息源，方便后续审查、补充和调整权重。它和 `docs/source-audit-2026-05-13.md` 的区别是：审计文档记录某次抓取结果，本文档记录长期维护口径。

## 总览

当前已启用信息源 132 个，无禁用源。

| 维度 | 数量 | 说明 |
| --- | ---: | --- |
| 产品快讯 | 45 | 主要来自 AI 厂商官方 Twitter RSS 网关，只放明确产品、模型、API、功能、可用性变化 |
| 研究前线 | 18 | 研究博客、论文 RSS、技术分析和 AI 研究社区 |
| 开源项目 | 8 | GitHub Trending、开源项目博客、开源社区源 |
| 社媒观察 | 61 | 专家、从业者、社区讨论、厂商博客中偏观点和趋势的内容 |
| 实践案例 | 0 | 暂无独立来源，后续需要重点补充 |

| 抓取类型 | 数量 | 说明 |
| --- | ---: | --- |
| `rss` | 129 | 普通 RSS/Atom，包括博客、Twitter RSS 网关、微信 RSS 网关 |
| `github_trending` | 2 | GitHub Trending daily/weekly 页面解析 |
| `folo` | 1 | 通过 Folo list API 拉取社区聚合内容 |

## 配置字段口径

| 字段 | 用途 | 维护建议 |
| --- | --- | --- |
| `name` | 来源展示名 | 尽量保留平台或账号名，方便审查 |
| `url` | RSS、页面或 API 地址 | 能用公开 RSS 时优先用 RSS；需要凭据时不要写入仓库 |
| `kind` | 抓取器类型 | 当前支持 `rss`、`github_trending`、`folo`、`huggingface_papers` |
| `type` | 来源大类 | 建议用 `company`、`research`、`open_source`、`social` |
| `section` | 默认栏目 | 只是默认归类，最终还要靠筛选和 review 判断 |
| `channel` | 内容通道 | 用于区分 `social`、`vendor_blog`、`research_blog`、`paper_feed` 等 |
| `trust` | 信任等级 | `official` 高于 `expert`，`rank` 适合榜单，`community` 适合社区源 |
| `weight` | 初筛权重 | 官方产品源一般 9，研究/开源 5-8，社区讨论 3-4 |
| `limit` | 单源最大 item | 高噪声源要限制，榜单和 Folo 源建议 10-20 |
| `lookbackDays` | 少数低频源回看窗口 | 日报最终仍以最近 24 小时为主，低频博客可适当放宽候选池 |

## 栏目维护原则

### 产品快讯

只放明确的新产品、新功能、新模型、新 API、集成支持、版本发布或可用性变化。当前产品快讯主要由官方 Twitter RSS 网关构成，包括 OpenAI、Anthropic、Google AI、Qwen、DeepSeek、Claude、Cursor、Windsurf、v0、NotebookLM、Perplexity、LlamaIndex、LangChain、Dify、ollama、Jina、Qdrant、Milvus、ElevenLabs、Runway、Midjourney、Cognition、Replit 等。

审查重点：

- 活动预告、案例展示、观点讨论不要放入产品快讯。
- 多条同一线程需要合并成一条完整资讯。
- 如果关键事实藏在后续推文里，摘要必须保留功能清单、支持范围、价格、速度、限制条件等。

### 研究前线

研究前线包含论文、研究博客、技术分析和前沿模型评测。当前重点源：

| 来源 | 地址 | 说明 |
| --- | --- | --- |
| arXiv cs.AI | `https://rss.arxiv.org/rss/cs.AI` | Folo Papers 中确认的 AI 论文 RSS |
| arXiv cs.CV | `https://rss.arxiv.org/rss/cs.CV` | Folo Papers 中确认的视觉论文 RSS |
| AWS Machine Learning Blog | `https://aws.amazon.com/blogs/amazon-ai/feed/` | 工程和企业 AI 落地文章较多 |
| Microsoft Research Blog | `http://research.microsoft.com/rss/news.xml` | 官方研究动态 |
| Latent Space | `https://www.latent.space/feed` | AI 工程与研究社区分析 |
| Simon Willison's Weblog | `https://simonwillison.net/atom/everything/` | LLM 工具、模型和安全分析 |
| deeplearning.ai | `https://rsshub.bestblogs.dev/deeplearning/the-batch` | AI 周报和研究解读 |

审查重点：

- 摘要需要按金字塔原理写：先给核心结论，再写证据、数据、方法、适用场景和限制。
- 论文源数量大，必须宁缺毋滥，优先选择和 Agent、模型能力、多模态、工程落地强相关的内容。

### 开源项目

当前重点源：

| 来源 | 地址 | 说明 |
| --- | --- | --- |
| GitHub Trending Daily | `https://github.com/trending?since=daily` | 每日趋势项目 |
| GitHub Trending Weekly | `https://github.com/trending?since=weekly` | 周趋势补充，避免每日榜过窄 |
| LangChain Blog | `https://blog.langchain.dev/rss/` | 开源 Agent 框架生态 |
| The GitHub Blog | `https://github.blog/feed/` | GitHub 和 Copilot 生态 |
| Dify | 微信 RSS | 开源 AI 应用平台 |
| HelloGitHub | 微信 RSS | 中文开源项目发现 |
| Qdrant | `https://qdrant.tech/index.xml` | 向量数据库 |
| FireCrawl Blog | `https://api.bestblogs.dev/feed/fireCrawlBlog` | 开源抓取/Agent 基础设施 |

审查重点：

- 明确开源项目、GitHub 仓库、开源版本发布、项目教程归入这里。
- 产品官号发布的开源项目也应该归到开源项目，不要默认放产品快讯。

### 社媒观察

社媒观察承接专家观点、转述、社区讨论、行业信号和二手解读。当前主要包含：

- 专家账号：Sam Altman、Dario Amodei、Andrej Karpathy、Yann LeCun、Fei-Fei Li、Andrew Ng、Thomas Wolf、Demis Hassabis、Jeff Dean、Lilian Weng、Simon Willison、Gary Marcus 等。
- 中文观察者：宝玉、歸藏、向阳乔木、李继刚、AI 产品黄叔等。
- 社区和聚合：The Rundown AI、AI Engineer、Latent.Space、Folo AI Community Discussions。
- 厂商博客中不适合放产品快讯的观点和行业内容。

审查重点：

- 社媒源高噪声，短回复、活动通知、表情包、无上下文链接要过滤。
- 能补足官方发布之外的趋势判断，但不能替代一手事实。

### 实践案例

当前没有独立配置源。实践案例应该放真实组织、客户或团队如何使用 AI 的落地案例，例如企业部署、客户故事、生产工作流、A/B 测试、真实业务采用。

建议优先补充：

| 类型 | 候选方向 | 说明 |
| --- | --- | --- |
| 厂商客户案例 | OpenAI Stories、Anthropic Customer Stories、AWS ML Case Studies、Google Cloud AI customer stories | 最适合补实践案例 |
| 垂直行业博客 | 金融、医疗、制造、教育领域 AI 案例源 | 能让日报不只停留在模型和工具 |
| 企业工程博客 | Stripe、Shopify、Uber、Netflix、Airbnb、Canva 等 | 关注真实生产系统和团队流程 |

## Folo 发现结果

这次通过 Chrome 插件登录 Folo 后确认了以下来源。

### 已接入

| Folo 来源 | 实际来源 | 接入方式 | 当前处理 |
| --- | --- | --- | --- |
| Folo Papers | `https://rss.arxiv.org/rss/cs.AI`、`https://rss.arxiv.org/rss/cs.CV` | 直接 RSS | 已接入研究前线 |
| Folo Reddit | `r/artificial`、`r/MachineLearning` | Folo list API | Reddit 原始 RSS 当前网络超时，已通过 `kind: folo` 接入 |

### 暂不接入

| 来源 | 地址 | 原因 |
| --- | --- | --- |
| AI资讯日报 RSS Feed | `https://justlovemaki.github.io/CloudFlare-AI-Insight-Daily/rss.xml` | 竞品二次聚合源，适合对比，不适合直接进入日报内容池 |
| AI 开发者日报 | `https://ainews.liduos.com/rss.xml` | 二次聚合源，先不直接接入 |
| Last Week in AI | `https://lastweekin.ai/feed` | 已有同类源，且更新频率偏周刊 |
| Anthropic News | `https://rsshub.bestblogs.dev/anthropic/news` | 已在现有源中 |
| Roo Code Blog | `https://blog.roocode.com/feed` | 最新内容较旧，暂不接入 |
| Cursor Blog | `https://cursor.com/atom.xml` | 最新内容较旧；Cursor 官方 Twitter 已覆盖产品更新 |
| 高军 AI 日报 | `https://daily.gojun.me/feed.xml` | 内容较旧且是二次聚合 |

## 后续补源优先级

1. 实践案例源：这是当前最大缺口。
2. 论文推荐源：需要比 arXiv RSS 更有筛选能力的来源，例如 Papers with Code、Semantic Scholar、AlphaXiv、Hugging Face Papers 的稳定替代方案。
3. 开源项目源：可以补充 GitHub Topic、Hacker News Show HN、Product Hunt AI 工具，但要注意噪声。
4. 产品官方源：优先补缺失的官方 Twitter/RSS，而不是媒体转述。
5. 社区源：只补高信噪比列表，避免让日报被短讨论淹没。

## 审查清单

补充新源前先问三件事：

- 它是一手源、专家源、榜单源，还是二次聚合源？
- 它更适合哪个栏目？是否会污染产品快讯？
- 它过去 24 小时是否能稳定产生可解析 item？

补充新源后至少做一次：

```bash
npm run generate
npm run review
npm run build
```

如果只是验证源是否可取，可以先单独用 `curl` 或临时 Node 脚本检查 RSS 标题、item 数量和最新发布时间。
