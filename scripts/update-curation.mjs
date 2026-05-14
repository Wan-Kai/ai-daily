import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const root = process.cwd();
const sourcesPath = path.join(root, "data", "curation-sources.json");
const curationDir = path.join(root, "data", "curation");
const reportsDir = path.join(root, "data", "reports");
const execFileAsync = promisify(execFile);

const MAX_ITEMS = {
  papers: 24,
  blogs: 30,
  podcasts: 30
};

const PUBLISH_LIMIT = {
  papers: 4,
  blogs: 3,
  podcasts: 3
};

const MIN_SCORE = {
  papers: 24,
  blogs: 22,
  podcasts: 20
};

const RECENT_DAYS = {
  papers: 14,
  blogs: 45,
  podcasts: 90
};

const KEYWORD_RULES = [
  [/agent|agents|agentic|tool use|computer use/i, "Agent", 5],
  [/llm|language model|large language model|foundation model/i, "LLM", 4],
  [/reasoning|chain-of-thought|inference/i, "推理", 4],
  [/multimodal|vision-language|text-to-image|image generation|video generation/i, "多模态", 4],
  [/benchmark|evaluation|eval|leaderboard/i, "评测", 3],
  [/rag|retrieval|vector|embedding|search/i, "RAG", 3],
  [/open source|github|dataset|code/i, "开源", 3],
  [/safety|alignment|security|privacy|governance/i, "安全治理", 3],
  [/case study|production|deployment|scale|latency|cost/i, "工程落地", 3],
  [/paper|research|arxiv/i, "研究", 2],
  [/模型|智能体|多模态|推理|评测|开源|安全|播客|论文/i, "AI", 3]
];

const PRESTIGE_RULES = [
  [/openai|anthropic|deepmind|google|microsoft research|meta ai|stanford|mit|berkeley|carnegie mellon|cmu|princeton|tsinghua|清华|北京大学|pku/i, 7],
  [/hugging face|nvidia|databricks|simon willison|latent space|qdrant|langchain/i, 5],
  [/neurips|icml|iclr|acl|emnlp|cvpr|iccv|eccv|siggraph|nature|science/i, 6]
];

