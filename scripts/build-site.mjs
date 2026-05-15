import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as OpenCC from "opencc-js";

const root = process.cwd();
const reportsDir = path.join(root, "data", "reports");
const curationDir = path.join(root, "data", "curation");
const candidatesDir = path.join(root, "data", "curation-candidates");
const distDir = path.join(root, "dist");
const publicDir = path.join(root, "public");
const simplifyChinese = OpenCC.Converter({ from: "tw", to: "cn" });

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdown(value = "") {
  const parts = String(value).split(/(\*\*[^*\n][\s\S]*?[^*\n]\*\*)/g);
  return parts.map((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return `<strong>${escapeHtml(part.slice(2, -2))}</strong>`;
    }
    return escapeHtml(part);
  }).join("");
}

function renderSummaryBlocks(summary = "") {
  const blocks = [];
  let listItems = [];

  function flushList() {
    if (!listItems.length) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
    listItems = [];
  }

  for (const line of String(summary || "").split(/\n+/).map((item) => item.trim()).filter(Boolean)) {
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      listItems.push(bullet[1]);
      continue;
    }
    flushList();
    blocks.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }
  flushList();
  return blocks.join("");
}

function toSimplifiedChinese(value = "") {
  return simplifyChinese(String(value || ""))
    .replaceAll("什幺", "什么")
    .replaceAll("怎幺", "怎么")
    .replaceAll("这幺", "这么")
    .replaceAll("那幺", "那么")
    .replaceAll("多幺", "多么")
    .replaceAll("幺样", "么样");
}

function reportTitle(report) {
  return report.title?.replace("AI Daily", "AI 日报") || `AI 日报 - ${report.date}`;
}

function titleDate(report) {
  return report.date || report.title?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "";
}

function sectionCounts(report) {
  return (report.sections || [])
    .map((section) => `${section.title} ${section.items?.length || 0}`)
    .join(" / ");
}

function searchText(value) {
  return escapeHtml(String(value || "").replace(/\s+/g, " ").trim());
}

