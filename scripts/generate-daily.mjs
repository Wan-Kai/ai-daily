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
  { id: "practice_cases", title: "实践案例", limit: 6 },
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

function attrValues(block, tag, attr) {
  return [...block.matchAll(new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["'][^>]*>`, "gi"))]
    .map((match) => decodeEntities(match[1]).trim())
    .filter(Boolean);
}

function tagBlocks(block, tag) {
  return [...block.matchAll(new RegExp(`<${tag}[^>]*>`, "gi"))].map((match) => match[0]);
}

function attrsFromTag(tag = "") {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)=["']([^"']+)["']/g)]
      .map(([, key, value]) => [key.toLowerCase(), decodeEntities(value).trim()])
  );
}

function htmlImageCandidates(html = "", base) {
  return [...html.matchAll(/<img\b[^>]*>/gi)]
    .map((match) => attrsFromTag(match[0]))
    .map((attrs) => ({
      url: absoluteUrl(attrs.src || attrs["data-src"], base),
      source: "html",
      width: Number(attrs.width || 0),
      height: Number(attrs.height || 0)
    }))
    .filter((candidate) => candidate.url && isImageUrl(candidate.url));
}

function htmlVideoCandidates(html = "", base) {
  return [
    ...[...html.matchAll(/<video\b[^>]*>/gi)].map((match) => attrsFromTag(match[0])),
    ...[...html.matchAll(/<source\b[^>]*>/gi)].map((match) => attrsFromTag(match[0]))
  ]
    .map((attrs) => ({
      url: absoluteUrl(attrs.src, base),
      type: attrs.type || "",
      source: "html-video"
    }))
    .filter((candidate) => candidate.url && isVideoCandidate(candidate));
}

function metaMediaCandidates(html = "", base) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => attrsFromTag(match[0]))
    .map((attrs) => ({
      url: absoluteUrl(attrs.content, base),
      key: (attrs.property || attrs.name || "").toLowerCase()
    }))
    .filter((candidate) => candidate.url)
    .map((candidate) => ({
      url: candidate.url,
      source: candidate.key.includes("twitter:image") ? "twitter:image" : candidate.key.includes("og:image") ? "og:image" : candidate.key.includes("twitter:player") ? "twitter:player" : candidate.key.includes("og:video") ? "og:video" : "meta"
    }));
}