function decodeEntities(value = "") {
  return String(value)
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function stripHtml(value = "") {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

function attrValue(block, tag, attr) {
  const match = block.match(new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["'][^>]*>`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

function absoluteUrl(url, base) {
  if (!url) return "";
  try {
    return new URL(url, base).toString();
  } catch {
    return "";
  }
}

function normalizedLinkKey(link = "") {
  try {
    const url = new URL(link);
    url.hash = "";
    url.searchParams.delete("utm_source");
    url.searchParams.delete("utm_medium");
    url.searchParams.delete("utm_campaign");
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return String(link).replace(/[#?].*$/, "").replace(/\/$/, "").toLowerCase();
  }
}

function normalizedTitleKey(title = "") {
  return stripHtml(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isoWeek(date = new Date()) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function todayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function fetchText(url, timeoutMs = 18000) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "user-agent": "ai-daily-curation/0.1 (+https://github.com/Wan-Kai/ai-daily)"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    return fetchTextViaCurlProxy(url, timeoutMs, error);
  }
}

async function fetchTextViaCurlProxy(url, timeoutMs, originalError) {
  const proxies = [
    process.env.AI_DAILY_HTTPS_PROXY,
    process.env.HTTPS_PROXY,
    process.env.HTTP_PROXY,
    "http://127.0.0.1:6789",
    "http://127.0.0.1:7890"
  ].filter(Boolean);

  for (const proxy of [...new Set(proxies)]) {
    try {
      const { stdout } = await execFileAsync("curl", [
        "--silent",
        "--show-error",
        "--location",
        "--max-time",
        String(Math.ceil(timeoutMs / 1000)),
        "--proxy",
        proxy,
        "--user-agent",
        "ai-daily-curation/0.1 (+https://github.com/Wan-Kai/ai-daily)",
        url
      ], { maxBuffer: 20 * 1024 * 1024 });
      if (stdout) return stdout;
    } catch {
      // 继续尝试下一个代理。
    }
  }

  throw originalError;
}

function parseFeed(xml, source) {
  const itemBlocks = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const entryBlocks = [...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const blocks = itemBlocks.length > 0 ? itemBlocks : entryBlocks;

  return blocks.slice(0, 40).map((block) => {
    const title = stripHtml(tagValue(block, "title"));
    const link = tagValue(block, "link") || attrValue(block, "link", "href") || tagValue(block, "guid") || source.url;
    const description = stripHtml(tagValue(block, "description") || tagValue(block, "summary") || tagValue(block, "content") || tagValue(block, "content:encoded"));
    const publishedAt = tagValue(block, "pubDate") || tagValue(block, "published") || tagValue(block, "updated") || "";
    const duration = tagValue(block, "itunes:duration");

    return {
      source: source.name,
      sourceWeight: source.weight || 1,
      language: source.language,
      title,
      url: absoluteUrl(link, source.url) || link,
      summary: description,
      publishedAt: normalizeDate(publishedAt),
      duration
    };
  }).filter((item) => item.title && item.url);
}

function normalizeDate(value = "") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function parseHuggingFaceWeekly(html, source, week) {
  const seen = new Set();
  const candidates = [];
  const linkPattern = /<a\b[^>]+href=["'](\/papers\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const href = match[1];
    const title = stripHtml(match[2]);
    if (!title || title.length < 8 || seen.has(href)) continue;
    seen.add(href);
    candidates.push({
      source: source.name,
      sourceWeight: source.weight || 1,
      title,
      url: absoluteUrl(href, "https://huggingface.co"),
      summary: `Hugging Face Papers ${week} 周榜入选论文。`,
      publishedAt: "",
      rank: candidates.length + 1
    });
  }

  return candidates.slice(0, 20);
}

async function fetchSource(source, category) {
  if (!source.enabled) return [];
  if (source.kind === "huggingface_weekly") {
    const week = isoWeek();
    const url = source.urlTemplate.replace("{isoWeek}", week);
    const html = await fetchText(url, 30000);
    return parseHuggingFaceWeekly(html, source, week).map((item) => ({ ...item, category }));
  }

  if (source.kind === "rss") {
    const xml = await fetchText(source.url, 20000);
    return parseFeed(xml, source).map((item) => ({ ...item, category }));
  }

  return [];
}

function tagsFor(item) {
  const text = `${item.title} ${item.summary} ${item.source}`;
  const tags = [];
  for (const [pattern, tag] of KEYWORD_RULES) {
    if (pattern.test(text) && !tags.includes(tag)) tags.push(tag);
  }
  return tags.slice(0, 5);
}

function qualityScore(item, category) {
  const text = `${item.title} ${item.summary} ${item.source}`;
  let score = item.sourceWeight || 0;

  for (const [pattern, , value] of KEYWORD_RULES) {
    if (pattern.test(text)) score += value;
  }
  for (const [pattern, value] of PRESTIGE_RULES) {
    if (pattern.test(text)) score += value;
  }
  if (item.rank) score += Math.max(0, 12 - item.rank);
  if (item.summary && item.summary.length > 220) score += 2;
  if (category === "podcasts" && /interview|conversation|播客|访谈|episode/i.test(text)) score += 2;
  if (/release notes|changelog|webinar|event|speaker lineup|conference|meetup|招聘|活动|newsletter/i.test(text)) score -= 12;

  return score;
}

function ageInDays(item) {
  if (!item.publishedAt) return 0;
  const date = new Date(`${item.publishedAt}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function isEventOrAnnouncement(item) {
  return /speaker lineup|conference|webinar|meetup|event|registration|agenda|call for|newsletter|roundup|repo stats|statistics dashboard|周报|活动|报名|议程/i.test(`${item.title} ${item.summary}`);
}

function hasPrestigeSignal(item) {
  const text = `${item.title} ${item.summary} ${item.source}`;
  return PRESTIGE_RULES.some(([pattern]) => pattern.test(text));
}

function isStrongCandidate(item, category, score) {
  if (isEventOrAnnouncement(item)) return false;
  const days = ageInDays(item);
  if (item.publishedAt && days > RECENT_DAYS[category]) return false;
  if (category === "papers") {
    return item.source === "Hugging Face Weekly Papers";
  }
  if (category === "blogs") {
    return hasPrestigeSignal(item) && score >= MIN_SCORE[category];
  }
  if (category === "podcasts") {
    if (!item.summary || item.summary.length < 80) return false;
    if (/\[?ainews\]?|daily news|news roundup|新闻速递/i.test(`${item.title} ${item.summary}`)) return false;
    return score >= MIN_SCORE[category] && /agent|llm|openai|anthropic|deepmind|agi|大模型|智能体|模型|AI/i.test(`${item.title} ${item.summary}`);
  }
  return score >= MIN_SCORE[category];
}

function summaryFor(item, category, tags) {
  const cleanSummary = item.summary ? stripHtml(item.summary).slice(0, 260) : "";
  if (category === "papers") {
    return `**核心结论**：这篇论文围绕 ${tags.length ? tags.join("、") : "AI 研究"} 展开，${item.rank ? `进入 **Hugging Face 周榜第 ${item.rank} 名**，说明社区关注度较高` : `具备较强候选信号`}。需要在摘要里讲清它解决的问题、提出的方法和适用场景，不能只写一句泛化概括。\n**如何论证**：来源为 ${item.source}${cleanSummary ? `，原始摘要线索是：${cleanSummary}` : ""}。正式发布前需要补充模型、数据、评测、实验结果、开源材料或案例，说明作者如何支撑核心结论。\n**阅读价值**：说明这篇论文适合谁读、能启发什么工程或研究判断，以及仍需要复核的限制条件。`;
  }

  if (category === "podcasts") {
    return `**核心内容**：这一期来自 ${item.source}，主题与 ${tags.length ? tags.join("、") : "AI 趋势"} 相关。摘要需要讲清嘉宾/主持围绕什么问题展开，以及讨论了哪些关键观点。\n**内容线索**：${cleanSummary || "需要进一步查看节目简介、show notes 或转录文本来确认要点。"} 正式发布前需要继续补充讨论脉络、关键案例、嘉宾分歧或结论，让读者不用先听完整节目也能知道这一期在讲什么。`;
  }

  return `**核心内容**：这篇文章来自 ${item.source}，主题与 ${tags.length ? tags.join("、") : "AI 技术与产业"} 相关。摘要需要讲清文章到底在解释什么问题、给出什么经验或结论。\n**展开方式**：${cleanSummary || "需要进一步阅读全文确认论证结构。"} 正式发布前需要继续补充文章的论证路径、关键案例、方法细节和工程取舍，只保留文章本身讲清楚的内容。`;
}

function toCurationItem(item, category) {
  const tags = tagsFor(item);
  const score = qualityScore(item, category);
  const selectedAt = todayDate();
  const idSource = normalizedLinkKey(item.url) || normalizedTitleKey(item.title);
  const id = idSource
    .replace(/^https?:\/\//, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);

  return {
    id,
    titleZh: item.title,
    title: item.title,
    source: item.source,
    url: item.url,
    publishedAt: item.publishedAt || "",
    selectedAt,
    language: item.language,
    duration: item.duration,
    summaryZh: summaryFor(item, category, tags),
    takeaways: [],
    tags,
    score,
    status: "published"
  };
}

async function reportKeys() {
  const keys = new Set();
  for (const file of (await readdir(reportsDir)).filter((name) => name.endsWith(".json"))) {
    const report = await readJson(path.join(reportsDir, file), {});
    for (const section of report.sections || []) {
      for (const item of section.items || []) {
        if (item.link) keys.add(normalizedLinkKey(item.link));
        if (item.titleZh || item.title) keys.add(normalizedTitleKey(item.titleZh || item.title));
      }
    }
  }
  return keys;
}

function mergeItems(existing, candidates, category, reportSeen) {
  const seen = new Set();
  const merged = [];

  for (const item of existing) {
    const linkKey = normalizedLinkKey(item.url);
    const titleKey = normalizedTitleKey(item.titleZh || item.title);
    if (linkKey) seen.add(linkKey);
    if (titleKey) seen.add(titleKey);
    merged.push(item);
  }

  const fresh = candidates
    .map((item) => toCurationItem(item, category))
    .filter((item) => item.score >= MIN_SCORE[category])
    .filter((item) => isStrongCandidate(item, category, item.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, PUBLISH_LIMIT[category])
    .filter((item) => {
      const linkKey = normalizedLinkKey(item.url);
      const titleKey = normalizedTitleKey(item.titleZh || item.title);
      if (seen.has(linkKey) || seen.has(titleKey) || reportSeen.has(linkKey) || reportSeen.has(titleKey)) return false;
      seen.add(linkKey);
      seen.add(titleKey);
      return true;
    });

  return [...fresh, ...merged]
    .sort((a, b) => (b.selectedAt || "").localeCompare(a.selectedAt || "") || (b.score || 0) - (a.score || 0))
    .slice(0, MAX_ITEMS[category]);
}

async function updateCategory(category, sources, reportSeen) {
  const existingPath = path.join(curationDir, `${category}.json`);
  const existing = await readJson(existingPath, []);
  const results = [];

  for (const source of sources || []) {
    try {
      results.push(...await fetchSource(source, category));
    } catch (error) {
      console.warn(`精选源抓取失败：${category} / ${source.name} - ${error.message}`);
    }
  }

  const updated = mergeItems(existing, results, category, reportSeen);
  await writeJson(existingPath, updated);
  console.log(`${category}: 候选 ${results.length} 条，发布库 ${existing.length} -> ${updated.length}`);
}

async function main() {
  const sources = await readJson(sourcesPath, {});
  const reportSeen = await reportKeys();
  await mkdir(curationDir, { recursive: true });
  await updateCategory("papers", sources.papers, reportSeen);
  await updateCategory("blogs", sources.blogs, reportSeen);
  await updateCategory("podcasts", sources.podcasts, reportSeen);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