function renderItem(item, index) {
  const title = item.titleZh || item.title;
  const summary = item.summaryZh || item.summary;
  const sourceLinkLabel = item.sourceType === "podcast" ? "打开小宇宙" : "原文";
  const tags = (item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const summaryHtml = renderSummaryBlocks(summary);
  // 给视频保留直达链接，避免浏览器播放器控件不可用时无法打开媒体。
  const video = item.video ? `
    <figure class="news-figure">
      <video src="${escapeHtml(item.video)}" controls preload="metadata" playsinline${item.image ? ` poster="${escapeHtml(item.image)}"` : ""}></video>
      <figcaption><a href="${escapeHtml(item.video)}" target="_blank" rel="noreferrer">查看视频</a> · <a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">${sourceLinkLabel}</a></figcaption>
    </figure>
  ` : "";
  const image = item.image ? `
    <figure class="news-figure">
      <a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(title)}" loading="lazy">
      </a>
    </figure>
  ` : "";

  return `
    <article class="news-item">
      <div class="news-number">${String(index + 1).padStart(2, "0")}</div>
      <div class="news-body">
        <h3><a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a></h3>
        <p class="news-meta">${escapeHtml(item.source)} · <a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">${sourceLinkLabel}</a></p>
        ${video || image}
        <div class="news-summary">${summaryHtml}</div>
        ${tags ? `<div class="tags">${tags}</div>` : ""}
      </div>
    </article>
  `;
}

function renderSection(section) {
  const items = (section.items || []).map((item, index) => renderItem(item, index)).join("");
  return `
    <section class="report-section" id="${escapeHtml(section.id)}">
      <div class="section-heading">
        <p>${String(section.items?.length || 0).padStart(2, "0")}</p>
        <h2>${escapeHtml(section.title)}</h2>
      </div>
      ${items || "<p class=\"empty-state\">今天这个栏目暂无入选内容。</p>"}
    </section>
  `;
}

function renderDailySummary(report) {
  const bullets = (report.summaryBullets || [])
    .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
    .join("");
  if (!bullets) return "";

  return `
    <section class="daily-summary" aria-labelledby="daily-summary-title">
      <div class="section-heading summary-heading">
        <p>00</p>
        <h2 id="daily-summary-title">今日摘要</h2>
      </div>
      <ol>${bullets}</ol>
    </section>
  `;
}

function renderDateMenu(files, currentDate) {
  const years = new Map();
  for (const file of files) {
    const date = file.replace(".json", "");
    const [year, month, day] = date.split("-");
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push({ date, day });
  }

  return [...years.entries()].map(([year, months]) => `
    <section class="date-year">
      <h3>${escapeHtml(year)} 年</h3>
      ${[...months.entries()].map(([month, days]) => `
        <div class="date-month">
          <h4>${escapeHtml(month)} 月</h4>
          <div class="date-days">
            ${days.map(({ date, day }) => {
              const active = date === currentDate ? ` class="active"` : "";
              return `<a${active} href="./${escapeHtml(date)}.html" aria-label="${escapeHtml(date)}">${escapeHtml(day)}</a>`;
            }).join("")}
          </div>
        </div>
      `).join("")}
    </section>
  `).join("");
}

function renderDirectoryRows(reports) {
  return reports.map((report) => {
    const [year, month] = String(report.date || "").split("-");
    const summary = (report.summaryBullets || [])
      .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
      .join("");
    const searchable = [
      report.date,
      reportTitle(report),
      sectionCounts(report),
      ...(report.summaryBullets || [])
    ].join(" ");

    return `
      <article class="directory-item archive-entry" data-search="${searchText(searchable)}" data-year="${escapeHtml(year)}" data-month="${escapeHtml(month)}">
        <a href="./${escapeHtml(report.date)}.html">
          <time>${escapeHtml(report.date)}</time>
          <div class="directory-content">
            <strong>${escapeHtml(reportTitle(report))}</strong>
            ${summary ? `<ol class="directory-summary">${summary}</ol>` : ""}
            <span>${escapeHtml(sectionCounts(report))}</span>
            <em>查看日报</em>
          </div>
        </a>
      </article>
    `;
  }).join("");
}

function renderArchiveDateFilters(reports) {
  const years = [...new Set(reports.map((report) => String(report.date || "").split("-")[0]).filter(Boolean))].sort().reverse();
  const firstYear = years[0] || "";
  const months = [...new Set(reports
    .filter((report) => String(report.date || "").startsWith(`${firstYear}-`))
    .map((report) => String(report.date || "").split("-")[1])
    .filter(Boolean)
  )].sort().reverse();
  const firstMonth = months[0] || "";

  return `
    <div class="daily-date-filter" aria-label="日报年月切换">
      <div class="date-filter-group" id="daily-year-group">
        <span>年份</span>
        <div class="date-filter-options">
          ${years.map((year) => `<button type="button" class="date-filter-option${year === firstYear ? " active" : ""}" data-value="${escapeHtml(year)}">${escapeHtml(year)}</button>`).join("")}
        </div>
      </div>
      <div class="date-filter-group" id="daily-month-group">
        <span>月份</span>
        <div class="date-filter-options">
          ${months.map((month) => `<button type="button" class="date-filter-option${month === firstMonth ? " active" : ""}" data-value="${escapeHtml(month)}">${escapeHtml(month)}</button>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function curationDate(item) {
  return item.selectedAt || item.publishedAt || "待定";
}

function curationYear(item) {
  return String(item.publishedAt || item.selectedAt || "").match(/\d{4}/)?.[0] || "待定";
}

function renderCurationLinks(item, type) {
  const links = [];
  if (type === "podcasts" && item.transcriptPath) {
    links.push(`<a href="./${escapeHtml(item.transcriptPath)}">查看全文稿</a>`);
  }
  if (type === "podcasts" && item.audioUrl) {
    links.push(`<a href="${escapeHtml(item.audioUrl)}" target="_blank" rel="noreferrer">播放音频</a>`);
  }
  if (item.url) {
    links.push(`<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${type === "podcasts" ? "打开小宇宙" : "查看原文"}</a>`);
  }
  return links.length ? `<p class="curation-links">${links.join(" · ")}</p>` : "";
}

function renderCurationItems(items, type, options = {}) {
  if (!items.length) {
    const label = {
      papers: "精选论文",
      podcasts: "精选播客",
      blogs: "精选博客"
    }[type];

    return `
      <div class="curation-empty">
        <p>${escapeHtml(label)}暂未发布。后续会在定时任务或手动补充时，只把足够有价值的内容放进来。</p>
      </div>
    `;
  }

  return items.map((item) => {
    const title = item.titleZh || item.title;
    const titleHref = type === "podcasts" && item.transcriptPath ? `./${item.transcriptPath}` : (item.url || "#");
    const titleTarget = type === "podcasts" && item.transcriptPath ? "" : ` target="_blank" rel="noreferrer"`;
    const takeaways = (item.takeaways || [])
      .map((takeaway) => `<li>${renderInlineMarkdown(takeaway)}</li>`)
      .join("");
    const tags = (item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
    const tagText = (item.tags || []).join("、");
    const searchable = [
      title,
      item.title,
      item.source,
      item.author,
      item.publishedAt,
      item.selectedAt,
      item.duration,
      item.summaryZh,
      tagText
    ].join(" ");

    if (options.compactPapers) {
      const paperTags = (item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
      return `
      <article class="curation-item paper-index-item archive-entry" data-search="${searchText(searchable)}">
        <time>${escapeHtml(curationYear(item))}</time>
        <div class="curation-content">
          <details class="paper-details">
            <summary>
              <span class="paper-title">${escapeHtml(title)}</span>
              <span class="paper-index-meta">
                <span>${escapeHtml(curationYear(item))}</span>
                <span>${escapeHtml(item.source || "待补充来源")}</span>
              </span>
              ${paperTags ? `<span class="paper-index-tags">${paperTags}</span>` : ""}
            </summary>
            ${item.summaryZh ? `<div class="curation-summary">${String(item.summaryZh).split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean).map((paragraph) => `<p>${renderInlineMarkdown(paragraph)}</p>`).join("")}</div>` : ""}
            ${takeaways ? `<ol class="curation-takeaways">${takeaways}</ol>` : ""}
            ${renderCurationLinks(item, type)}
            ${tags ? `<div class="curation-tags">${tags}</div>` : ""}
          </details>
        </div>
      </article>
    `;
    }

    return `
      <article class="curation-item archive-entry" data-search="${searchText(searchable)}">
        <time>${escapeHtml(curationDate(item))}</time>
        <div class="curation-content">
          <h3><a href="${escapeHtml(titleHref)}"${titleTarget}>${escapeHtml(title)}</a></h3>
          <p class="curation-meta">${escapeHtml(item.source || "待补充来源")}${item.author ? ` · ${escapeHtml(item.author)}` : ""}${item.duration ? ` · ${escapeHtml(item.duration)}` : ""}</p>
          ${item.summaryZh ? `<div class="curation-summary">${String(item.summaryZh).split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean).map((paragraph) => `<p>${renderInlineMarkdown(paragraph)}</p>`).join("")}</div>` : ""}
          ${takeaways ? `<ol class="curation-takeaways">${takeaways}</ol>` : ""}
          ${renderCurationLinks(item, type)}
          ${tags ? `<div class="curation-tags">${tags}</div>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

function renderPodcastItems(items) {
  const chinese = items.filter((item) => item.language !== "en");
  const english = items.filter((item) => item.language === "en");

  return `
    <div class="podcast-group">
      <h3>中文播客</h3>
      ${chinese.length ? renderCurationItems(chinese, "podcasts") : "<p class=\"curation-empty-inline\">中文播客暂未发布。</p>"}
    </div>
    <div class="podcast-group">
      <h3>英文播客</h3>
      ${english.length ? renderCurationItems(english, "podcasts") : "<p class=\"curation-empty-inline\">英文播客暂未发布。</p>"}
    </div>
  `;
}

function candidateLabel(category) {
  return {
    papers: "精选论文",
    blogs: "精选博客",
    podcasts: "精选播客"
  }[category] || category;
}

function flattenCandidates(candidateStores) {
  return candidateStores.flatMap((store) => ["papers", "blogs", "podcasts"].flatMap((category) => {
    return (store[category] || []).map((item) => ({
      ...item,
      category,
      candidateDate: store.date || item.selectedAt || ""
    }));
  }));
}

function renderReviewItem(item, index) {
  const title = item.titleZh || item.title;
  const summary = item.summaryZh ? String(item.summaryZh).split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean).map((paragraph) => `<p>${renderInlineMarkdown(paragraph)}</p>`).join("") : "";
  const audit = [item.selectionReason, item.auditNote].filter(Boolean).map((paragraph) => `<p>${renderInlineMarkdown(paragraph)}</p>`).join("");
  const tags = (item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");

  return `
    <article class="review-item" data-category="${escapeHtml(item.category)}" data-id="${escapeHtml(item.id)}">
      <div class="review-rank">${String(index + 1).padStart(2, "0")}</div>
      <div class="review-body">
        <div class="review-head">
          <time>${escapeHtml(item.candidateDate || item.selectedAt || "待定")}</time>
          <span>${escapeHtml(candidateLabel(item.category))}</span>
          <span>${escapeHtml(item.source || "未知来源")}</span>
          <span>分数 ${escapeHtml(item.score || 0)}</span>
        </div>
        <h2><a href="${escapeHtml(item.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a></h2>
        ${audit ? `<div class="review-audit">${audit}</div>` : ""}
        ${summary ? `<div class="curation-summary">${summary}</div>` : ""}
        ${renderCurationLinks(item, item.category)}
        ${tags ? `<div class="curation-tags">${tags}</div>` : ""}
        <div class="review-controls">
          <label>
            审批
            <select data-field="action">
              <option value="pending">暂不处理</option>
              <option value="approve">通过</option>
              <option value="reject">拒绝</option>
            </select>
          </label>
          <label>
            备注
            <input data-field="note" type="text" placeholder="可选：修改建议、拒绝原因或发布备注">
          </label>
        </div>
      </div>
    </article>
  `;
}

function renderReviewPage(candidateStores) {
  const candidates = flattenCandidates(candidateStores);
  const items = candidates.map(renderReviewItem).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>精选内容审核</title>
  <link rel="icon" href="./favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="./styles.css">
</head>
<body class="review-page">
  <header class="masthead">
    <div class="paper">
      <p class="eyebrow">Private Review</p>
      <h1 class="review-title">精选内容审核</h1>
      <p class="subtitle">这个页面不会放在公开导航里。选择通过、拒绝或暂不处理后，可以打开预填好的 GitHub Issue，下一次发布流程会读取 Issue 并同步结果。</p>
    </div>
  </header>
  <main class="paper review-main">
    <div class="review-actions" aria-label="审批操作">
      <button type="button" id="copy-review">复制审批信息</button>
      <button type="button" id="open-issue">提交到 GitHub Issue</button>
      <span id="review-status" aria-live="polite"></span>
    </div>
    ${items || "<p class=\"curation-empty-inline\">当前没有待审核精选内容。</p>"}
  </main>
  <script>
    const issueRepo = "Wan-Kai/ai-daily";

    function collectDecisions() {
      const decisions = [...document.querySelectorAll(".review-item")].map((item) => {
        return {
          id: item.dataset.id,
          category: item.dataset.category,
          action: item.querySelector('[data-field="action"]').value,
          note: item.querySelector('[data-field="note"]').value.trim()
        };
      }).filter((item) => item.action !== "pending" || item.note);

      return {
        type: "curation-approval",
        generatedAt: new Date().toISOString(),
        decisions
      };
    }

    function issueBody() {
      const payload = collectDecisions();
      return [
        "请同步以下精选内容审批结果。",
        "",
        "说明：approve 表示发布，reject 表示拒绝并从待审库移除，pending 表示继续保留待审。",
        "",
        "\`\`\`json",
        JSON.stringify(payload, null, 2),
        "\`\`\`"
      ].join("\\n");
    }

    async function copyReview() {
      const body = issueBody();
      await navigator.clipboard.writeText(body);
      document.querySelector("#review-status").textContent = "审批信息已复制。";
    }

    function openIssue() {
      const payload = collectDecisions();
      const title = "精选内容审批 " + new Date().toISOString().slice(0, 10);
      const url = new URL("https://github.com/" + issueRepo + "/issues/new");
      url.searchParams.set("title", title);
      url.searchParams.set("labels", "curation-review");
      url.searchParams.set("body", issueBody());
      window.open(url.toString(), "_blank", "noopener,noreferrer");
      document.querySelector("#review-status").textContent = "已打开 GitHub Issue，请在 GitHub 页面提交。";
    }

    document.querySelector("#copy-review").addEventListener("click", copyReview);
    document.querySelector("#open-issue").addEventListener("click", openIssue);
  </script>
</body>
</html>`;
}

function renderTranscriptPage(item) {
  const title = item.titleZh || item.title || "播客全文稿";
  const turns = renderTranscriptTurns(item);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - 全文稿</title>
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <header class="masthead">
    <div class="paper">
      <p class="eyebrow">Podcast Transcript</p>
      <h1 class="transcript-title">${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(item.source || "精选播客")} · ${escapeHtml(item.publishedAt || item.selectedAt || "")}</p>
      <p class="curation-links">
        <a href="../index.html#podcasts">返回精选播客</a>
        ${item.url ? ` · <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">打开小宇宙</a>` : ""}
        ${item.audioUrl ? ` · <a href="${escapeHtml(item.audioUrl)}" target="_blank" rel="noreferrer">播放音频</a>` : ""}
      </p>
    </div>
  </header>
  <main class="paper transcript-body">
    ${turns || "<p>暂无全文稿。</p>"}
  </main>
</body>
</html>`;
}

function transcriptLabels(item) {
  const title = `${item.titleZh || item.title || ""} ${item.source || ""}`;
  if (/姚顺宇|张小珺|商业访谈录/.test(title)) return { host: "张小珺", guest: "姚顺宇" };
  if (/Vibe Coding|AI炼金术|徐文浩/.test(title)) return { host: "任鑫", guest: "徐文浩" };
  return { host: "主持人", guest: "嘉宾" };
}

function inferTranscriptSpeaker(line, previous) {
  const text = line.trim();
  if (!text) return previous || "guest";
  if (/^(Hello|欢迎大家|这里是|好了|今天的节目)/i.test(text)) return "host";
  if (/[?？]$/.test(text)) return "host";
  if (/^(你|那你|所以|为什么|什么|怎么|是不是|好|最近|一个|一個|基于|第一次|我们每个|我说你|你觉得|你看|那对于|这对于|如果是你|有没有|从什么|你的|你未来|你现在|你有|你最近|你心目中)/.test(text)) return "host";
  if (/^(我觉得|对|可以|就是|因为|其实|可能|没有|真的|应该|反正|首先|这个|那时候|如果|但是)/.test(text)) return "guest";
  return previous || "guest";
}

function renderTranscriptTurns(item) {
  const labels = transcriptLabels(item);
  const lines = toSimplifiedChinese(item.transcriptText || "")
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const turns = [];

  for (const line of lines) {
    const speaker = inferTranscriptSpeaker(line, turns.at(-1)?.speaker);
    const current = turns.at(-1);
    const shouldAppend = current && current.speaker === speaker && current.lines.length < 4 && current.lines.join("").length < 260;
    if (shouldAppend) current.lines.push(line);
    else turns.push({ speaker, lines: [line] });
  }

  return turns.map((turn) => {
    const label = turn.speaker === "host" ? labels.host : labels.guest;
    return `
      <article class="transcript-turn ${turn.speaker === "host" ? "host" : "guest"}">
        <div class="transcript-speaker">${escapeHtml(label)}</div>
        <div class="transcript-lines">
          ${turn.lines.map((line) => `<p>${renderInlineMarkdown(line)}</p>`).join("")}
        </div>
      </article>
    `;
  }).join("");
}

async function writeTranscriptPages(podcasts) {
  await mkdir(path.join(distDir, "transcripts"), { recursive: true });
  for (const item of podcasts) {
    if (!item.transcriptPath || !item.transcriptText) continue;
    const transcriptFile = path.join(distDir, item.transcriptPath);
    await mkdir(path.dirname(transcriptFile), { recursive: true });
    await writeFile(transcriptFile, renderTranscriptPage(item));
  }
}

function renderIndexPage(reports, curation) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Daily 日报目录</title>
  <link rel="icon" href="./favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <header class="masthead">
    <div class="paper">
      <p class="eyebrow">Daily Archive</p>
      <h1>AI Daily</h1>
      <p class="subtitle">AI 正在持续改写知识与工具的边界，这里记录每天值得重新学习的线索。</p>
    </div>
  </header>
  <main class="paper">
    <nav class="archive-tabs" aria-label="内容分类">
      <button class="active" type="button" data-tab="daily">每日简报</button>
      <button type="button" data-tab="papers">精选论文</button>
      <button type="button" data-tab="podcasts">精选播客</button>
      <button type="button" data-tab="blogs">精选博客</button>
    </nav>
    <aside class="archive-tools" aria-label="筛选工具">
      <div class="archive-search-wrap">
        <label for="archive-search">站内搜索</label>
        <div class="archive-search-box">
          <span aria-hidden="true"></span>
          <input id="archive-search" type="search" placeholder="搜索标题、来源、摘要" autocomplete="off">
        </div>
      </div>
      ${renderArchiveDateFilters(reports)}
      <div class="archive-status" id="archive-status">显示全部条目</div>
    </aside>
    <section class="directory tab-panel active" id="tab-daily" data-page-size="6">
      <h2>每日简报</h2>
      <div class="directory-list">${renderDirectoryRows(reports)}</div>
      <nav class="archive-pagination" aria-label="每日简报分页"></nav>
    </section>
    <section class="directory tab-panel" id="tab-papers" data-page-size="8">
      <h2>精选论文</h2>
      <div class="curation-list">${renderCurationItems(curation.papers, "papers", { compactPapers: true })}</div>
      <nav class="archive-pagination" aria-label="精选论文分页"></nav>
    </section>
    <section class="directory tab-panel" id="tab-podcasts" data-page-size="5">
      <h2>精选播客</h2>
      <div class="curation-list">${renderPodcastItems(curation.podcasts)}</div>
      <nav class="archive-pagination" aria-label="精选播客分页"></nav>
    </section>
    <section class="directory tab-panel" id="tab-blogs" data-page-size="5">
      <h2>精选博客</h2>
      <div class="curation-list">${renderCurationItems(curation.blogs, "blogs")}</div>
      <nav class="archive-pagination" aria-label="精选博客分页"></nav>
    </section>
  </main>
  <script>
    const tabs = [...document.querySelectorAll(".archive-tabs button")];
    const panels = [...document.querySelectorAll(".tab-panel")];
    const searchInput = document.getElementById("archive-search");
    const archiveStatus = document.getElementById("archive-status");
    const archiveTools = document.querySelector(".archive-tools");
    const dailyYearGroup = document.getElementById("daily-year-group");
    const dailyMonthGroup = document.getElementById("daily-month-group");
    const dailyEntries = [...document.querySelectorAll("#tab-daily .archive-entry")];
    const dailyMonthsByYear = [...new Set(dailyEntries.map((entry) => entry.dataset.year).filter(Boolean))]
      .reduce((map, year) => {
        map[year] = [...new Set(dailyEntries.filter((entry) => entry.dataset.year === year).map((entry) => entry.dataset.month).filter(Boolean))].sort().reverse();
        return map;
      }, {});
    const pageState = Object.fromEntries(panels.map((panel) => [panel.id, 1]));

    function activateTab(name) {
      tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
      panels.forEach((panel) => panel.classList.toggle("active", panel.id === "tab-" + name));
      archiveTools.classList.toggle("daily-mode", name === "daily");
      if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
      renderArchivePanel();
    }

    function activePanel() {
      return panels.find((panel) => panel.classList.contains("active")) || panels[0];
    }

    function normalizeText(value) {
      return String(value || "").toLowerCase().replace(/\\s+/g, " ").trim();
    }

    function selectedDateValue(group) {
      return group?.querySelector(".date-filter-option.active")?.dataset.value || "";
    }

    function setActiveDateValue(group, value) {
      group?.querySelectorAll(".date-filter-option").forEach((button) => {
        button.classList.toggle("active", button.dataset.value === value);
      });
    }

    function bindMonthButtons() {
      dailyMonthGroup.querySelectorAll(".date-filter-option").forEach((button) => {
        button.addEventListener("click", () => {
          setActiveDateValue(dailyMonthGroup, button.dataset.value);
          pageState["tab-daily"] = 1;
          renderArchivePanel();
        });
      });
    }

    function updateDailyMonths() {
      const year = selectedDateValue(dailyYearGroup);
      const months = dailyMonthsByYear[year] || [];
      const current = months.includes(selectedDateValue(dailyMonthGroup)) ? selectedDateValue(dailyMonthGroup) : months[0] || "";
      const options = dailyMonthGroup.querySelector(".date-filter-options");
      options.innerHTML = months.map((month) => "<button type=\\"button\\" class=\\"date-filter-option" + (month === current ? " active" : "") + "\\" data-value=\\"" + month + "\\">" + month + "</button>").join("");
      bindMonthButtons();
    }

    function pageButton(label, page, active) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = active ? "active" : "";
      button.addEventListener("click", () => {
        pageState[activePanel().id] = page;
        renderArchivePanel();
      });
      return button;
    }

    function renderArchivePanel() {
      const panel = activePanel();
      const isDaily = panel.id === "tab-daily";
      const query = isDaily ? "" : normalizeText(searchInput.value);
      const entries = [...panel.querySelectorAll(".archive-entry")];
      const selectedYear = selectedDateValue(dailyYearGroup);
      const selectedMonth = selectedDateValue(dailyMonthGroup);
      const matched = entries.filter((entry) => {
        if (isDaily) return entry.dataset.year === selectedYear && entry.dataset.month === selectedMonth;
        return normalizeText(entry.dataset.search).includes(query);
      });
      const pageSize = Number(panel.dataset.pageSize || 8);
      const pageCount = Math.max(1, Math.ceil(matched.length / pageSize));
      const currentPage = Math.min(pageState[panel.id] || 1, pageCount);
      pageState[panel.id] = currentPage;
      const start = (currentPage - 1) * pageSize;
      const visible = new Set(matched.slice(start, start + pageSize));

      entries.forEach((entry) => {
        entry.hidden = !visible.has(entry);
      });
      panel.querySelectorAll(".podcast-group").forEach((group) => {
        group.hidden = ![...group.querySelectorAll(".archive-entry")].some((entry) => !entry.hidden);
      });

      const pagination = panel.querySelector(".archive-pagination");
      if (pagination) {
        pagination.innerHTML = "";
        if (pageCount > 1) {
          pagination.append(pageButton("上一页", Math.max(1, currentPage - 1), false));
          for (let page = 1; page <= pageCount; page += 1) {
            pagination.append(pageButton(String(page), page, page === currentPage));
          }
          pagination.append(pageButton("下一页", Math.min(pageCount, currentPage + 1), false));
        }
      }

      if (isDaily) {
        archiveStatus.textContent = selectedYear + " 年 " + selectedMonth + " 月，共 " + matched.length + " 期";
      } else {
        archiveStatus.textContent = query
          ? "找到 " + matched.length + " 条，当前第 " + currentPage + " / " + pageCount + " 页"
          : "共 " + matched.length + " 条，当前第 " + currentPage + " / " + pageCount + " 页";
      }
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    });

    searchInput.addEventListener("input", () => {
      pageState[activePanel().id] = 1;
      renderArchivePanel();
    });
    dailyYearGroup.querySelectorAll(".date-filter-option").forEach((button) => {
      button.addEventListener("click", () => {
        setActiveDateValue(dailyYearGroup, button.dataset.value);
        updateDailyMonths();
        pageState["tab-daily"] = 1;
        renderArchivePanel();
      });
    });

    const initialTab = location.hash.replace("#", "");
    updateDailyMonths();
    if (tabs.some((tab) => tab.dataset.tab === initialTab)) activateTab(initialTab);
    else activateTab("daily");
  </script>
</body>
</html>`;
}

function renderPage(report, reports) {
  const dateMenu = renderDateMenu(reports, report.date);
  const sectionLinks = (report.sections || [])
    .map((section) => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a>`)
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(reportTitle(report))}</title>
  <link rel="icon" href="./favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <header class="masthead">
    <nav class="topline">
      <a href="./index.html">AI Daily</a>
      <details class="date-menu">
        <summary>
          <span>选择日期</span>
          <strong>${escapeHtml(report.date)}</strong>
        </summary>
        <div class="date-menu-list">${dateMenu}</div>
      </details>
    </nav>
    <div class="paper">
      <p class="eyebrow">Daily Brief</p>
      <h1 class="report-title">AI 日报</h1>
      <p class="issue-date">${escapeHtml(titleDate(report))}</p>
      <p class="subtitle">像读一份报纸一样，从上往下浏览今日值得关注的 AI 动向。</p>
      <div class="section-nav">${sectionLinks}</div>
    </div>
  </header>
  <main class="paper report">
    ${renderDailySummary(report)}
    ${(report.sections || []).map(renderSection).join("")}
  </main>
  <footer class="paper footer">
    <span>Generated at ${escapeHtml(report.generatedAt)}</span>
  </footer>
  <script>
    document.addEventListener("click", (event) => {
      document.querySelectorAll(".date-menu[open]").forEach((menu) => {
        if (!menu.contains(event.target)) menu.removeAttribute("open");
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      document.querySelectorAll(".date-menu[open]").forEach((menu) => {
        menu.removeAttribute("open");
      });
    });

    document.querySelectorAll(".date-menu-list a").forEach((link) => {
      link.addEventListener("click", () => {
        link.closest(".date-menu")?.removeAttribute("open");
      });
    });
  </script>
</body>
</html>`;
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function readCandidateStores() {
  try {
    const files = (await readdir(candidatesDir)).filter((name) => name.endsWith(".json")).sort().reverse();
    const stores = [];
    for (const file of files) {
      stores.push(await readJsonFile(path.join(candidatesDir, file), {
        date: file.replace(".json", ""),
        papers: [],
        blogs: [],
        podcasts: []
      }));
    }
    return stores;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const css = `
:root {
  color-scheme: light;
  --paper: #fbfaf5;
  --ink: #171717;
  --muted: #6d665c;
  --line: #d8d0c0;
  --soft-line: #ebe4d6;
  --accent: #7c1f16;
}

* {
  box-sizing: border-box;
}

[hidden] {
  display: none !important;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background:
    linear-gradient(rgba(23, 23, 23, .025) 1px, transparent 1px),
    var(--paper);
  background-size: 100% 28px;
  color: var(--ink);
  font-family: "Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", Georgia, serif;
  line-height: 1.85;
}

a {
  color: inherit;
  text-decoration-color: rgba(124, 31, 22, .38);
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

a:hover {
  color: var(--accent);
}

.paper {
  width: min(860px, calc(100vw - 40px));
  margin: 0 auto;
}

.masthead {
  padding: 28px 0 18px;
  border-bottom: 1px solid var(--line);
}

.topline {
  width: min(1080px, calc(100vw - 40px));
  margin: 0 auto 34px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 18px;
  color: var(--muted);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  letter-spacing: .03em;
}

.topline > a {
  color: var(--ink);
  font-weight: 700;
  text-decoration: none;
}

.eyebrow {
  margin: 0 0 10px;
  color: var(--accent);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .18em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(48px, 10vw, 104px);
  font-weight: 900;
  line-height: .95;
  letter-spacing: 0;
}

.report-title {
  font-size: clamp(38px, 6.5vw, 72px);
}

.issue-date {
  margin: 12px 0 0;
  color: var(--muted);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: .08em;
}

.date-menu {
  position: relative;
  z-index: 2;
}

.date-menu summary {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-width: 178px;
  padding: 7px 12px;
  border: 1px solid var(--line);
  background: rgba(251, 250, 245, .94);
  color: var(--muted);
  cursor: pointer;
  list-style: none;
}

.date-menu summary::-webkit-details-marker {
  display: none;
}

.date-menu summary::after {
  content: "";
  width: 7px;
  height: 7px;
  margin-left: auto;
  border-right: 1px solid var(--accent);
  border-bottom: 1px solid var(--accent);
  transform: rotate(45deg) translateY(-2px);
  transition: transform .16s ease;
}

.date-menu[open] summary::after {
  transform: rotate(225deg) translate(-1px, -1px);
}

.date-menu summary strong {
  color: var(--ink);
  font-weight: 800;
  letter-spacing: 0;
}

.date-menu-list {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  width: min(360px, calc(100vw - 40px));
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--line);
  background: var(--paper);
  box-shadow: 0 18px 36px rgba(23, 23, 23, .12);
  padding: 14px;
}

.date-year + .date-year {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--soft-line);
}

.date-year h3,
.date-month h4 {
  margin: 0;
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  line-height: 1;
}

.date-year h3 {
  color: var(--ink);
  font-size: 13px;
  font-weight: 900;
}

.date-month {
  display: grid;
  grid-template-columns: 54px 1fr;
  gap: 10px;
  align-items: start;
  margin-top: 13px;
}

.date-month h4 {
  padding-top: 7px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.date-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(30px, 1fr));
  gap: 6px;
}

.date-days a {
  display: grid;
  place-items: center;
  min-height: 30px;
  border: 1px solid var(--soft-line);
  color: var(--ink);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
}

.date-days a:hover,
.date-days a.active {
  background: #f1eadb;
  border-color: var(--accent);
  color: var(--accent);
}

.subtitle {
  max-width: 640px;
  margin: 22px 0 0;
  color: var(--muted);
  font-size: 18px;
}

.section-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  margin-top: 28px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  font-weight: 700;
}

.section-nav a {
  text-decoration: none;
  color: var(--accent);
}

.report {
  padding: 10px 0 58px;
}

.report-section {
  padding-top: 54px;
}

.daily-summary {
  padding-top: 42px;
}

.section-heading {
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: 18px;
  align-items: end;
  margin-bottom: 26px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--ink);
}

.summary-heading {
  margin-bottom: 18px;
}

.daily-summary ol {
  margin: 0;
  padding: 0 0 18px 58px;
  border-bottom: 1px solid var(--soft-line);
  color: #24211d;
  font-size: 19px;
  line-height: 1.9;
}

.daily-summary li {
  padding: 6px 0;
}

.section-heading p {
  margin: 0 0 4px;
  color: var(--accent);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  font-weight: 800;
}

.section-heading h2 {
  margin: 0;
  font-size: clamp(28px, 5vw, 48px);
  line-height: 1.05;
}

.news-item {
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: 18px;
  padding: 28px 0;
  border-bottom: 1px solid var(--soft-line);
}

.news-number {
  color: var(--accent);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .08em;
}

.news-body h3 {
  margin: 0;
  font-size: clamp(22px, 3vw, 32px);
  line-height: 1.24;
  letter-spacing: 0;
}

.news-body h3 a {
  text-decoration: none;
}

.news-meta {
  margin: 10px 0 0;
  color: var(--muted);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  line-height: 1.5;
}

.news-figure {
  margin: 18px 0 18px;
}

.news-figure img {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--line);
  filter: saturate(.92) contrast(1.02);
}

.news-figure video {
  display: block;
  width: 100%;
  max-height: 440px;
  border: 1px solid var(--line);
  background: #111;
}

.news-figure figcaption {
  margin-top: 8px;
  color: var(--muted);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 12px;
  line-height: 1.5;
}

.news-figure figcaption a {
  color: var(--accent);
  font-weight: 800;
  text-decoration: none;
}

.news-summary {
  margin: 16px 0 0;
  color: #24211d;
  font-size: 18px;
  line-height: 1.9;
}

.news-summary p {
  margin: 0;
}

.news-summary p + p {
  margin-top: 12px;
}

.daily-summary strong,
.news-summary strong {
  font-weight: 800;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
}

.tags span {
  color: var(--muted);
  font-size: 12px;
}

.tags span::before {
  content: "#";
  color: var(--accent);
}

.empty-state {
  color: var(--muted);
}

.directory {
  padding: 26px 0 70px;
}

.archive-tabs {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 34px 0 0;
  padding: 10px 0 18px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(251, 250, 245, .98), rgba(251, 250, 245, .92));
  backdrop-filter: blur(8px);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
}

.archive-tabs button {
  appearance: none;
  border: 1px solid var(--line);
  background: rgba(251, 250, 245, .72);
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  padding: 8px 13px;
}

.archive-tabs button:hover,
.archive-tabs button.active {
  border-color: var(--accent);
  background: #f1eadb;
  color: var(--accent);
}

.tab-panel {
  display: none;
}

.tab-panel.active {
  display: block;
}

.archive-tools {
  position: sticky;
  top: 57px;
  z-index: 19;
  display: grid;
  grid-template-columns: minmax(280px, 1fr) auto auto;
  align-items: center;
  gap: 16px;
  margin: 0 0 18px;
  padding: 16px 0 18px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(251, 250, 245, .96), rgba(251, 250, 245, .9));
  backdrop-filter: blur(8px);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
}

.archive-search-wrap {
  display: grid;
  gap: 7px;
}

.archive-search-wrap > label,
.date-filter-group > span {
  color: var(--accent);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .12em;
}

.archive-search-box {
  display: grid;
  grid-template-columns: 36px 1fr;
  align-items: center;
  min-height: 46px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, .58);
  box-shadow: inset 0 -2px 0 rgba(124, 31, 22, .12);
  transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
}

.archive-search-box:focus-within {
  border-color: var(--accent);
  background: rgba(255, 255, 255, .78);
  box-shadow: inset 0 -2px 0 var(--accent);
}

.archive-search-box > span {
  position: relative;
  width: 36px;
  height: 36px;
}

.archive-search-box > span::before,
.archive-search-box > span::after {
  content: "";
  position: absolute;
  display: block;
}

.archive-search-box > span::before {
  width: 10px;
  height: 10px;
  left: 12px;
  top: 11px;
  border: 2px solid var(--accent);
  border-radius: 50%;
}

.archive-search-box > span::after {
  width: 9px;
  height: 2px;
  left: 22px;
  top: 24px;
  background: var(--accent);
  transform: rotate(45deg);
  transform-origin: left center;
}

.archive-search-box input {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  padding: 11px 12px 11px 0;
  outline: none;
}

.archive-search-box input::placeholder {
  color: rgba(109, 102, 92, .72);
  font-weight: 700;
}

.daily-date-filter {
  display: none;
  grid-template-columns: repeat(2, auto);
  align-items: end;
  justify-content: start;
  gap: 18px;
}

.archive-tools.daily-mode {
  grid-template-columns: 1fr auto;
}

.archive-tools.daily-mode .archive-search-wrap {
  display: none;
}

.archive-tools.daily-mode .daily-date-filter {
  display: grid;
}

.date-filter-group {
  display: grid;
  gap: 8px;
}

.date-filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.date-filter-option {
  appearance: none;
  border: 1px solid var(--line);
  border-radius: 0;
  background: rgba(255, 255, 255, .46);
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
  min-width: 50px;
  padding: 11px 13px;
  transition: border-color .16s ease, background .16s ease, color .16s ease, box-shadow .16s ease;
}

.date-filter-option:hover,
.date-filter-option.active {
  border-color: var(--accent);
  background: #f1eadb;
  color: var(--accent);
}

.date-filter-option:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(124, 31, 22, .18);
}

.archive-status {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  justify-self: end;
  white-space: nowrap;
}

.directory h2 {
  margin: 0 0 26px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--ink);
  font-size: clamp(30px, 6vw, 56px);
}

.directory-list {
  display: grid;
  gap: 0;
}

.directory-item a {
  display: grid;
  grid-template-columns: 132px 1fr;
  gap: 18px;
  padding: 22px 0;
  border-bottom: 1px solid var(--soft-line);
  text-decoration: none;
}

.directory-content {
  min-width: 0;
}

.directory-item time {
  color: var(--accent);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  font-weight: 800;
}

.directory-content > strong {
  display: block;
  font-size: 26px;
  line-height: 1.2;
}

.directory-summary {
  margin: 14px 0 12px;
  padding-left: 20px;
  color: #24211d;
  font-size: 16px;
  line-height: 1.75;
}

.directory-summary li + li {
  margin-top: 4px;
}

.directory-summary strong {
  display: inline;
  font-size: inherit;
  line-height: inherit;
  font-weight: 800;
}

.directory-item span {
  color: var(--muted);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  display: block;
}

.directory-item em {
  color: var(--accent);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  font-style: normal;
  font-weight: 800;
  display: inline-block;
  margin-top: 8px;
}

.curation-list {
  display: grid;
  gap: 0;
}

.curation-item {
  display: grid;
  grid-template-columns: 132px 1fr;
  gap: 18px;
  padding: 24px 0;
  border-bottom: 1px solid var(--soft-line);
}

.curation-item time {
  color: var(--accent);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  font-weight: 800;
}

.curation-content h3 {
  margin: 0;
  font-size: 26px;
  line-height: 1.24;
}

.curation-content h3 a {
  text-decoration: none;
}

.paper-details {
  border: 0;
}

.paper-details summary {
  cursor: pointer;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  column-gap: 16px;
  align-items: start;
  list-style: none;
}

.paper-details summary::-webkit-details-marker {
  display: none;
}

.paper-details summary::before {
  content: "";
  width: 0;
  height: 0;
  margin-top: 9px;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 9px solid var(--accent);
  transition: transform .16s ease;
}

.paper-details[open] summary::before {
  transform: rotate(90deg);
}

.paper-title {
  display: block;
  min-width: 0;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.25;
}

.paper-index-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  grid-column: 2;
  margin: 10px 0 0;
  color: var(--muted);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.5;
}

.paper-index-meta span {
  padding-left: 9px;
  border-left: 2px solid rgba(124, 31, 22, .42);
}

.paper-index-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  grid-column: 2;
  margin: 12px 0 0;
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
}

.paper-index-tags span {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 1px solid var(--soft-line);
  background: rgba(255, 255, 255, .38);
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.4;
  padding: 4px 8px;
}

.paper-index-tags span::before {
  content: "#";
  color: var(--accent);
}

.curation-meta {
  margin: 8px 0 0;
  color: var(--muted);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  line-height: 1.5;
}

.curation-links {
  margin: 12px 0 0;
  color: var(--accent);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  font-weight: 800;
}

.curation-summary,
.curation-takeaways {
  color: #24211d;
  font-size: 16px;
  line-height: 1.75;
}

.curation-summary {
  margin-top: 12px;
}

.curation-summary p {
  margin: 0;
}

.curation-summary p + p {
  margin-top: 8px;
}

.curation-takeaways {
  margin: 12px 0 0;
  padding-left: 20px;
}

.curation-summary strong,
.curation-takeaways strong {
  font-weight: 800;
}

.curation-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
}

.curation-tags span {
  color: var(--muted);
  font-size: 12px;
}

.curation-tags span::before {
  content: "#";
  color: var(--accent);
}

.archive-pagination {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 28px;
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
}

.archive-pagination:empty {
  display: none;
}

.archive-pagination button {
  border: 1px solid var(--line);
  background: rgba(251, 250, 245, .78);
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  min-width: 34px;
  padding: 8px 10px;
}

.archive-pagination button:hover,
.archive-pagination button.active {
  border-color: var(--accent);
  background: #f1eadb;
  color: var(--accent);
}

.curation-empty {
  padding: 28px 0;
  border-bottom: 1px solid var(--soft-line);
  color: var(--muted);
  font-size: 18px;
}

.curation-empty p {
  margin: 0;
}

.podcast-group + .podcast-group {
  margin-top: 38px;
}

.podcast-group > h3 {
  margin: 0;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
  color: var(--accent);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: .12em;
}

.curation-empty-inline {
  margin: 14px 0 0;
  color: var(--muted);
  font-size: 16px;
}

.review-title {
  font-size: clamp(38px, 7vw, 78px);
}

.review-main {
  padding: 32px 0 80px;
}

.review-actions {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 28px;
  padding: 12px 0;
  background: rgba(251, 250, 245, .94);
  border-bottom: 1px solid var(--soft-line);
}

.review-actions button {
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #fff;
  padding: 8px 12px;
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.review-actions button:first-child {
  background: transparent;
  color: var(--accent);
}

#review-status {
  color: var(--muted);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
}

.review-item {
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: 22px;
  padding: 28px 0;
  border-top: 1px solid var(--line);
}

.review-rank {
  color: var(--accent);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 16px;
  font-weight: 900;
}

.review-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: var(--muted);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 12px;
  font-weight: 800;
}

.review-body h2 {
  margin: 8px 0 10px;
  font-size: clamp(24px, 4vw, 38px);
  line-height: 1.2;
}

.review-audit {
  margin: 0 0 14px;
  padding: 12px 14px;
  border-left: 3px solid var(--accent);
  background: rgba(124, 31, 22, .05);
  color: var(--muted);
  font-size: 16px;
}

.review-audit p {
  margin: 0;
}

.review-audit p + p {
  margin-top: 8px;
}

.transcript-title {
  font-size: clamp(30px, 6vw, 60px);
  line-height: 1.12;
}

.transcript-body {
  padding: 36px 0 84px;
  max-width: 900px;
  font-size: 18px;
  line-height: 1.9;
}

.transcript-note {
  max-width: 760px;
  margin: 18px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.transcript-turn {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 22px;
  padding: 20px 0;
  border-top: 1px solid var(--soft-line);
}

.transcript-turn:first-child {
  border-top-color: var(--line);
}

.transcript-speaker {
  position: sticky;
  top: 18px;
  align-self: start;
  color: var(--accent);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.3;
}

.transcript-turn.guest .transcript-speaker {
  color: #5c554c;
}

.transcript-lines p {
  margin: 0 0 10px;
}

.transcript-lines p:last-child {
  margin-bottom: 0;
}

.review-controls {
  display: grid;
  grid-template-columns: minmax(140px, 180px) 1fr;
  gap: 12px;
  margin-top: 18px;
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
}

.review-controls label {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.review-controls select,
.review-controls input {
  width: 100%;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, .42);
  color: var(--ink);
  padding: 9px 10px;
  font: inherit;
  font-size: 14px;
}

.footer {
  padding: 0 0 38px;
  color: var(--muted);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 12px;
}

@media (max-width: 680px) {
  .paper,
  .topline {
    width: min(100vw - 28px, 860px);
  }

  .topline {
    align-items: flex-start;
    flex-direction: column;
    margin-bottom: 26px;
  }

  .topline div {
    max-width: 100%;
  }

  .section-heading,
  .news-item,
  .directory-item a,
  .curation-item,
  .review-item,
  .review-controls {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .archive-tabs {
    margin-top: 26px;
  }

  .archive-tools {
    top: 58px;
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .archive-tools.daily-mode {
    grid-template-columns: 1fr;
  }

  .archive-tools.daily-mode .daily-date-filter {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .date-filter-option {
    min-width: 46px;
    padding: 10px 12px;
  }

  .archive-status {
    justify-self: start;
    padding-bottom: 0;
    white-space: normal;
  }

  .daily-summary ol {
    padding-left: 22px;
  }

  .directory-summary {
    padding-left: 20px;
    font-size: 15px;
  }

  .paper-details summary {
    grid-template-columns: 16px minmax(0, 1fr);
    column-gap: 10px;
  }

  .paper-title {
    font-size: 22px;
  }

  .news-summary {
    font-size: 17px;
  }

  .transcript-turn {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .transcript-speaker {
    position: static;
  }
}
`;

async function main() {
  await mkdir(distDir, { recursive: true });
  try {
    await cp(publicDir, distDir, { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const files = (await readdir(reportsDir))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error("No reports found. Run npm run generate first.");
  }

  const reports = await Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(reportsDir, file), "utf8"))));
  const curation = {
    papers: await readJsonFile(path.join(curationDir, "papers.json"), []),
    podcasts: await readJsonFile(path.join(curationDir, "podcasts.json"), []),
    blogs: await readJsonFile(path.join(curationDir, "blogs.json"), [])
  };
  const candidateStores = await readCandidateStores();
  const transcriptPodcasts = [
    ...curation.podcasts,
    ...flattenCandidates(candidateStores).filter((item) => item.category === "podcasts")
  ];

  for (const file of files) {
    const report = JSON.parse(await readFile(path.join(reportsDir, file), "utf8"));
    await writeFile(path.join(distDir, file.replace(".json", ".html")), renderPage(report, files));
  }

  await writeFile(path.join(distDir, "index.html"), renderIndexPage(reports, curation));
  await writeFile(path.join(distDir, "curation-review.html"), renderReviewPage(candidateStores));
  await writeTranscriptPages(transcriptPodcasts);
  await writeFile(path.join(distDir, "styles.css"), css);
  console.log(`Built ${files.length} report page(s)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
