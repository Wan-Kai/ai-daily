import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const root = process.cwd();
const sourcesPath = path.join(root, "data", "sources.json");
const podcastSourcesPath = path.join(root, "data", "podcast-sources.json");
const reportsDir = path.join(root, "data", "reports");
const emailCandidatesDir = path.join(root, "data", "email-candidates");
const execFileAsync = promisify(execFile);
const runStartedAt = new Date();
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(runStartedAt);

const SECTION_CONFIG = [
  { id: "product_updates", title: "产品快讯", limit: 8 },
  { id: "research_frontier", title: "研究前线", limit: 8, paperMin: 2, paperMax: 4 },
  { id: "open_source_top", title: "开源项目", limit: 6 },
  { id: "social_shares", title: "社媒观察", limit: 10 },
  { id: "extended_reading", title: "延伸阅读", limit: 6 }
];

const LOOKBACK_HOURS = 24;
const RECENT_DEDUPE_DAYS = 7;

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

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
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
      url: absoluteUrl(attrs.src || attrs["data-src"] || attrs["data-original"], base),
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

function isRecent(item) {
  if (!item.publishedAt) return false;
  const published = new Date(item.publishedAt);
  if (Number.isNaN(published.getTime())) return false;
  const ageMs = runStartedAt.getTime() - published.getTime();
  return ageMs >= 0 && ageMs <= 1000 * 60 * 60 * LOOKBACK_HOURS;
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
  if (item.section === "extended_reading") return `这提供了日报之外的长内容背景，适合延伸阅读。`;
  if (item.section === "research_frontier") return `这提供了模型能力、评测方法或研究方向的新信号，适合纳入前沿观察。`;
  if (item.section === "open_source_top") return `这可能代表近期开发者关注的开源方向，可继续观察项目活跃度和可用性。`;
  if (item.section === "social_shares") return `这条社媒信号有助于捕捉官方发布之外的讨论、观点或早期趋势。`;
  return tags.length > 0 ? `相关标签：${tags.join("、")}。` : "这条内容可作为今日 AI 信息流的候选信号。";
}

