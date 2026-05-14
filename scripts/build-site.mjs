import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const reportsDir = path.join(root, "data", "reports");
const curationDir = path.join(root, "data", "curation");
const distDir = path.join(root, "dist");
const publicDir = path.join(root, "public");

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

function renderItem(item, index) {
  const title = item.titleZh || item.title;
  const summary = item.summaryZh || item.summary;
  const tags = (item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const summaryHtml = String(summary || "")
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${renderInlineMarkdown(paragraph)}</p>`)
    .join("");
  // 给视频保留直达链接，避免浏览器播放器控件不可用时无法打开媒体。
  const video = item.video ? `
    <figure class="news-figure">
      <video src="${escapeHtml(item.video)}" controls preload="metadata" playsinline${item.image ? ` poster="${escapeHtml(item.image)}"` : ""}></video>
      <figcaption><a href="${escapeHtml(item.video)}" target="_blank" rel="noreferrer">查看视频</a> · <a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">查看原文</a></figcaption>
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
        <p class="news-meta">${escapeHtml(item.source)} · <a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">原文</a></p>
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
    const summary = (report.summaryBullets || [])
      .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
      .join("");

    return `
      <article class="directory-item">
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

function curationDate(item) {
  return item.selectedAt || item.publishedAt || "待定";
}

function renderCurationItems(items, type) {
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
    const takeaways = (item.takeaways || [])
      .map((takeaway) => `<li>${renderInlineMarkdown(takeaway)}</li>`)
      .join("");
    const tags = (item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");

    return `
      <article class="curation-item">
        <time>${escapeHtml(curationDate(item))}</time>
        <div class="curation-content">
          <h3><a href="${escapeHtml(item.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a></h3>
          <p class="curation-meta">${escapeHtml(item.source || "待补充来源")}${item.author ? ` · ${escapeHtml(item.author)}` : ""}${item.duration ? ` · ${escapeHtml(item.duration)}` : ""}</p>
          ${item.summaryZh ? `<div class="curation-summary">${String(item.summaryZh).split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean).map((paragraph) => `<p>${renderInlineMarkdown(paragraph)}</p>`).join("")}</div>` : ""}
          ${takeaways ? `<ol class="curation-takeaways">${takeaways}</ol>` : ""}
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
      <p class="subtitle">一份按日期归档的 AI 中文日报，也会沉淀值得长期回看的论文、播客和博客。</p>
    </div>
  </header>
  <main class="paper">
    <nav class="archive-tabs" aria-label="内容分类">
      <button class="active" type="button" data-tab="daily">每日简报</button>
      <button type="button" data-tab="papers">精选论文</button>
      <button type="button" data-tab="podcasts">精选播客</button>
      <button type="button" data-tab="blogs">精选博客</button>
    </nav>
    <section class="directory tab-panel active" id="tab-daily">
      <h2>每日简报</h2>
      <div class="directory-list">${renderDirectoryRows(reports)}</div>
    </section>
    <section class="directory tab-panel" id="tab-papers">
      <h2>精选论文</h2>
      <div class="curation-list">${renderCurationItems(curation.papers, "papers")}</div>
    </section>
    <section class="directory tab-panel" id="tab-podcasts">
      <h2>精选播客</h2>
      <div class="curation-list">${renderPodcastItems(curation.podcasts)}</div>
    </section>
    <section class="directory tab-panel" id="tab-blogs">
      <h2>精选博客</h2>
      <div class="curation-list">${renderCurationItems(curation.blogs, "blogs")}</div>
    </section>
  </main>
  <script>
    const tabs = [...document.querySelectorAll(".archive-tabs button")];
    const panels = [...document.querySelectorAll(".tab-panel")];

    function activateTab(name) {
      tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
      panels.forEach((panel) => panel.classList.toggle("active", panel.id === "tab-" + name));
      if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    });

    const initialTab = location.hash.replace("#", "");
    if (tabs.some((tab) => tab.dataset.tab === initialTab)) activateTab(initialTab);
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
  padding: 48px 0 70px;
}

.archive-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 34px 0 0;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
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

.curation-meta {
  margin: 8px 0 0;
  color: var(--muted);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  line-height: 1.5;
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
  .curation-item {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .archive-tabs {
    margin-top: 26px;
  }

  .daily-summary ol {
    padding-left: 22px;
  }

  .directory-summary {
    padding-left: 20px;
    font-size: 15px;
  }

  .news-summary {
    font-size: 17px;
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

  for (const file of files) {
    const report = JSON.parse(await readFile(path.join(reportsDir, file), "utf8"));
    await writeFile(path.join(distDir, file.replace(".json", ".html")), renderPage(report, files));
  }

  await writeFile(path.join(distDir, "index.html"), renderIndexPage(reports, curation));
  await writeFile(path.join(distDir, "styles.css"), css);
  console.log(`Built ${files.length} report page(s)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