function absoluteUrl(url, base) {
  if (!url) return "";
  try {
    return new URL(url, base).toString();
  } catch {
    return "";
  }
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate.url || seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

function extractMedia(block, sourceUrl) {
  const candidates = [];
  for (const tag of tagBlocks(block, "media:content")) {
    const attrs = attrsFromTag(tag);
    candidates.push({
      url: absoluteUrl(attrs.url, sourceUrl),
      type: attrs.type || "",
      medium: attrs.medium || "",
      width: Number(attrs.width || 0),
      height: Number(attrs.height || 0),
      source: "media:content"
    });
  }
  for (const tag of tagBlocks(block, "media:thumbnail")) {
    const attrs = attrsFromTag(tag);
    candidates.push({
      url: absoluteUrl(attrs.url, sourceUrl),
      width: Number(attrs.width || 0),
      height: Number(attrs.height || 0),
      source: "media:thumbnail"
    });
  }
  for (const tag of tagBlocks(block, "enclosure")) {
    const attrs = attrsFromTag(tag);
    candidates.push({
      url: absoluteUrl(attrs.url, sourceUrl),
      type: attrs.type || "",
      source: "enclosure"
    });
  }

  const imageTag = tagValue(block, "image") || attrValue(block, "itunes:image", "href");
  if (imageTag) candidates.push({ url: absoluteUrl(imageTag, sourceUrl), source: "image" });

  const html = tagValue(block, "content:encoded") || tagValue(block, "description") || tagValue(block, "summary");
  candidates.push(...htmlImageCandidates(html, sourceUrl));
  candidates.push(...htmlVideoCandidates(html, sourceUrl));

  const imageCandidates = uniqueCandidates(candidates.filter((candidate) => isImageCandidate(candidate)));
  const videoCandidates = uniqueCandidates(candidates.filter((candidate) => isVideoCandidate(candidate)));

  return {
    imageCandidates,
    videoCandidates,
    image: imageCandidates[0]?.url || "",
    video: videoCandidates[0]?.url || ""
  };
}

function isImageCandidate(candidate) {
  if (!candidate?.url) return false;
  const type = candidate.type || "";
  if (/^image\//i.test(type) || candidate.medium === "image") return true;
  return isImageUrl(candidate.url) && !isVideoCandidate(candidate);
}

function isVideoCandidate(candidate) {
  if (!candidate?.url) return false;
  const type = candidate.type || "";
  return /^video\//i.test(type) || /\.(mp4|mov|webm|m3u8)(\?|$)/i.test(candidate.url);
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
    const media = extractMedia(block, source.url);

    return {
      title,
      link: absoluteUrl(link, source.url) || link,
      description,
      publishedAt,
      image: media.image,
      imageCandidates: media.imageCandidates,
      video: media.video,
      videoCandidates: media.videoCandidates,
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
  const imageScore = item.image || item.video ? 1 : 0;
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
  return summary;
}

function whyItMatters(item) {
  const tags = inferTags(item);
  if (item.section === "product_updates") return `这可能影响 AI 产品能力、开发者 API 或企业采用路径，值得关注后续落地。`;
  if (item.section === "practice_cases") return `这展示了 AI 在真实业务、团队流程或客户场景中的落地方式，适合观察采用路径。`;
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

async function fetchBinary(url, timeoutMs = 8000) {
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
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") || ""
    };
  } finally {
    clearTimeout(timeout);
  }
}

function readUint32BE(bytes, offset) {
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

function readUint32LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function readUint24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function parseImageSize(bytes, contentType = "") {
  const ascii = (start, length) => String.fromCharCode(...bytes.slice(start, start + length));
  if (bytes.length >= 24 && ascii(1, 3) === "PNG") {
    return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) };
  }
  if (bytes.length >= 10 && ascii(0, 3) === "GIF") {
    return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
  }
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const format = ascii(12, 4);
    if (format === "VP8X" && bytes.length >= 30) {
      return { width: readUint24LE(bytes, 24) + 1, height: readUint24LE(bytes, 27) + 1 };
    }
    if (format === "VP8 " && bytes.length >= 30) {
      return { width: bytes[26] | ((bytes[27] & 0x3f) << 8), height: bytes[28] | ((bytes[29] & 0x3f) << 8) };
    }
    if (format === "VP8L" && bytes.length >= 25) {
      const bits = readUint32LE(bytes, 21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: (bytes[offset + 7] << 8) + bytes[offset + 8], height: (bytes[offset + 5] << 8) + bytes[offset + 6] };
      }
      offset += 2 + length;
    }
  }
  if (/svg/i.test(contentType) || ascii(0, Math.min(bytes.length, 256)).includes("<svg")) {
    const text = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 2048)));
    const width = Number(text.match(/\bwidth=["']?([\d.]+)/i)?.[1] || 0);
    const height = Number(text.match(/\bheight=["']?([\d.]+)/i)?.[1] || 0);
    const viewBox = text.match(/\bviewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
    return { width: width || Number(viewBox?.[1] || 0), height: height || Number(viewBox?.[2] || 0) };
  }
  return null;
}

function isLikelyAvatarImage(url) {
  return /profile_images\/|_normal\.(?:jpe?g|png|webp)(?:\?|$)|\/(?:\d+x)?100x100\.|avatar|logo/i.test(url);
}

function isUsableNewsImage(size) {
  if (!size?.width || !size?.height) return false;
  return size.width >= 360 && size.height >= 180 && size.width * size.height >= 90000;
}

function imageCandidateScore(candidate, size) {
  if (!isUsableNewsImage(size) || isLikelyAvatarImage(candidate.url)) return -Infinity;
  const area = size.width * size.height;
  const ratio = size.width / size.height;
  const ratioScore = ratio >= 1.2 && ratio <= 2.4 ? 8 : ratio >= .75 && ratio <= 3 ? 4 : 0;
  const sourceScore = candidate.source === "og:image" || candidate.source === "twitter:image" ? 18 : candidate.source === "media:content" ? 10 : candidate.source === "image" ? 8 : candidate.source === "html" ? 6 : candidate.source === "media:thumbnail" ? 3 : 2;
  const urlPenalty = /sprite|icon|favicon|logo|avatar|profile|placeholder/i.test(candidate.url) ? 20 : 0;
  return Math.log10(area) * 10 + ratioScore + sourceScore - urlPenalty;
}

async function enrichPageMediaCandidates(item) {
  if (!/^https?:\/\//i.test(item.link) || /x\.com|twitter\.com|youtube\.com|youtu\.be/i.test(item.link)) return;
  try {
    const html = await fetchText(item.link, 10000);
    const metaCandidates = metaMediaCandidates(html, item.link);
    const imageCandidates = metaCandidates.filter((candidate) => isImageCandidate(candidate));
    const videoCandidates = metaCandidates.filter((candidate) => isVideoCandidate(candidate));
    item.imageCandidates = uniqueCandidates([...(item.imageCandidates || []), ...imageCandidates]);
    item.videoCandidates = uniqueCandidates([...(item.videoCandidates || []), ...videoCandidates]);
  } catch {
    // 页面元信息抓取失败时保留 RSS 内的媒体候选。
  }
}

async function chooseBestMedia(sections) {
  const selectedItems = sections.flatMap((section) => section.items);
  await runWithConcurrency(selectedItems, 4, enrichPageMediaCandidates);

  const imageCandidates = [...new Map(
    selectedItems
      .flatMap((item) => (item.imageCandidates?.length ? item.imageCandidates : item.image ? [{ url: item.image, source: "fallback" }] : []))
      .filter((candidate) => candidate.url)
      .map((candidate) => [candidate.url, candidate])
  ).values()];
  const imageDetails = new Map();

  await runWithConcurrency(imageCandidates, 5, async (candidate) => {
    if (isLikelyAvatarImage(candidate.url)) {
      imageDetails.set(candidate.url, null);
      return;
    }
    try {
      const size = candidate.width && candidate.height
        ? { width: candidate.width, height: candidate.height }
        : await (async () => {
          const { bytes, contentType } = await fetchBinary(candidate.url);
          return parseImageSize(bytes, contentType);
        })();
      imageDetails.set(candidate.url, size);
    } catch {
      imageDetails.set(candidate.url, null);
    }
  });

  for (const section of sections) {
    for (const item of section.items) {
      const candidates = item.imageCandidates?.length ? item.imageCandidates : item.image ? [{ url: item.image, source: "fallback" }] : [];
      const best = candidates
        .map((candidate) => ({
          candidate,
          score: imageCandidateScore(candidate, imageDetails.get(candidate.url))
        }))
        .sort((a, b) => b.score - a.score)[0];
      item.image = best && best.score > -Infinity ? best.candidate.url : "";
      item.video = item.videoCandidates?.find((candidate) => candidate.url)?.url || item.video || "";
      delete item.imageCandidates;
      delete item.videoCandidates;
    }
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
    imageCandidates: item.imageCandidates || [],
    video: item.video || "",
    videoCandidates: item.videoCandidates || [],
    summary: summarize(item),
    summaryZh: item.summaryZh || summaryZh(item),
    whyItMatters: item.whyItMatters || whyItMatters(item),
    tags: inferTags(item),
    score: scoreItem(item)
  };
}

function normalizedSection(item) {
  if (isOpenSourceItem(item)) return "open_source_top";
  if (isStrongPracticeCase(item)) return "practice_cases";
  if (item.section === "product_updates") return isProductUpdate(item) ? "product_updates" : "social_shares";
  if (isPracticeCase(item)) return "practice_cases";
  return item.section;
}

function isStrongPracticeCase(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return /shopify|mahindra|uber uses|parloa|case study|customer story|customers want|deployed .* ai|ai voice agents powered by|real-world deployment|真实客户|客户案例/.test(text);
}

function isPracticeCase(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return /customer story|case study|enterprise adoption|production traces|a\/b testing|ship with confidence|real-world deployment|真实业务|客户案例|落地案例/.test(text);
}

function isOpenSourceItem(item) {
  const text = `${item.title} ${item.description} ${item.source}`.toLowerCase();
  if (item.channel === "open_source_rank" || item.source === "GitHub Trending Daily") return true;
  if (/datawhale/i.test(item.source) && /开源项目|开源了|github 热榜|星标|deepseek-tui|deepseek 版 claude code/.test(text)) return true;
  if (/qdrant|milvus|weaviate|ollama|hellogithub|逛逛github|开源服务指南/i.test(item.source)) return true;
  if (item.source === "The GitHub Blog" && /agentic workflow|agent pull requests|copilot|token efficiency/i.test(text)) return true;
  return false;
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

  if (sectionId === "practice_cases") return true;

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

  await chooseBestMedia(sections);

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