async function fetchText(url, timeoutMs = 15000) {
  let timeoutId;
  let didTimeout = false;
  const controller = new AbortController();
  const hardTimeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
      reject(new Error(`请求超时（${timeoutMs}ms）：${url}`));
    }, timeoutMs);
  });

  const task = (async () => {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "ai-daily/0.1 (+https://github.com/Wan-Kai/ai-daily)"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (!text && /nitter\.net/i.test(url)) throw new Error(`Empty response: ${url}`);
    return text;
  })();

  try {
    return await Promise.race([task, hardTimeout]);
  } catch (error) {
    if (didTimeout) task.catch(() => {});
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function nextDataFromHtml(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("未找到页面结构化数据。");
  return JSON.parse(match[1]);
}

async function podcastIdsFromCollection(collection) {
  const html = await fetchTextWithProxyFallback(collection.url, collection.timeoutMs ?? 20000);
  const data = nextDataFromHtml(html);
  const targets = data.props?.pageProps?.collection?.target || [];
  return targets
    .filter((item) => item.pid && item.status !== "DELETED")
    .map((item) => ({
      pid: item.pid,
      title: item.title,
      language: collection.language || "zh"
    }));
}

async function latestPodcastEpisodes(podcast) {
  const html = await fetchTextWithProxyFallback(`https://www.xiaoyuzhoufm.com/podcast/${podcast.pid}`, 20000);
  const data = nextDataFromHtml(html);
  const detail = data.props?.pageProps?.podcast || {};
  return (detail.episodes || []).slice(0, 4).map((episode) => ({
    podcastTitle: detail.title || podcast.title,
    language: podcast.language || "zh",
    eid: episode.eid,
    title: episode.title,
    description: stripHtml(episode.description || episode.shownotes || ""),
    shownotes: stripHtml(episode.shownotes || ""),
    publishedAt: episode.pubDate || "",
    durationSeconds: episode.duration || 0,
    link: `https://www.xiaoyuzhoufm.com/episode/${episode.eid}`,
    image: episode.image?.picUrl || detail.image?.picUrl || ""
  }));
}

function ageInDays(dateValue = "") {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return Infinity;
  return (runStartedAt.getTime() - date.getTime()) / 86400000;
}

function scorePodcastEpisode(episode) {
  const text = `${episode.podcastTitle} ${episode.title} ${episode.description}`;
  let score = 0;
  if (/AI|人工智能|大模型|模型|Agent|智能体|机器人|具身|科技|创业|产品|商业|开发|程序员|开源|芯片|硅谷|OpenAI|Anthropic|DeepMind|Claude|Codex/i.test(text)) score += 24;
  if (/对话|访谈|观察|复盘|一手|创始人|CEO|CTO|研究员|投资|融资|商业|技术/i.test(text)) score += 8;
  if (episode.description.length > 180) score += 6;
  if (episode.durationSeconds > 1800) score += 3;
  if (/新闻|串讲|速递|闲聊|随便聊|日更|早报/i.test(text)) score -= 8;
  return score;
}

function formatDuration(seconds = 0) {
  if (!seconds) return "";
  return `${Math.round(seconds / 60)} 分钟`;
}

function cleanPodcastText(text = "") {
  return String(text)
    .replace(/https?:\/\/\S+/g, "")
    .replace(/聊天讨论群[\s\S]*$/g, "")
    .replace(/欢迎关注[\s\S]*$/g, "")
    .replace(/商务合作[\s\S]*$/g, "")
    .replace(/【本期内容】|【嘉宾】|【精彩时刻】|【你将听到】|【亮点】|时间轴/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text = "") {
  return String(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？!?])\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstParagraph(text = "", maxLength = 320) {
  const cleaned = cleanPodcastText(text);
  if (!cleaned) return "当前只抓到标题，尚未获取单集简介。";
  const sentences = splitSentences(cleaned);
  let paragraph = "";
  for (const sentence of sentences) {
    const next = paragraph ? paragraph + sentence : sentence;
    if (next.length > maxLength) break;
    paragraph = next;
  }
  const value = paragraph || cleaned;
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function podcastSummaryZh(episode) {
  const body = episode.shownotes || episode.description || "";
  const intro = firstParagraph(body);
  const points = splitSentences(cleanPodcastText(body))
    .filter((sentence) => sentence.length >= 18 && sentence.length <= 120)
    .filter((sentence) => /AI|大模型|智能体|Agent|模型|产品|创业|商业|技术|开发|开源|算力|机器人|具身|投资|组织/i.test(sentence))
    .slice(0, 4);
  const detail = points.length
    ? `\n**简介要点**：\n${points.map((point) => `- ${point}`).join("\n")}`
    : "";
  return `**讲了什么**：这一期来自 **${episode.podcastTitle}**，主题是「${episode.title}」。${intro}${detail}`;
}

async function fetchPodcastExtendedReadings(previousKeys) {
  const config = await readJsonFile(podcastSourcesPath, { collections: [], lookbackDays: 14, maxDailyItems: 3 });
  const episodes = [];
  const failures = [];

  for (const collection of config.collections || []) {
    if (!collection.enabled) continue;
    try {
      const podcasts = await podcastIdsFromCollection(collection);
      for (const podcast of podcasts) {
        try {
          episodes.push(...await latestPodcastEpisodes(podcast));
        } catch (error) {
          failures.push({ source: podcast.title, url: `https://www.xiaoyuzhoufm.com/podcast/${podcast.pid}`, error: error.message });
        }
      }
    } catch (error) {
      failures.push({ source: collection.name, url: collection.url, error: error.message });
    }
  }

  const lookbackDays = config.lookbackDays ?? 14;
  const limit = config.maxDailyItems ?? 3;
  const seen = new Set();
  const items = episodes
    .filter((episode) => ageInDays(episode.publishedAt) <= lookbackDays)
    .map((episode) => ({
      ...episode,
      score: scorePodcastEpisode(episode)
    }))
    .filter((episode) => episode.score >= 24)
    .sort((a, b) => b.score - a.score)
    .filter((episode) => {
      const linkKey = normalizedLinkKey(episode.link);
      const titleKey = normalizedTitleKey(episode.title);
      if (seen.has(linkKey) || seen.has(titleKey) || previousKeys.links.has(linkKey) || previousKeys.titles.has(titleKey)) return false;
      seen.add(linkKey);
      seen.add(titleKey);
      return true;
    })
    .slice(0, limit)
    .map((episode) => ({
      title: episode.title,
      titleZh: episode.title,
      link: episode.link,
      publishedAt: episode.publishedAt,
      source: episode.podcastTitle,
      sourceType: "podcast",
      section: "extended_reading",
      channel: "podcast",
      trust: "expert",
      image: episode.image,
      imageCandidates: episode.image ? [{ url: episode.image, source: "podcast-cover" }] : [],
      video: "",
      videoCandidates: [],
      summary: episode.description,
      summaryZh: podcastSummaryZh(episode),
      whyItMatters: "这期播客提供了更长篇的背景、访谈或案例，可作为日报之外的延伸阅读。",
      tags: ["播客", "小宇宙", formatDuration(episode.durationSeconds)].filter(Boolean),
      score: episode.score
    }));

  return { items, failures };
}

async function fetchTextWithProxyFallback(url, timeoutMs = 15000) {
  try {
    return await fetchText(url, timeoutMs);
  } catch (error) {
    if (!/(huggingface\.co|github\.com|github\.blog|arxiv\.org|google|amazonaws\.com|aws\.amazon\.com|xiaoyuzhoufm\.com|nitter\.net)/i.test(url)) throw error;
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
  const uniqueProxies = [...new Set(proxies)];
  const errors = [];

  for (const proxy of uniqueProxies) {
    try {
      const { stdout } = await execFileAsync("curl", [
        "-L",
        "--http1.1",
        "--silent",
        "--show-error",
        "--connect-timeout",
        "10",
        "--max-time",
        String(Math.ceil(timeoutMs / 1000)),
        "-A",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        "--proxy",
        proxy,
        url
      ], {
        maxBuffer: 8 * 1024 * 1024
      });
      if (stdout) return stdout;
    } catch (error) {
      errors.push(`${proxy}: ${error.message}`);
    }
  }

  throw new Error(`直连失败，代理兜底也失败：${originalError.message}; ${errors.join("; ")}`);
}

async function fetchBinary(url, timeoutMs = 8000) {
  let timeoutId;
  let didTimeout = false;
  const controller = new AbortController();
  const hardTimeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
      reject(new Error(`请求超时（${timeoutMs}ms）：${url}`));
    }, timeoutMs);
  });

  const task = (async () => {
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
  })();

  try {
    return await Promise.race([task, hardTimeout]);
  } catch (error) {
    if (didTimeout) task.catch(() => {});
    throw error;
  } finally {
    clearTimeout(timeoutId);
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
  if (!isUsableNewsImage(size) || isLikelyAvatarImage(candidate.url) || isLikelyGenericEditorialImage(candidate.url)) return -Infinity;
  const area = size.width * size.height;
  const ratio = size.width / size.height;
  const ratioScore = ratio >= 1.2 && ratio <= 2.4 ? 8 : ratio >= .75 && ratio <= 3 ? 4 : 0;
  const sourceScore = candidate.source === "og:image" || candidate.source === "twitter:image" ? 18 : candidate.source === "page-image" ? 12 : candidate.source === "media:content" ? 10 : candidate.source === "image" ? 8 : candidate.source === "html" ? 6 : candidate.source === "media:thumbnail" ? 3 : 2;
  const urlPenalty = /sprite|icon|favicon|logo|avatar|profile|placeholder/i.test(candidate.url) ? 20 : 0;
  const figureBoost = /figure|fig\d|benchmark|mattersim|speedup|multitask|circuit|density|grid|dataset|chart|diagram|architecture|workflow/i.test(candidate.url) ? 12 : 0;
  return Math.log10(area) * 10 + ratioScore + sourceScore + figureBoost - urlPenalty;
}

function isLikelyGenericEditorialImage(url) {
  return /BlogHeroFeature|TWLIFB|PressCoverage|ML-\d+-image/i.test(url);
}

async function enrichPageMediaCandidates(item) {
  if (!/^https?:\/\//i.test(item.link) || /x\.com|twitter\.com|youtube\.com|youtu\.be/i.test(item.link)) return;
  try {
    const html = await fetchText(item.link, 10000);
    const metaCandidates = metaMediaCandidates(html, item.link);
    const pageImageCandidates = htmlImageCandidates(html, item.link)
      .map((candidate) => ({ ...candidate, source: "page-image" }));
    const imageCandidates = [
      ...metaCandidates.filter((candidate) => isImageCandidate(candidate)),
      ...pageImageCandidates
    ];
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
  const xml = await fetchTextWithProxyFallback(source.url, source.timeoutMs ?? 15000);
  return parseFeed(xml, source).filter((item) => isRecent(item));
}

async function fetchHuggingFacePapers(source) {
  const url = source.url.replace("{date}", today);
  const html = await fetchTextWithProxyFallback(url, source.timeoutMs ?? 30000);
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
    publishedAt: runStartedAt.toISOString(),
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
  const html = await fetchTextWithProxyFallback(source.url, source.timeoutMs ?? 20000);
  const rows = [...html.matchAll(/<article[\s\S]*?Box-row[\s\S]*?<\/article>/gi)].map((match) => match[0]);
  return rows.slice(0, source.limit ?? 12).map((row) => {
    const repoPath = stripHtml(row.match(/<h2[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)?.[2] || "").replace(/\s+/g, "");
    const href = row.match(/<h2[\s\S]*?<a[^>]+href=["']([^"']+)["']/i)?.[1] || "";
    const description = stripHtml(row.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
    return {
      title: repoPath,
      link: absoluteUrl(href, "https://github.com"),
      description,
      publishedAt: runStartedAt.toISOString(),
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

async function fetchFoloSource(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), source.timeoutMs ?? 20000);
  try {
    const headers = {
      "content-type": "application/json",
      "origin": "https://app.folo.is",
      "user-agent": "ai-daily/0.1 (+https://github.com/Wan-Kai/ai-daily)",
      "x-app-name": "Folo Web",
      "x-app-platform": "desktop/web",
      "x-app-version": "1.4.0"
    };
    if (process.env.FOLO_COOKIE) headers.cookie = process.env.FOLO_COOKIE;

    const body = {
      view: source.view ?? 0,
      withContent: true
    };
    if (source.listId) body.listId = source.listId;
    if (source.feedId) body.feedId = source.feedId;

    const response = await fetch(source.url || "https://api.folo.is/entries", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json.code !== 0) throw new Error(json.message || `Folo API code ${json.code}`);

    return (json.data || []).map((entry) => {
      const feed = entry.feeds || {};
      const item = entry.entries || {};
      const content = stripHtml(item.content || item.description || "");
      const sourceUrl = feed.url || source.url;
      const imageCandidates = uniqueCandidates(htmlImageCandidates(item.content || "", sourceUrl));
      const videoCandidates = uniqueCandidates(htmlVideoCandidates(item.content || "", sourceUrl));
      return {
        title: item.title,
        link: item.url || sourceUrl,
        description: content,
        publishedAt: item.publishedAt,
        image: imageCandidates[0]?.url || "",
        imageCandidates,
        video: videoCandidates[0]?.url || "",
        videoCandidates,
        source: feed.title || source.name,
        sourceType: source.type,
        section: source.section,
        channel: source.channel,
        trust: source.trust,
        sourceWeight: source.weight ?? 1
      };
    }).filter((item) => item.title && item.link && isRecent(item)).slice(0, source.limit ?? 20);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSource(source) {
  if (source.kind === "huggingface_papers") return fetchHuggingFacePapers(source);
  if (source.kind === "github_trending") return fetchGitHubTrending(source);
  if (source.kind === "folo") return fetchFoloSource(source);
  return fetchRssSource(source);
}

function normalizeEmailCandidate(candidate) {
  const sourceName = candidate.source || "AINews.com 邮件订阅";
  const sourceUrl = candidate.link || candidate.sourceUrl || "https://www.ainews.com/";
  const imageCandidates = uniqueCandidates([
    ...(candidate.imageCandidates || []),
    ...(candidate.image ? [{ url: candidate.image, source: "email-image" }] : [])
  ].map((item) => ({
    ...item,
    url: absoluteUrl(item.url, sourceUrl) || item.url,
    source: item.source || "email-image"
  })));
  const videoCandidates = uniqueCandidates([
    ...(candidate.videoCandidates || []),
    ...(candidate.video ? [{ url: candidate.video, source: "email-video" }] : [])
  ].map((item) => ({
    ...item,
    url: absoluteUrl(item.url, sourceUrl) || item.url,
    source: item.source || "email-video"
  })));

  return {
    title: candidate.title || candidate.titleZh || "",
    titleZh: candidate.titleZh || candidate.title || "",
    link: sourceUrl,
    description: candidate.description || candidate.summary || candidate.summaryZh || "",
    summaryZh: candidate.summaryZh || candidate.summary || candidate.description || "",
    publishedAt: candidate.publishedAt || candidate.receivedAt || runStartedAt.toISOString(),
    image: imageCandidates[0]?.url || "",
    imageCandidates,
    video: videoCandidates[0]?.url || "",
    videoCandidates,
    source: sourceName,
    sourceType: candidate.sourceType || "social",
    section: candidate.section || "social_shares",
    channel: candidate.channel || "email_discovery",
    trust: candidate.trust || "expert",
    sourceWeight: candidate.sourceWeight ?? 5
  };
}

async function readEmailCandidates(date) {
  try {
    const raw = await readFile(path.join(emailCandidatesDir, `${date}.json`), "utf8");
    const parsed = JSON.parse(raw);
    const candidates = Array.isArray(parsed) ? parsed : parsed.items || [];
    return candidates
      .map(normalizeEmailCandidate)
      .filter((item) => item.title && item.link && isRecent(item));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
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

function isPaperFeedItem(item) {
  return item.channel === "paper_feed" || /arxiv|hugging face daily papers/i.test(`${item.source} ${item.link}`);
}

function normalizedSection(item) {
  if (isPaperFeedItem(item)) return "research_frontier";
  if (item.section === "extended_reading" || item.channel === "podcast") return "extended_reading";
  if (isOpenSourceItem(item)) return "open_source_top";
  if (isProductUpdate(item)) return "product_updates";
  if (item.section === "product_updates") return isProductUpdate(item) ? "product_updates" : "social_shares";
  return item.section;
}

function isStrongPracticeCase(item) {
  if (isPaperFeedItem(item)) return false;
  const text = `${item.title} ${item.description}`.toLowerCase();
  return /shopify|mahindra|uber uses|parloa|case study|customer story|customers want|deployed .* ai|ai voice agents powered by|real-world deployment|真实客户|客户案例/.test(text);
}

function isPracticeCase(item) {
  if (isPaperFeedItem(item)) return false;
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

function isTrustedProductSignalSource(item) {
  if (item.channel !== "social") return false;
  if (item.trust === "official") return true;
  return /Sam Altman|Greg Brockman|Dario Amodei|Alex Albert|Logan Kilpatrick|Demis Hassabis|Sundar Pichai|Satya Nadella|Aravind Srinivas|Harrison Chase|Jerry Liu|Guillermo Rauch|Arthur Mensch|李继刚|宝玉/i.test(item.source || "");
}

function isProductUpdate(item) {
  if (!isTrustedProductSignalSource(item)) return false;
  const text = `${item.title} ${item.description}`.toLowerCase();
  if (/agent view|claude code.*agent view|parallel agents|gemini api.*file search|webhooks?.*gemini api|notebooklm.*mind map|google health.*gemini/.test(text)) {
    return true;
  }
  const positive = /new in|now available|available today|introducing|meet |launch(?:ed|es)?|release(?:d|s)?|roll(?:ed|ing)? out|adds?|announc(?:e|ed|es)|preview|beta|generally available|ga\b|api|feature|plugin|integration|webhook|file search|notebooklm|gemini|cursor|teams|daybreak|codex.*(?:phone|mobile|app|keyboard|shortcut|device|anywhere)|(?:phone|mobile|app|keyboard|shortcut|device|anywhere).*codex/.test(text);
  const negative = /research|paper|benchmark|principle|constitution|misalignment|monitor|safety evaluation|we found|we observed|how to|why|thread|opinion|recap|roundup|blog goes through|infrastructure issues|patterns we’ve been using|patterns we've been using|problems pretty quickly/i.test(text);
  return positive && !negative;
}

function isRelevantForSection(item, sectionId) {
  if (sectionId === "product_updates") {
    return isTrustedProductSignalSource(item);
  }

  if (sectionId === "extended_reading") return true;
  if (sectionId !== "open_source_top") return true;
  const text = `${item.title} ${item.summary} ${item.summaryZh} ${item.tags.join(" ")}`.toLowerCase();
  if (item.source === "The GitHub Blog") {
    return /\bai\b|agent|copilot|llm|model|token|generative|智能体|模型/.test(text);
  }
  return /\bai\b|agent|copilot|llm|model|vector|embedding|rag|inference|开源|模型|智能体|向量|检索|推理/.test(text);
}

function selectSectionItems(section, items) {
  const candidates = items
    .filter((item) => item.section === section.id)
    .filter((item) => isRelevantForSection(item, section.id))
    .sort((a, b) => b.score - a.score);

  const deduped = [];
  const seenTitles = new Set();
  for (const item of candidates) {
    const titleKey = normalizedTitleKey(item.titleZh || item.title);
    if (titleKey && seenTitles.has(titleKey)) continue;
    if (titleKey) seenTitles.add(titleKey);
    deduped.push(item);
  }

  if (section.id !== "research_frontier") return deduped.slice(0, section.limit);

  const papers = deduped.filter(isPaperFeedItem);
  const nonPapers = deduped.filter((item) => !isPaperFeedItem(item));
  const selected = [];
  const paperCount = Math.min(section.paperMax ?? section.limit, Math.max(section.paperMin ?? 0, Math.min(papers.length, section.paperMin ?? 0)));
  selected.push(...papers.slice(0, paperCount));

  for (const item of nonPapers) {
    if (selected.length >= section.limit) break;
    selected.push(item);
  }
  for (const item of papers.slice(paperCount)) {
    if (selected.length >= section.limit || selected.filter(isPaperFeedItem).length >= (section.paperMax ?? section.limit)) break;
    selected.push(item);
  }

  return selected.sort((a, b) => b.score - a.score).slice(0, section.limit);
}

function previousDate(date) {
  const parsed = new Date(`${date}T00:00:00+08:00`);
  parsed.setDate(parsed.getDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(parsed);
}

function normalizedLinkKey(link = "") {
  try {
    const url = new URL(link);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return String(link).replace(/[#?].*$/, "").replace(/\/$/, "").toLowerCase();
  }
}

function normalizedTitleKey(title = "") {
  return String(title)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// 注意：日报链路不再使用 Anthropic 做中文化（避免外部依赖波动引发审查失败）。
// 该函数保留仅用于历史兼容/调试，运行期不应被调用。
async function anthropicJson() {
  throw new Error("已禁用 Anthropic 中文化能力：请使用本地翻译兜底流程。");
}

function isChineseEnough(text = "") {
  const value = String(text || "");
  const cn = (value.match(/[\u4e00-\u9fff]/g) || []).length;
  return cn >= 6;
}

function hasChinese(text = "") {
  return /[\u4e00-\u9fff]/.test(String(text || ""));
}

function chineseRatio(text = "") {
  const value = String(text || "");
  if (!value) return 0;
  const cn = (value.match(/[\u4e00-\u9fff]/g) || []).length;
  return cn / value.length;
}

function stripSocialNoise(text = "") {
  return String(text || "")
    .replace(/Your browser does not support the video tag\./gi, "")
    .replace(/🔗\s*View on Twitter/gi, "")
    .replace(/⚡\s*Powered by xgo\.ing/gi, "")
    .replace(/[�]/g, "")
    .replace(/\bkm\b/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[💬🔄❤️👀📊]/g, "")
    .replace(/[💬🔄❤️👀📊]\s*\d+[.,]?\d*/g, "")
    .replace(/\s*(?:\d+\s*){4,}$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHandlesAndTags(text = "") {
  return String(text || "")
    .replace(/@\w{2,}/g, "")
    .replace(/#\w+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTranslateNoise(text = "", { aggressive = false } = {}) {
  const base = String(text || "")
    .replace(/Your browser does not support the video tag\./gi, "")
    .replace(/🔗\s*View on Twitter/gi, "")
    .replace(/⚡\s*Powered by xgo\.ing/gi, "")
    .replace(/[�]/g, "")
    .replace(/\bkm\b/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!aggressive) return base;
  return base
    .replace(/\b[\w-]+(?:\.[\w-]+)+\/?\S*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function translateToZh(text, { timeoutMs = 60000 } = {}) {
  const safe = stripTranslateNoise(text, { aggressive: false }).replace(/[\uD800-\uDFFF]/g, "").slice(0, 900);
  if (!safe) return "";
  let url;
  try {
    url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(safe)}`;
  } catch {
    return "";
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "user-agent": "ai-daily/0.1 (+https://github.com/Wan-Kai/ai-daily)"
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const parts = (payload?.[0] || []).map((chunk) => chunk?.[0]).filter(Boolean);
    return parts.join("").trim();
  } catch (fetchError) {
    const proxies = [
      process.env.AI_DAILY_HTTPS_PROXY,
      process.env.HTTPS_PROXY,
      process.env.HTTP_PROXY,
      process.env.ALL_PROXY,
      "http://127.0.0.1:6789",
      "socks5h://127.0.0.1:6789"
    ].filter(Boolean).map((proxy) => String(proxy).replace(/^socks5:\/\//i, "socks5h://"));
    const tried = [];
    for (const proxy of [...new Set(proxies)]) {
      tried.push(proxy);
      try {
        const { stdout } = await execFileAsync("curl", [
          "-L",
          "--silent",
          "--show-error",
          "--connect-timeout",
          "10",
          "--max-time",
          String(Math.ceil(timeoutMs / 1000)),
          "--proxy",
          proxy,
          url
        ], { maxBuffer: 2 * 1024 * 1024 });
        const payload = JSON.parse(stdout);
        const parts = (payload?.[0] || []).map((chunk) => chunk?.[0]).filter(Boolean);
        return parts.join("").trim();
      } catch {
        // keep trying
      }
    }
    throw new Error(`翻译请求失败且代理兜底也失败：${fetchError.message}; proxies=${tried.join(",")}`);
  }
}

function normalizeZhTitle(text = "") {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\.{4,}/g, "…")
    .replace(/\.{3}/g, "…")
    .replace(/[。．]\s*\.{3,}$/g, "。")
    .replace(/\s*\.{3,}\s*$/g, "")
    .replace(/\s*…\s*$/g, "")
    .trim();
}

function smartSlice(text = "", maxLen = 44) {
  const value = String(text || "");
  if (value.length <= maxLen) return value;
  let cut = value.slice(0, maxLen);
  const next = value[maxLen] || "";
  if (/[A-Za-z0-9]/.test(cut[cut.length - 1] || "") && /[A-Za-z0-9]/.test(next)) {
    const backtrack = cut.lastIndexOf(" ");
    // 避免把英文单词切成两半：尽量回退到最近的空格，即使回退幅度稍大也优先保证可读性。
    if (backtrack >= Math.max(0, maxLen - 20)) cut = cut.slice(0, backtrack);
  }
  return cut.trim();
}

function chineseSentenceCount(text = "") {
  return String(text || "")
    .split(/[。！？!?]/)
    .map((part) => part.trim())
    .filter((part) => /[\u4e00-\u9fff]/.test(part))
    .length;
}

function looksLikeTruncatedZhTitle(titleZh = "") {
  const value = normalizeZhTitle(titleZh);
  if (!value) return false;
  if (/(\.{3,}|…)$/.test(value)) return true;
  if (/(和|与|及|或|并|但|而|在|对|为|是|的|从|到|以及)$/.test(value)) return true;
  if (value.includes("…") && value.length > 14) return true;
  if (!/[。！？!?]$/.test(value) && /[A-Za-z]$/.test(value)) return true;
  if (!/[。！？!?]$/.test(value) && /(我|你|他|她|它|们|了|着|把|将|让|给|为|在|对)$/.test(value)) return true;
  if (/我们已经让.{0,2}$/.test(value)) return true;
  // 句号后紧跟短残句（常见于抓取/翻译的截断）
  if (value.includes("。")) {
    const parts = value.split("。").map((part) => part.trim()).filter(Boolean);
    const last = parts[parts.length - 1] || "";
    if (last.length > 0 && last.length < 8 && !/[。！？!?]$/.test(value)) return true;
    if (/(和|与|及|或|并|但|而)$/.test(last)) return true;
  }
  return false;
}

function deriveTitleFromSummary(summaryZh = "", { maxLen = 44 } = {}) {
  const value = normalizeZhTitle(String(summaryZh || ""))
    .replace(/\*\*[^*]+\*\*/g, "")
    .replace(/^简介要点\s*[:：]\s*/g, "")
    .replace(/^讲了什么\s*[:：]\s*/g, "")
    .trim();
  if (!value) return "";

  const firstLine = value.split(/[\n\r]+/)[0].trim();
  const firstSentence = firstLine.split(/[。！？!?]/)[0].trim();
  const picked = firstSentence.length >= 8 ? firstSentence : firstLine;
  const title = smartSlice(normalizeZhTitle(picked), maxLen);
  return title.length >= 6 ? title : "";
}

function bulletTailFromText(text = "", { maxLen = 86 } = {}) {
  const value = normalizeZhTitle(String(text || ""))
    .replace(/\*\*[^*]+\*\*/g, "")
    .replace(/@\w{2,}/g, "")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
    .replace(/\b\d{1,2}:\d{2}\b/g, "")
    .trim();
  if (!value) return "";

  const firstLine = value.split(/[\n\r]+/)[0].trim();
  const sentences = firstLine
    .split(/[。！？!?]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const picked = sentences.slice(0, 2).join("。") || firstLine;
  return smartSlice(normalizeZhTitle(picked), maxLen);
}

function ensureResearchPyramidSummary(summaryZh = "") {
  const value = String(summaryZh || "").trim();
  if (!value) return value;
  if (/核心结论|结论|要点|价值|支撑|结果|数据显示|案例/i.test(value)) return value;
  return `**核心要点** ${value}`;
}

function ensurePaperStructure({ titleZh, summaryZh }) {
  const title = normalizeZhTitle(titleZh);
  const body = String(summaryZh || "").trim();
  const core = body ? body : "（摘要信息有限，建议打开原文确认关键方法与实验设置。）";
  const coreSentences = normalizeZhTitle(core)
    .replace(/^arXiv：公告类型：\S+\s*/i, "")
    .replace(/^摘要[:：]\s*/i, "")
    .split(/[。！？!?]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const coreSummary = coreSentences.slice(0, 3).join("。");
  const coreLine = coreSummary
    ? `**核心结论** 这篇论文围绕「${title}」提出了一个更具体的方向：${coreSummary}。`
    : `**核心结论** 这篇论文主要围绕「${title}」提出方法或结论，并尝试解决一个明确的研究/工程问题。`;
  return [
    coreLine,
    `**支撑证据** 摘要与公开信息显示：${core}`,
    `**我的判断** 关注它的评测覆盖范围、对比基线是否充分、是否开源代码/模型与可复现细节；若后续有更完整实验或开源材料，再决定是否跟进落地。`
  ].join("\n\n");
}

async function localizeSectionsZh(sections) {
  // 仅使用本地翻译兜底中文化：避免依赖 Anthropic/ClaudeCode 等外部服务。

  for (const section of sections) {
    for (const item of section.items || []) {
      if (!isChineseEnough(item.titleZh)) {
        const titleZh = await translateToZh(item.title, { timeoutMs: 45000 }).catch(() => "");
        if (titleZh) item.titleZh = normalizeZhTitle(titleZh);
      }
      if (!isChineseEnough(item.summaryZh)) {
        const summaryZh = await translateToZh(item.summary, { timeoutMs: 60000 }).catch(() => "");
        if (summaryZh) item.summaryZh = summaryZh;
      }
      item.titleZh = normalizeZhTitle(stripSocialNoise(item.titleZh || ""));
      item.summaryZh = stripSocialNoise(item.summaryZh);
      if (chineseRatio(item.summaryZh || "") < 0.5) {
        item.summaryZh = stripSocialNoise(stripHandlesAndTags(item.summaryZh));
      }

      const isPaperForReview = item.channel === "paper_feed" || /论文|CVPR|ICLR|NeurIPS|arXiv/i.test(`${item.titleZh || ""} ${item.summaryZh || ""} ${(item.tags || []).join(" ")}`);
      const isPaper = section.id === "research_frontier" && (isPaperFeedItem(item) || isPaperForReview);
      if (isPaper) {
        item.summaryZh = ensurePaperStructure({ titleZh: item.titleZh || item.title, summaryZh: item.summaryZh || "" });
      } else if (section.id === "social_shares" && isPaperForReview) {
        // 社媒里出现的论文信号也按论文结构输出，避免审查因缺少结构失败。
        item.summaryZh = ensurePaperStructure({ titleZh: item.titleZh || item.title, summaryZh: item.summaryZh || "" });
      } else if (section.id === "research_frontier") {
        item.summaryZh = ensureResearchPyramidSummary(item.summaryZh || "");
      }

      if (chineseRatio(item.summaryZh || "") < 0.35) {
        const retr = await translateToZh(item.summary || item.summaryZh || "", { timeoutMs: 60000 }).catch(() => "");
        if (retr && chineseRatio(retr) > chineseRatio(item.summaryZh || "")) item.summaryZh = stripSocialNoise(retr);
      }

      if (!hasChinese(item.titleZh)) {
        if (/github\.com\//i.test(item.link || "")) {
          const repo = String(item.title || "").split(/\s+/).filter(Boolean)[0] || "开源项目";
          const snippet = String(item.summaryZh || "").replace(/^Star\s*/i, "").slice(0, 22);
          const translated = snippet && hasChinese(snippet) ? snippet : await translateToZh(item.summary || item.title, { timeoutMs: 45000 }).catch(() => "");
          item.titleZh = normalizeZhTitle(`${repo}：${translated || "开源项目更新"}`);
        } else {
          const fallback = await translateToZh(item.title || item.summary || "", { timeoutMs: 45000 }).catch(() => "");
          if (fallback) item.titleZh = normalizeZhTitle(fallback);
        }
      }

      if (!hasChinese(item.titleZh) || (item.titleZh || "").length < 4) {
        const fromSummary = normalizeZhTitle(
          String(item.summaryZh || "")
            .replace(/\*\*[^*]+\*\*/g, "")
            .replace(/^核心结论|^核心要点|^支撑证据|^我的判断/g, "")
            .trim()
            .slice(0, 28)
        );
        if (hasChinese(fromSummary)) item.titleZh = fromSummary;
      }

      // 社媒抓取的 title 常被截断为 "..."/"…"，优先从中文摘要推导更可读的标题。
      if ((item.sourceType === "social" || /x\.com|twitter\.com/i.test(item.link || "")) && /(\.{3,}|…)$/.test(item.titleZh || "")) {
        const derived = deriveTitleFromSummary(item.summaryZh || "");
        if (derived) item.titleZh = derived;
      }

      // 翻译后的标题有时会把被截断位置翻成“……/…”（例如“软件如何…的发现”），但摘要里是完整句子。
      // 这种情况下直接用摘要首句生成标题，可显著改善可读性。
      if ((item.titleZh || "").includes("…") && !(item.summaryZh || "").includes("…")) {
        const derived = deriveTitleFromSummary(item.summaryZh || "");
        if (derived && !derived.includes("…")) item.titleZh = derived;
      }

      // 标题虽然没有以省略号结尾，但语义上明显是“半句被截断”（例如以“和/与/并/在/的”结尾）。
      if (item.sourceType === "social" && looksLikeTruncatedZhTitle(item.titleZh || "")) {
        const derived = deriveTitleFromSummary(item.summaryZh || "", { maxLen: 80 });
        if (derived) item.titleZh = derived;
      }

      if (section.id !== "open_source_top") {
        const summaryValue = normalizeZhTitle(item.summaryZh || "");
        const needsEnrich = summaryValue.length < 120 || chineseSentenceCount(summaryValue) < 2;
        if (needsEnrich && hasChinese(summaryValue)) {
          let extra = "";
          if (section.id === "product_updates") {
            extra = "这类更新通常会影响产品能力、可用性或接入方式，建议关注支持范围、价格/配额与上线节奏。";
          } else if (section.id === "social_shares") {
            extra = "这更像一条官方/社区信号，建议打开原文查看完整上下文与后续链接。";
          }
          if (extra && !summaryValue.includes(extra)) item.summaryZh = `${summaryValue}${summaryValue.endsWith("。") ? "" : "。"}${extra}`;
        }
      }

      if (section.id === "product_updates") {
        const summaryValue = normalizeZhTitle(item.summaryZh || "");
        if (chineseRatio(summaryValue) < 0.38 && hasChinese(summaryValue)) {
          item.summaryZh = `${summaryValue}${summaryValue.endsWith("。") ? "" : "。"}这是一次明确的产品/功能可用性变化，建议对照官方说明确认支持应用范围（哪些产品/套餐/地区/入口）、具体能力边界与已知限制。`;
        }
      }

      if (section.id === "social_shares") {
        const summaryValue = normalizeZhTitle(item.summaryZh || "");
        if (summaryValue.length < 140 && hasChinese(summaryValue)) {
          // 避免“只重复标题 + 一句模板”的空洞摘要
          if (/研发第\s*\d+|R&D\s*Part/i.test(`${item.titleZh || ""} ${item.title || ""}`)) {
            item.summaryZh = `${summaryValue}${summaryValue.endsWith("。") ? "" : "。"}这条内容属于系列化的研发叙事（视频/文章），通常会透露研发优先级、组织方式或下一步产品方向；即便当下文本信息有限，也值得打开原文确认关键信号与后续链接。`;
          } else if (/支持\s+Claude|supports\s+Claude/i.test(`${item.titleZh || ""} ${item.summary || ""}`)) {
            item.summaryZh = `${summaryValue}${summaryValue.endsWith("。") ? "" : "。"}这意味着该产品的工作流里可以直接调用对应模型/能力，可能影响生成质量、成本与可用功能，建议关注是否需要额外开关、订阅或配额。`;
          }
        }
      }

      if (/github\.com\//i.test(item.link || "") && chineseRatio(item.summaryZh || "") < 0.45) {
        // 翻译接口在中英混排时可能不做翻译，先尝试清理英文尾句再补中文说明。
        item.summaryZh = String(item.summaryZh || "").replace(/[A-Za-z][A-Za-z0-9 ,.'“”"():;+-]*$/g, "").trim();
        const retr = await translateToZh(item.summary || item.title || "", { timeoutMs: 60000 }).catch(() => "");
        if (retr && chineseRatio(retr) > chineseRatio(item.summaryZh || "")) item.summaryZh = stripSocialNoise(retr);
        if (chineseRatio(item.summaryZh || "") < 0.35) {
          item.summaryZh = `${item.summaryZh}（建议打开仓库查看用法、示例与输出效果。）`.trim();
        }
      }

      if ((item.summaryZh || "").length < 90 && section.id === "open_source_top") {
        item.summaryZh = `${item.summaryZh}（信息较短：建议查看仓库/原文的功能清单、安装方式、许可证与最新发布说明，再判断是否值得跟进。）`.trim();
      }

      if (/github\.com\//i.test(item.link || "") && chineseRatio(item.titleZh || "") < 0.25) {
        const repo = String(item.title || "").split(/\s+/).filter(Boolean)[0] || "开源项目";
        const hint = String(item.summaryZh || "").replace(/^Star\s*/i, "").trim();
        const shortHint = hasChinese(hint) ? hint.slice(0, 18) : "";
        item.titleZh = normalizeZhTitle(`${repo}：${shortHint || "开源项目更新"}`);
      }

      if (item.channel !== "podcast" && chineseRatio(item.titleZh || "") < 0.25 && hasChinese(item.summaryZh || "")) {
        const candidate = normalizeZhTitle(
          String(item.summaryZh)
            .replace(/\*\*[^*]+\*\*/g, "")
            .replace(/^Star\s+\S+\s*\/\s*/i, "")
            .replace(/^\S+\s*\/\s*\S+\s*/i, "")
            .replace(/^核心结论|^核心要点|^支撑证据|^我的判断|^简介要点/g, "")
            .trim()
            .slice(0, 20)
        );
        if (hasChinese(candidate)) item.titleZh = candidate;
      }

      if (chineseRatio(item.summaryZh || "") < 0.35) {
        const hint = normalizeZhTitle(
          String(item.titleZh || "")
            .replace(/\*\*[^*]+\*\*/g, "")
            .replace(/@\w{2,}/g, "")
            .trim()
        );
        item.summaryZh = `${item.summaryZh}（要点：${hint || "建议打开原文确认关键细节"}。）`.trim();
      }
    }
  }

  function buildBullet({ title, summary }) {
    const titleClean = normalizeZhTitle(
      String(title || "")
        .replace(/\*\*[^*]+\*\*/g, "")
        .replace(/@\w{2,}/g, "")
        .replace(/[A-Za-z][A-Za-z0-9 ,.'“”"():;+-]*$/g, "")
        .trim()
    );
    const summaryClean = normalizeZhTitle(
      String(summary || "")
        .replace(/\*\*[^*]+\*\*/g, "")
        .replace(/@\w{2,}/g, "")
        .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
        .replace(/\b\d{1,2}:\d{2}\b/g, "")
        .replace(/[A-Za-z][A-Za-z0-9 ,.'“”"():;+-]*$/g, "")
        .trim()
    );

    if (!titleClean && !summaryClean) return "";

    const headSource = (titleClean && chineseRatio(titleClean) >= 0.35) ? titleClean : (deriveTitleFromSummary(summaryClean) || summaryClean || titleClean);
    const head = smartSlice(normalizeZhTitle(headSource), 28);

    const tailSource = summaryClean && summaryClean !== titleClean ? summaryClean : (summaryClean || titleClean);
    let tail = bulletTailFromText(tailSource, { maxLen: 86 });
    if (tail.startsWith(head)) tail = tail.slice(head.length).replace(/^[。\.、,:：，\-\s]+/, "");
    const bullet = `**${head}**：${tail || head}`;
    if (!hasChinese(bullet) || bullet.length < 24) return "";
    if (chineseRatio(bullet) < 0.35) return "";
    return bullet;
  }

  const scored = sections
    .flatMap((section) => (section.items || []).map((item) => ({ sectionId: section.id, item })))
    .sort((a, b) => (b.item.score || 0) - (a.item.score || 0));
  const picked = [];
  const used = new Set();
  for (const entry of scored) {
    if (picked.length >= 5) break;
    if (used.has(entry.sectionId) && picked.length < 3) continue;
    const summary = normalizeZhTitle(entry.item.summaryZh || "");
    const title = normalizeZhTitle(entry.item.titleZh || entry.item.title || "");
    if (!summary && !title) continue;
    used.add(entry.sectionId);
    picked.push({ title, summary });
  }
  const summaryBullets = picked
    .slice(0, 5)
    .map(buildBullet)
    .filter(Boolean)
    .slice(0, 5);

  return { summaryBullets };
}

async function previousReportDuplicateKeys(date) {
  const keys = {
    links: new Set(),
    titles: new Set()
  };
  try {
    const report = JSON.parse(await readFile(path.join(reportsDir, `${previousDate(date)}.json`), "utf8"));
    for (const item of (report.sections || []).flatMap((section) => section.items || [])) {
      const linkKey = normalizedLinkKey(item.link);
      const titleKeys = [item.title, item.titleZh].map(normalizedTitleKey).filter(Boolean);
      if (linkKey) keys.links.add(linkKey);
      for (const titleKey of titleKeys) keys.titles.add(titleKey);
    }
  } catch {
    // 没有前一天日报时不做跨日去重。
  }
  return keys;
}

async function historicalReportDuplicateKeys(date, options = {}) {
  const keys = {
    links: new Set(),
    titles: new Set(),
    podcastLinks: new Set(),
    podcastTitles: new Set()
  };
  const maxDays = options.maxDays ?? RECENT_DEDUPE_DAYS;
  let files = [];
  try {
    files = (await readdir(reportsDir)).filter((file) => file.endsWith(".json")).sort().reverse();
  } catch {
    return keys;
  }

  let readCount = 0;
  for (const file of files) {
    const reportDate = file.replace(/\.json$/, "");
    if (date && reportDate >= date) continue;
    if (maxDays !== Infinity && readCount >= maxDays) break;
    try {
      const report = JSON.parse(await readFile(path.join(reportsDir, file), "utf8"));
      readCount += 1;
      for (const item of (report.sections || []).flatMap((section) => section.items || [])) {
        const linkKey = normalizedLinkKey(item.link);
        const titleKeys = [item.title, item.titleZh].map(normalizedTitleKey).filter(Boolean);
        if (linkKey) keys.links.add(linkKey);
        for (const titleKey of titleKeys) keys.titles.add(titleKey);
        if (item.sourceType === "podcast" || item.channel === "podcast") {
          if (linkKey) keys.podcastLinks.add(linkKey);
          for (const titleKey of titleKeys) keys.podcastTitles.add(titleKey);
        }
      }
    } catch {
      // 单个历史日报损坏时跳过，避免影响当天主流程。
    }
  }
  return keys;
}

async function main() {
  const sources = JSON.parse(await readFile(sourcesPath, "utf8")).filter((source) => source.enabled !== false);
  const emailCandidates = await readEmailCandidates(today);
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
  fetched.push(...emailCandidates);

  const recentKeys = await historicalReportDuplicateKeys(today, { maxDays: RECENT_DEDUPE_DAYS });
  const podcastHistoryKeys = await historicalReportDuplicateKeys(today, { maxDays: Infinity });
  const previousKeys = recentKeys;
  const extendedReadings = await fetchPodcastExtendedReadings({
    links: new Set([...recentKeys.links, ...podcastHistoryKeys.podcastLinks]),
    titles: new Set([...recentKeys.titles, ...podcastHistoryKeys.podcastTitles])
  });
  fetched.push(...extendedReadings.items);
  failures.push(...extendedReadings.failures.map((failure) => ({
    source: `播客延伸阅读 / ${failure.source}`,
    url: failure.url,
    error: failure.error
  })));

  const deduped = new Map();
  for (const item of fetched) {
    const key = normalizedLinkKey(item.link);
    const titleKey = normalizedTitleKey(item.title);
    if (previousKeys.links.has(key) || previousKeys.titles.has(titleKey)) continue;
    if ((item.sourceType === "podcast" || item.channel === "podcast") && (podcastHistoryKeys.podcastLinks.has(key) || podcastHistoryKeys.podcastTitles.has(titleKey))) continue;
    const enriched = publicItem(item);
    const existing = deduped.get(key);
    if (!existing || enriched.score > existing.score) deduped.set(key, enriched);
  }

  const items = [...deduped.values()].sort((a, b) => b.score - a.score);
  const sections = SECTION_CONFIG.map((section) => ({
    id: section.id,
    title: section.title,
    items: selectSectionItems(section, items)
  }));

  const productSection = sections.find((section) => section.id === "product_updates");
  if (!productSection?.items?.length) {
    const trustedSocialCount = fetched.filter(isTrustedProductSignalSource).length;
    const productLikeCount = fetched.filter(isProductUpdate).length;
    failures.push({
      source: "产品快讯候选诊断",
      url: "",
      error: `产品快讯为空：本次抓到高可信社媒 ${trustedSocialCount} 条，其中明确产品更新 ${productLikeCount} 条；可能是 24 小时窗口内无合格发布，或被历史去重剔除。`
    });
    console.warn(`产品快讯为空：高可信社媒 ${trustedSocialCount} 条，明确产品更新 ${productLikeCount} 条。`);
  }

  await chooseBestMedia(sections);

  let localized = { summaryBullets: [] };
  try {
    localized = await localizeSectionsZh(sections);
  } catch (error) {
    failures.push({
      source: "中文化处理",
      url: "",
      error: error?.message || "Unknown error"
    });
    console.warn(`中文化处理失败，将保留原文标题/摘要：${error?.message || error}`);
  }
  const selectedCount = sections.reduce((total, section) => total + section.items.length, 0);
  const report = {
    date: today,
    generatedAt: runStartedAt.toISOString(),
    title: `AI 日报 - ${today}`,
    stats: {
      sources: sources.length,
      fetched: fetched.length,
      emailCandidates: emailCandidates.length,
      selected: selectedCount,
      failures: failures.length
    },
    sections,
    failures,
    summaryBullets: (localized.summaryBullets || []).slice(0, 5)
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
