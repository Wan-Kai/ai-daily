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

function renderItem(item) {
  const tags = (item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const title = item.titleZh || item.title;
  const summary = item.summaryZh || item.summary;
  const image = item.image ? `<a class="item-image" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(title)}" loading="lazy"></a>` : "";
  const whyItMatters = item.whyItMatters ? `<p class="why"><strong>为什么重要：</strong>${escapeHtml(item.whyItMatters)}</p>` : "";

  return `
    <article class="item">
      ${image}
      <div class="item-meta">
        <span>${escapeHtml(item.source)}</span>
        <span>${escapeHtml(item.channel || item.sourceType)}</span>
      </div>
      <h3><a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a></h3>
      <p>${escapeHtml(summary)}</p>
      ${whyItMatters}
      <div class="tags">${tags}</div>
    </article>
  `;
}

function renderSection(section) {
  const items = section.items.map(renderItem).join("");
  return `
    <section class="report-section" id="${escapeHtml(section.id)}">
      <div class="section-heading">
        <h2>${escapeHtml(section.title)}</h2>
        <span>${section.items.length} 条</span>
      </div>
      <div class="grid">${items || "<p>今天这个栏目暂无入选内容。</p>"}</div>
    </section>
  `;
}

function reportSummary(report) {
  const sections = report.sections || [];
  const itemCount = sections.reduce((total, section) => total + (section.items?.length || 0), 0);

  return {
    date: report.date,
    title: report.title || `AI Daily - ${report.date}`,
    generatedAt: report.generatedAt || "",
    sources: report.stats?.sources ?? 0,
    selected: report.stats?.selected ?? itemCount,
    failures: report.stats?.failures ?? report.failures?.length ?? 0
  };
}

function renderIndexPage(reports) {
  const rows = reports.map((report) => {
    const summary = reportSummary(report);

    return `
      <article class="directory-item">
        <div>
          <p class="directory-date">${escapeHtml(summary.date)}</p>
          <h2><a href="./${escapeHtml(summary.date)}.html">${escapeHtml(summary.title)}</a></h2>
          <p class="directory-meta">${summary.selected} 条入选内容 · ${summary.sources} 个来源 · ${summary.failures} 个来源异常</p>
        </div>
        <a class="detail-link" href="./${escapeHtml(summary.date)}.html">查看详情</a>
      </article>
    `;
  }).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Daily 日报目录</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <header class="site-header compact">
    <nav>
      <a class="brand" href="./index.html">AI Daily</a>
    </nav>
    <div class="hero">
      <p class="kicker">日报管理站点</p>
      <h1>AI Daily 日报目录</h1>
      <p class="lede">每天自动生成一个独立页面，点击日期即可查看当天详情。</p>
      <div class="stats">
        <span>${reports.length} 篇日报</span>
      </div>
    </div>
  </header>
  <main>
    <section class="report-section">
      <div class="section-heading">
        <h2>日报列表</h2>
        <span>${reports.length} days</span>
      </div>
      <div class="directory-list">${rows}</div>
    </section>
  </main>
</body>
</html>`;
}

function renderPage(report, reports) {
  const nav = reports.map((file) => {
    const date = file.replace(".json", "");
    const active = date === report.date ? "active" : "";
    return `<a class="${active}" href="./${date}.html">${date}</a>`;
  }).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.title)}</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <header class="site-header">
    <nav>
      <a class="brand" href="./index.html">AI Daily 日报目录</a>
      <div class="report-nav">${nav}</div>
    </nav>
    <div class="hero">
      <p class="kicker">每日详情</p>
      <h1>${escapeHtml(report.title)}</h1>
      <p class="lede">按产品更新、前沿研究、开源项目和社媒分享整理当天值得关注的 AI 信息。</p>
      <div class="stats">
        <span>${report.stats.sources} 个来源</span>
        <span>${report.stats.selected} 条入选</span>
        <span>${report.stats.failures} 个来源异常</span>
      </div>
    </div>
  </header>
  <main>
    ${report.sections.map(renderSection).join("")}
    ${report.failures.length > 0 ? `
      <section class="report-section">
        <div class="section-heading">
          <h2>来源异常</h2>
          <span>${report.failures.length}</span>
        </div>
        <div class="issues">
          ${report.failures.map((failure) => `<p><strong>${escapeHtml(failure.source)}</strong>: ${escapeHtml(failure.error)}</p>`).join("")}
        </div>
      </section>
    ` : ""}
  </main>
  <footer>
    Generated at ${escapeHtml(report.generatedAt)}
  </footer>
</body>
</html>`;
}

const css = `
:root {
  color-scheme: light;
  --bg: #f6f7f9;
  --panel: #ffffff;
  --text: #17202a;
  --muted: #5f6b7a;
  --line: #d9dee7;
  --accent: #0f766e;
  --accent-2: #b45309;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.55;
}

a {
  color: inherit;
}

.site-header {
  background: #10231f;
  color: #f8fafc;
  border-bottom: 1px solid #0b1815;
}

nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  max-width: 1180px;
  margin: 0 auto;
  padding: 18px 24px;
}

.brand {
  font-weight: 800;
  text-decoration: none;
}

.report-nav {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  white-space: nowrap;
}

.report-nav a {
  border: 1px solid rgba(255,255,255,.24);
  color: #dbeafe;
  padding: 6px 10px;
  border-radius: 6px;
  text-decoration: none;
  font-size: 13px;
}

.report-nav a.active {
  background: #f8fafc;
  color: #10231f;
}

.hero {
  max-width: 1180px;
  margin: 0 auto;
  padding: 64px 24px 72px;
}

.kicker {
  margin: 0 0 12px;
  color: #99f6e4;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
}

h1 {
  margin: 0;
  max-width: 840px;
  font-size: clamp(38px, 7vw, 82px);
  line-height: .96;
  letter-spacing: 0;
}

.lede {
  max-width: 760px;
  margin: 24px 0 0;
  color: #cbd5e1;
  font-size: 19px;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;
}

.stats span {
  border: 1px solid rgba(255,255,255,.24);
  border-radius: 6px;
  padding: 8px 12px;
  color: #e2e8f0;
}

main {
  max-width: 1180px;
  margin: 0 auto;
  padding: 34px 24px 64px;
}

.report-section {
  margin-top: 38px;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 12px;
  margin-bottom: 18px;
}

.section-heading h2 {
  margin: 0;
  font-size: 24px;
}

.section-heading span {
  color: var(--muted);
  font-size: 14px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.item {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}

.item > :not(.item-image) {
  margin-left: 18px;
  margin-right: 18px;
}

.item > :last-child {
  margin-bottom: 18px;
}

.item-image {
  display: block;
  aspect-ratio: 16 / 9;
  background: #e5e7eb;
  overflow: hidden;
}

.item-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .08em;
}

.item h3 {
  margin: 12px 0 10px;
  font-size: 18px;
  line-height: 1.3;
}

.item h3 a {
  text-decoration: none;
}

.item h3 a:hover {
  color: var(--accent);
}

.item p {
  margin: 0;
  color: #344054;
}

.item .why {
  margin-top: 12px;
  color: #1f2937;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 14px;
}

.tags span {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 12px;
}

.advantages {
  margin: 14px 0 0;
  padding-left: 18px;
  color: #374151;
}

.advantages li + li {
  margin-top: 4px;
}

.issues {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  padding: 14px 18px;
  color: #7c2d12;
}

footer {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 24px 34px;
  color: var(--muted);
  font-size: 13px;
}

.site-header.compact .hero {
  padding-bottom: 48px;
}

.directory-list {
  display: grid;
  gap: 12px;
}

.directory-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 18px;
}

.directory-date {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 13px;
  font-weight: 800;
}

.directory-item h2 {
  margin: 0;
  font-size: 20px;
}

.directory-item h2 a,
.detail-link {
  text-decoration: none;
}

.directory-meta {
  margin: 8px 0 0;
  color: var(--muted);
}

.detail-link {
  flex: 0 0 auto;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--accent);
  font-size: 14px;
  font-weight: 700;
}

@media (max-width: 720px) {
  nav {
    align-items: flex-start;
    flex-direction: column;
  }

  .hero {
    padding-top: 42px;
    padding-bottom: 52px;
  }

  .directory-item {
    align-items: flex-start;
    flex-direction: column;
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
    const html = renderPage(report, files);
    await writeFile(path.join(distDir, file.replace(".json", ".html")), html);
  }

  await writeFile(path.join(distDir, "index.html"), renderIndexPage(reports));
  await writeFile(path.join(distDir, "styles.css"), css);
  console.log(`Built ${files.length} report page(s)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
