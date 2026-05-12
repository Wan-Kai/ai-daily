import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const reportsDir = path.join(root, "data", "reports");
const distDir = path.join(root, "dist");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
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
        ${image}
        <p class="news-summary">${escapeHtml(summary)}</p>
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

function renderIndexPage(reports) {
  const rows = reports.map((report) => `
    <article class="directory-item">
      <a href="./${escapeHtml(report.date)}.html">
        <time>${escapeHtml(report.date)}</time>
        <strong>${escapeHtml(reportTitle(report))}</strong>
        <span>${escapeHtml(sectionCounts(report))}</span>
        <em>查看日报</em>
      </a>
    </article>
  `).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Daily 日报目录</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <header class="masthead">
    <div class="paper">
      <p class="eyebrow">Daily Archive</p>
      <h1>AI Daily</h1>
      <p class="subtitle">一份按日期归档的 AI 中文日报。</p>
    </div>
  </header>
  <main class="paper">
    <section class="directory">
      <h2>日报目录</h2>
      <div class="directory-list">${rows}</div>
    </section>
  </main>
</body>
</html>`;
}

function renderPage(report, reports) {
  const dateOptions = reports.map((file) => {
    const date = file.replace(".json", "");
    const selected = date === report.date ? " selected" : "";
    return `<option value="./${date}.html"${selected}>${date}</option>`;
  }).join("");
  const sectionLinks = (report.sections || [])
    .map((section) => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a>`)
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(reportTitle(report))}</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <header class="masthead">
    <nav class="topline">
      <a href="./index.html">AI Daily</a>
      <label class="date-picker">
        <span>选择日期</span>
        <select onchange="if (this.value) window.location.href = this.value">${dateOptions}</select>
      </label>
    </nav>
    <div class="paper">
      <p class="eyebrow">${escapeHtml(report.date)}</p>
      <h1 class="report-title">AI 日报</h1>
      <p class="issue-date">${escapeHtml(titleDate(report))}</p>
      <p class="subtitle">像读一份报纸一样，从上往下浏览今日值得关注的 AI 动向。</p>
      <div class="section-nav">${sectionLinks}</div>
    </div>
  </header>
  <main class="paper report">
    ${(report.sections || []).map(renderSection).join("")}
  </main>
  <footer class="paper footer">
    <span>Generated at ${escapeHtml(report.generatedAt)}</span>
  </footer>
</body>
</html>`;
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

.date-picker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.date-picker span {
  color: var(--muted);
}

.date-picker select {
  appearance: none;
  background-color: transparent;
  border: 1px solid var(--line);
  border-radius: 0;
  color: var(--ink);
  font: inherit;
  padding: 6px 30px 6px 10px;
  background-image: linear-gradient(45deg, transparent 50%, var(--accent) 50%), linear-gradient(135deg, var(--accent) 50%, transparent 50%);
  background-position: calc(100% - 15px) 50%, calc(100% - 10px) 50%;
  background-repeat: no-repeat;
  background-size: 5px 5px, 5px 5px;
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

.section-heading {
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: 18px;
  align-items: end;
  margin-bottom: 26px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--ink);
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
  max-height: 440px;
  object-fit: cover;
  border: 1px solid var(--line);
  filter: saturate(.92) contrast(1.02);
}

.news-summary {
  margin: 16px 0 0;
  color: #24211d;
  font-size: 18px;
  line-height: 1.9;
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

.directory-item time {
  color: var(--accent);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  font-weight: 800;
}

.directory-item strong {
  display: block;
  font-size: 26px;
  line-height: 1.2;
}

.directory-item span {
  grid-column: 2;
  color: var(--muted);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
}

.directory-item em {
  grid-column: 2;
  color: var(--accent);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 13px;
  font-style: normal;
  font-weight: 800;
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
  .directory-item a {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .directory-item span {
    grid-column: auto;
  }

  .directory-item em {
    grid-column: auto;
  }

  .news-summary {
    font-size: 17px;
  }
}
`;

async function main() {
  await mkdir(distDir, { recursive: true });
  const files = (await readdir(reportsDir))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error("No reports found. Run npm run generate first.");
  }

  const reports = await Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(reportsDir, file), "utf8"))));

  for (const file of files) {
    const report = JSON.parse(await readFile(path.join(reportsDir, file), "utf8"));
    await writeFile(path.join(distDir, file.replace(".json", ".html")), renderPage(report, files));
  }

  await writeFile(path.join(distDir, "index.html"), renderIndexPage(reports));
  await writeFile(path.join(distDir, "styles.css"), css);
  console.log(`Built ${files.length} report page(s)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
