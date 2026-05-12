# AI Daily 架构设计文档

## 1. 项目目标

AI Daily 是一个用于持续跟踪 AI 资讯、论文和大厂技术博客的日报站点。

项目目标包括：

- 每天生成一份 AI 相关中文日报。
- 信息来源包括 AI 公司博客、研究机构博客、论文源、社区资讯等。
- 对每条资讯提取摘要、优势点、重要性和分类。
- 将日报以网页形式发布到 GitHub Pages。
- 避免使用 OpenAI API Key 和 SDK 计费，优先使用本地 Codex 进行 LLM 编辑处理。

线上仓库：

- https://github.com/Wan-Kai/ai-daily

线上站点：

- https://wan-kai.github.io/ai-daily/

本地仓库：

- `/Users/ktoon/Documents/MT/projects/ai-daily`

## 2. 当前总体架构

当前系统分为三层：

```text
信息源配置层
  -> 本地日报生成与编辑层
  -> GitHub Pages 部署层
```

具体流程：

```text
data/sources.json
  -> scripts/generate-daily.mjs 抓取 RSS/Atom
  -> 本地 Codex 编辑日报内容
  -> data/reports/YYYY-MM-DD.json
  -> scripts/build-site.mjs 构建静态页面
  -> git commit + push
  -> GitHub Actions 部署 GitHub Pages
```

当前设计的核心原则是：

- GitHub Actions 不负责 LLM 处理。
- GitHub Actions 不需要 OpenAI API Key。
- LLM 编辑工作放在本地 Codex 环境中完成。
- GitHub 端只负责静态站点构建和部署。

## 3. 仓库结构

```text
ai-daily/
  .github/
    workflows/
      daily.yml
  data/
    sources.json
    reports/
      YYYY-MM-DD.json
  dist/
  docs/
    architecture-design.md
    local-codex-daily-workflow.md
  scripts/
    generate-daily.mjs
    build-site.mjs
  package.json
  README.md
```

主要文件说明：

- `data/sources.json`：信息源配置。
- `data/reports/`：每日生成的日报 JSON。
- `scripts/generate-daily.mjs`：抓取信息源并生成基础日报。
- `scripts/build-site.mjs`：将日报 JSON 构建为静态 HTML。
- `.github/workflows/daily.yml`：GitHub Pages 部署工作流。
- `docs/local-codex-daily-workflow.md`：本地 Codex 日报生成流程说明。
- `docs/architecture-design.md`：当前架构设计文档。

## 4. 信息源配置

信息源维护在：

```text
data/sources.json
```

每个信息源示例：

```json
{
  "name": "OpenAI News",
  "url": "https://openai.com/news/rss.xml",
  "type": "company",
  "weight": 5
}
```

字段说明：

- `name`：来源名称。
- `url`：RSS 或 Atom Feed 地址。
- `type`：来源类型。
- `weight`：来源权重，影响排序优先级。

当前支持的类型包括：

- `company`：公司或产品更新。
- `research`：研究机构博客。
- `paper`：论文源。
- `blog`：普通技术博客。
- `community`：社区资讯。

后续新增信息源时，优先修改 `data/sources.json`。

## 5. 日报生成流程

基础生成脚本：

```text
scripts/generate-daily.mjs
```

本地运行命令：

```bash
npm run generate
```

当前脚本职责：

1. 读取 `data/sources.json`。
2. 并发抓取 RSS/Atom 内容。
3. 解析标题、链接、摘要、发布时间、来源等信息。
4. 过滤最近 4 天内的内容。
5. 按链接去重。
6. 根据关键词和来源权重进行初步打分。
7. 选出最多 30 条内容。
8. 生成基础标签和优势点。
9. 写入 `data/reports/YYYY-MM-DD.json`。

当前生成逻辑是规则版，主要用于给 Codex 提供候选内容和基础结构。

## 6. 本地 Codex LLM 编辑层

由于当前只有 OpenAI Plus 会员，没有单独的 OpenAI API 计费通道，因此不使用 OpenAI SDK。

LLM 编辑职责由本地 Codex 完成。

预期本地 Codex 处理内容：

- 将摘要改写为中文。
- 提炼每条资讯的「为什么重要」。
- 优化优势点表达。
- 按资讯性质进行分类。
- 保留来源、链接、发布时间等元数据。
- 避免编造 RSS 标题和摘要之外的信息。

建议处理原则：

- 保持日报风格简洁。
- 使用中文。
- 对不确定信息保留不确定性。
- 不夸大模型、产品或论文结论。
- 只基于已有来源内容进行总结。

本地 Codex 处理完成后，仍然输出到：

```text
data/reports/YYYY-MM-DD.json
```

## 7. 静态站点构建

构建脚本：

```text
scripts/build-site.mjs
```

本地构建命令：

```bash
npm run build
```

