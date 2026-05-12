import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcesPath = path.join(root, "data", "sources.json");
const reportsDir = path.join(root, "data", "reports");
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const SECTION_CONFIG = [
  { id: "product_updates", title: "产品快讯", limit: 8 },
  { id: "research_frontier", title: "研究前线", limit: 8 },
  { id: "open_source_top", title: "开源项目", limit: 6 },
  { id: "social_shares", title: "社媒观察", limit: 10 }
];

const KEYWORDS = [
  ["release", "产品发布", 4],
  ["launch", "产品发布", 4],
  ["model", "模型", 3],
  ["api", "API", 3],
  ["agent", "智能体", 3],
  ["reasoning", "推理能力", 3],
  ["multimodal", "多模态", 3],
  ["benchmark", "评测", 2],
  ["paper", "论文", 2],
  ["open source", "开源", 3],
  ["github", "开源", 3],
  ["developer", "开发者工具", 2],
  ["inference", "推理部署", 2],
  ["rag", "RAG", 2],
  ["voice", "语音", 2],
  ["video", "视频", 2],
  ["image", "图像", 2],
  ["安全", "安全", 2],
  ["开源", "开源", 3],
  ["模型", "模型", 3],
  ["智能体", "智能体", 3],
  ["大模型", "大模型", 3]
];