完整本地命令：

```bash
npm run daily
```

构建产物目录：

```text
dist/
```

当前页面结构：

- 首页 `dist/index.html` 指向最新日报。
- 每天的日报有独立页面，例如 `dist/2026-05-11.html`。
- 页面包含日期导航。
- 页面内容按 section 展示：
  - `Top Signals`
  - `Papers And Research`
  - `Company And Product Updates`
  - `Source Issues`

`dist/` 是构建产物，不提交到 Git。

## 8. GitHub Actions 部署流程

工作流文件：

```text
.github/workflows/daily.yml
```

当前工作流名称：

```text
Deploy AI Daily
```

触发方式：

- 推送到 `main` 分支。
- 手动触发 `workflow_dispatch`。

监听路径：

- `data/reports/**`
- `data/sources.json`
- `scripts/**`
- `package.json`
- `.github/workflows/daily.yml`

GitHub Actions 当前职责：

1. Checkout 仓库。
2. Setup Node。
3. 执行 `npm run build`。
4. 配置 GitHub Pages。
5. 上传 `dist/` artifact。
6. 部署到 GitHub Pages。

GitHub Actions 不再做：

- RSS 抓取。
- 日报生成。
- LLM 摘要。
- 自动提交日报。

这样可以避免 GitHub 端依赖 OpenAI API Key。

## 9. 本地定时任务设计

预期每天北京时间 05:00 运行本地 Codex 定时任务。

定时任务目标：

```text
AI Daily local Codex report
```

预期执行流程：

```text
git status
git pull --ff-only
npm run generate
Codex 本地编辑 data/reports/YYYY-MM-DD.json
npm run build
git add data/reports
git commit -m "chore: generate daily AI report"
git push origin main
检查 GitHub Actions 部署状态
```

注意事项：

- 如果本地有未提交的无关改动，应停止并报告。
- 如果 RSS 抓取失败导致没有有效内容，不应覆盖已有有价值日报。
- 如果当天日报没有变化，可以不提交。
- 推送后 GitHub Actions 会自动部署。

## 10. macOS 唤醒要求

Codex 本地定时任务依赖本机处于可运行状态。

如果 Mac 处于深睡或关机，普通应用任务无法保证唤醒电脑。

建议设置系统级定时唤醒：

```bash
sudo pmset repeat wakeorpoweron MTWRFSU 04:55:00
```

检查唤醒计划：

```bash
pmset -g sched
```

建议：

- 05:00 跑 Codex 任务。
- 04:55 唤醒电脑。
- Mac 尽量保持接电。
- 保持网络可用。
- 保持 Codex 登录状态正常。

## 11. 当前已完成状态

已经完成：

- 创建 GitHub 仓库 `Wan-Kai/ai-daily`。
- 启用 GitHub Pages。
- 初始化静态站点。
- 实现 RSS/Atom 抓取。
- 实现基础日报 JSON 生成。
- 实现静态页面构建。
- 修改 GitHub Actions 为纯部署流程。
- 添加本地 Codex 工作流文档。
- 创建过本地 Codex 定时任务。

当前线上地址：

```text
https://wan-kai.github.io/ai-daily/
```

当前本地路径：

```text
/Users/ktoon/Documents/MT/projects/ai-daily
```

## 12. 后续演进方向

短期可做：

- 优化 `data/reports` 的 JSON schema，使其更适合中文日报。
- 增加 `whyItMatters` 字段。
- 增加中文标题或中文摘要字段。
- 增加 source fetch 失败重试。
- 增加已分析链接缓存，避免重复处理。
- 调整页面展示为更适合中文阅读的日报样式。

中期可做：

- 支持按主题聚类，例如模型发布、智能体、推理、基础设施、论文、开源项目。
- 增加每日报告顶部的总览摘要。
- 增加本周趋势回顾。
- 增加重点论文深度解读。
- 增加「值得关注」和「噪音较大」判断。

长期可做：

- 增加后台编辑界面。
- 增加订阅推送，例如邮件、Slack、飞书。
- 增加多语言输出。
- 支持全文抓取和正文清洗。
- 支持自定义主题订阅。
- 接入数据库或搜索索引。

## 13. 新对话继续任务时的建议上下文

新开对话时，可以直接说明：

```text
请基于 /Users/ktoon/Documents/MT/projects/ai-daily/docs/architecture-design.md 继续开发 AI Daily。
当前架构是本地 Codex 负责日报生成和 LLM 编辑，GitHub Actions 只负责 GitHub Pages 部署。
```

如果要继续实现，优先任务建议是：

1. 设计更稳定的日报 JSON schema。
2. 改造 `generate-daily.mjs` 输出更适合 Codex 编辑的中间结构。
3. 改造 `build-site.mjs` 展示中文日报字段。
4. 完善本地 Codex 定时任务的失败保护和部署检查。