function decodeEntities(value = "") {
  return value
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&#x2F;", "/")
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

function firstAttr(block, attr) {
  const match = block.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"));
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

function extractImage(block, sourceUrl) {
  const mediaContent = attrValue(block, "media:content", "url");
  const mediaThumbnail = attrValue(block, "media:thumbnail", "url");
  const enclosure = attrValue(block, "enclosure", "url");
  const imageTag = tagValue(block, "image") || tagValue(block, "itunes:image");
  const htmlImage = firstAttr(tagValue(block, "content:encoded") || tagValue(block, "description") || tagValue(block, "summary"), "src");
  const image = absoluteUrl(mediaContent || mediaThumbnail || enclosure || imageTag || htmlImage, sourceUrl);
  return isImageUrl(image) ? image : "";
}

function isImageUrl(url) {
  if (!url) return false;
  return !/\.(mp4|mov|webm|m3u8)(\?|$)/i.test(url);
}

function parseFeed(xml, source) {
  const itemBlocks = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const entryBlocks = [...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const blocks = itemBlocks.length > 0 ? itemBlocks : entryBlocks;

  return blocks.map((block) => {
    const title = stripHtml(tagValue(block, "title"));
    const link = tagValue(block, "link") || attrValue(block, "link", "href") || tagValue(block, "guid") || source.url;
    const description = stripHtml(tagValue(block, "description") || tagValue(block, "summary") || tagValue(block, "content") || tagValue(block, "content:encoded"));
    const publishedAt = tagValue(block, "pubDate") || tagValue(block, "published") || tagValue(block, "updated") || "";

    return {
      title,
      link: absoluteUrl(link, source.url) || link,
      description,
      publishedAt,
      image: extractImage(block, source.url),
      source: source.name,
      sourceType: source.type,
      section: source.section,
      channel: source.channel,
      trust: source.trust,
      sourceWeight: source.weight ?? 1
    };
  }).filter((item) => item.title && item.link);
}

function isRecent(item, source) {
  if (!item.publishedAt) return true;
  const published = new Date(item.publishedAt);
  if (Number.isNaN(published.getTime())) return true;
  const ageMs = Date.now() - published.getTime();
  const lookbackDays = source.lookbackDays ?? 7;
  return ageMs <= 1000 * 60 * 60 * 24 * lookbackDays;
}

function inferTags(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return [...new Set(KEYWORDS.filter(([keyword]) => text.includes(keyword.toLowerCase())).map(([, label]) => label))].slice(0, 5);
}

function scoreItem(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const keywordScore = KEYWORDS.reduce((score, [keyword, , value]) => score + (text.includes(keyword.toLowerCase()) ? value : 0), 0);
  const trustScore = item.trust === "official" ? 8 : item.trust === "expert" ? 5 : item.trust === "rank" ? 6 : 2;
  const imageScore = item.image ? 1 : 0;
  const productSignalScore = item.channel === "social" && /new in|available today|introducing|launch|released|now available|agent view|claude code|codex/i.test(text) ? 8 : 0;
  return item.sourceWeight * 3 + trustScore + keywordScore + imageScore + productSignalScore + socialEngagementScore(item);
}

function metricValue(text, marker) {
  const match = text.match(new RegExp(`${marker}\\s*([\\d,]+)`, "u"));
  return match ? Number(match[1].replaceAll(",", "")) : 0;
}

function socialEngagementScore(item) {
  if (item.channel !== "social") return 0;
  const text = `${item.title} ${item.description}`;
  const replies = metricValue(text, "💬");
  const reposts = metricValue(text, "🔄");
  const likes = metricValue(text, "❤️");
  const views = metricValue(text, "👀");
  const raw = Math.log10(likes + 1) * 4 + Math.log10(reposts + 1) * 2 + Math.log10(replies + 1) + Math.log10(views + 1) * 1.5;
  return Math.min(24, raw);
}

function summarize(item) {
  const text = item.description || item.title;
  const maxLength = item.section === "product_updates" ? 900 : 520;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function summaryZh(item) {
  const summary = summarize(item);
  if (/[\u4e00-\u9fff]/.test(summary)) return summary;
  const sourceLabel = item.channel === "social" ? "社媒" : item.channel === "paper_rank" ? "论文推荐" : "资讯";
  return `来自 ${item.source} 的${sourceLabel}：${summary}`;
}

function whyItMatters(item) {
  const tags = inferTags(item);
  if (item.section === "product_updates") return `这可能影响 AI 产品能力、开发者 API 或企业采用路径，值得关注后续落地。`;
  if (item.section === "research_frontier") return `这提供了模型能力、评测方法或研究方向的新信号，适合纳入前沿观察。`;
  if (item.section === "open_source_top") return `这可能代表近期开发者关注的开源方向，可继续观察项目活跃度和可用性。`;
  if (item.section === "social_shares") return `这条社媒信号有助于捕捉官方发布之外的讨论、观点或早期趋势。`;
  return tags.length > 0 ? `相关标签：${tags.join("、")}。` : "这条内容可作为今日 AI 信息流的候选信号。";
}

async function fetchText(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "ai-daily/0.1 (+https://github.com/Wan-Kai/ai-daily)"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRssSource(source) {
  const xml = await fetchText(source.url, source.timeoutMs ?? 15000);
  return parseFeed(xml, source).filter((item) => isRecent(item, source));
}

async function fetchHuggingFacePapers(source) {
  const url = source.url.replace("{date}", today);
  const html = await fetchText(url, source.timeoutMs ?? 20000);
  const paperLinks = [...html.matchAll(/<a[^>]+href=["'](\/papers\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      link: absoluteUrl(match[1], "https://huggingface.co"),
      title: stripHtml(match[2])
    }))
    .filter((item) => item.title && item.title.length > 8 && !item.title.includes("Daily Papers"));

  const deduped = new Map();
  for (const item of paperLinks) {
    if (!deduped.has(item.link)) deduped.set(item.link, item);
  }

  return [...deduped.values()].slice(0, source.limit ?? 12).map((item, index) => ({
    ...item,
    description: `Hugging Face Papers ${today} 排名第 ${index + 1} 的论文候选。`,
    publishedAt: today,
    image: "",
    source: source.name,
    sourceType: source.type,
    section: source.section,
    channel: source.channel,
    trust: source.trust,
    sourceWeight: source.weight ?? 1
  }));
}

async function fetchGitHubTrending(source) {
  const html = await fetchText(source.url, source.timeoutMs ?? 20000);
  const rows = [...html.matchAll(/<article[\s\S]*?Box-row[\s\S]*?<\/article>/gi)].map((match) => match[0]);
  return rows.slice(0, source.limit ?? 12).map((row) => {
    const repoPath = stripHtml(row.match(/<h2[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)?.[2] || "").replace(/\s+/g, "");
    const href = row.match(/<h2[\s\S]*?<a[^>]+href=["']([^"']+)["']/i)?.[1] || "";
    const description = stripHtml(row.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
    return {
      title: repoPath,
      link: absoluteUrl(href, "https://github.com"),
      description,
      publishedAt: today,
      image: "",
      source: source.name,
      sourceType: source.type,
      section: source.section,
      channel: source.channel,
      trust: source.trust,
      sourceWeight: source.weight ?? 1
    };
  }).filter((item) => item.title && item.link);
}

async function fetchSource(source) {
  if (source.kind === "huggingface_papers") return fetchHuggingFacePapers(source);
  if (source.kind === "github_trending") return fetchGitHubTrending(source);
  return fetchRssSource(source);
}

async function runWithConcurrency(items, limit, worker) {
  const results = [];
  let index = 0;
  async function next() {
    const current = index++;
    if (current >= items.length) return;
    results[current] = await worker(items[current], current);
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}

function publicItem(item) {
  const section = normalizedSection(item);

  return {
    title: item.title,
    titleZh: item.titleZh || item.title,
    link: item.link,
    publishedAt: item.publishedAt,
    source: item.source,
    sourceType: item.sourceType,
    section,
    channel: item.channel,
    trust: item.trust,
    image: item.image || "",
    summary: summarize(item),
    summaryZh: item.summaryZh || summaryZh(item),
    whyItMatters: item.whyItMatters || whyItMatters(item),
    tags: inferTags(item),
    score: scoreItem(item)
  };
}

function normalizedSection(item) {
  if (item.section !== "product_updates") return item.section;
  return isProductUpdate(item) ? "product_updates" : "social_shares";
}

function isProductUpdate(item) {
  if (item.channel !== "social" || item.trust !== "official") return false;
  const text = `${item.title} ${item.description}`.toLowerCase();
  if (/agent view|claude code.*agent view|parallel agents|gemini api.*file search|webhooks?.*gemini api|notebooklm.*mind map|google health.*gemini/.test(text)) {
    return true;
  }
  const positive = /new in|now available|available today|introducing|meet |launch(?:ed|es)?|release(?:d|s)?|roll(?:ed|ing)? out|adds?|announc(?:e|ed|es)|preview|beta|generally available|ga\b|codex|api|feature|plugin|integration|webhook|file search|notebooklm|gemini|cursor|teams|daybreak/.test(text);
  const negative = /research|paper|benchmark|principle|constitution|misalignment|monitor|safety evaluation|we found|we observed|how to|why|thread|opinion|recap|roundup|blog goes through|infrastructure issues|patterns we’ve been using|patterns we've been using|problems pretty quickly/i.test(text);
  return positive && !negative;
}

function isRelevantForSection(item, sectionId) {
  if (sectionId === "product_updates") {
    return item.channel === "social" && item.trust === "official";
  }

  if (sectionId !== "open_source_top") return true;
  const text = `${item.title} ${item.summary} ${item.summaryZh} ${item.tags.join(" ")}`.toLowerCase();
  if (item.source === "The GitHub Blog") {
    return /\bai\b|agent|copilot|llm|model|token|generative|智能体|模型/.test(text);
  }
  return /\bai\b|agent|copilot|llm|model|vector|embedding|rag|inference|开源|模型|智能体|向量|检索|推理/.test(text);
}

async function main() {
  const sources = JSON.parse(await readFile(sourcesPath, "utf8")).filter((source) => source.enabled !== false);
  const results = await runWithConcurrency(sources, 8, async (source) => {
    try {
      return { status: "fulfilled", source, items: await fetchSource(source) };
    } catch (error) {
      return { status: "rejected", source, reason: error };
    }
  });

  const failures = [];
  const fetched = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      fetched.push(...result.items);
    } else {
      failures.push({
        source: result.source.name,
        url: result.source.url,
        error: result.reason?.message || "Unknown error"
      });
    }
  }

  const deduped = new Map();
  for (const item of fetched) {
    const key = item.link.replace(/[#?].*$/, "").toLowerCase();
    const enriched = publicItem(item);
    const existing = deduped.get(key);
    if (!existing || enriched.score > existing.score) deduped.set(key, enriched);
  }

  const items = [...deduped.values()].sort((a, b) => b.score - a.score);
  const sections = SECTION_CONFIG.map((section) => ({
    id: section.id,
    title: section.title,
    items: items
      .filter((item) => item.section === section.id)
      .filter((item) => isRelevantForSection(item, section.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, section.limit)
  }));

  const selectedCount = sections.reduce((total, section) => total + section.items.length, 0);
  const report = {
    date: today,
    generatedAt: new Date().toISOString(),
    title: `AI 日报 - ${today}`,
    stats: {
      sources: sources.length,
      fetched: fetched.length,
      selected: selectedCount,
      failures: failures.length
    },
    sections,
    failures
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, `${today}.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Generated ${selectedCount} items for ${today}`);
  if (failures.length > 0) console.warn(`Source failures: ${failures.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
