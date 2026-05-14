import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcesPath = path.join(root, "data", "podcast-sources.json");
const candidatesDir = path.join(root, "data", "curation-candidates");
const rejectionsPath = path.join(root, "data", "curation-rejections.json");
const curationDir = path.join(root, "data", "curation");

function todayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
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
  return String(title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

async function fetchText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { "user-agent": "Mozilla/5.0 ai-daily-podcast/0.1" }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function nextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("未找到小宇宙页面结构化数据。");
  return JSON.parse(match[1]);
}

async function podcastIdsFromCollection(collection) {
  const html = await fetchText(collection.url);
  const data = nextData(html);
  const targets = data.props?.pageProps?.collection?.target || [];
  return targets
    .filter((item) => item.pid && item.status !== "DELETED")
    .map((item) => ({
      pid: item.pid,
      title: item.title,
      latestEpisodePubDate: item.latestEpisodePubDate,
      language: collection.language || "zh"
    }));
}

async function latestEpisodes(podcast) {
  const html = await fetchText(`https://www.xiaoyuzhoufm.com/podcast/${podcast.pid}`);
  const data = nextData(html);
  const detail = data.props?.pageProps?.podcast || {};
  return (detail.episodes || []).slice(0, 4).map((episode) => ({
    podcastTitle: detail.title || podcast.title,
    podcastBrief: detail.brief || "",
    language: podcast.language || "zh",
    eid: episode.eid,
    pid: episode.pid,
    title: episode.title,
    description: stripHtml(episode.description || episode.shownotes || ""),
    shownotes: stripHtml(episode.shownotes || ""),
    publishedAt: episode.pubDate || "",
    durationSeconds: episode.duration || 0,
    url: `https://www.xiaoyuzhoufm.com/episode/${episode.eid}`,
    audioUrl: episode.media?.url || episode.enclosure?.url || "",
    image: episode.image?.picUrl || detail.image?.picUrl || ""
  }));
}

function ageInDays(dateValue = "") {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function scoreEpisode(episode) {
  const text = `${episode.podcastTitle} ${episode.title} ${episode.description}`;
  let score = 0;
  if (/AI|人工智能|大模型|模型|Agent|智能体|机器人|具身|科技|创业|产品|商业|开发|程序员|开源|芯片|硅谷/i.test(text)) score += 20;
  if (/对话|访谈|观察|复盘|一手|创始人|CEO|CTO|投资|融资|商业/i.test(text)) score += 8;
  if (episode.description.length > 180) score += 6;
  if (episode.durationSeconds > 1800) score += 3;
  if (/新闻|串讲|速递|闲聊|随便聊/i.test(text)) score -= 5;
  return score;
}

function formatDuration(seconds = 0) {
  if (!seconds) return "";
  const minutes = Math.round(seconds / 60);
  return `${minutes} 分钟`;
}

function publishedDate(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function splitSentences(text = "") {
  return String(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？!?])\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanPodcastText(text = "") {
  return String(text)
    .replace(/https?:\/\/\S+/g, "")
    .replace(/聊天讨论群[\s\S]*$/g, "")
    .replace(/欢迎关注[\s\S]*$/g, "")
    .replace(/商务合作[\s\S]*$/g, "")
    .replace(/【本期内容】|【嘉宾】|【精彩时刻】|【你将听到】|【亮点】|亮点|时间轴/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPoint(point = "") {
  return cleanPodcastText(point)
    .replace(/^[：:，,\s-]+/, "")
    .replace(/[。；;，,、\s]+$/, "")
    .trim();
}

function truncatePoint(point = "", maxLength = 96) {
  const value = cleanPoint(point);
  if (value.length <= maxLength) return value;
  const slice = value.slice(0, maxLength);
  const cut = Math.max(
    slice.lastIndexOf("，"),
    slice.lastIndexOf("；"),
    slice.lastIndexOf("："),
    slice.lastIndexOf("、"),
    slice.lastIndexOf(" ")
  );
  return `${slice.slice(0, cut > 32 ? cut : maxLength).trim()}…`;
}

function firstParagraph(text = "", maxLength = 260) {
  const cleaned = cleanPodcastText(text);
  if (!cleaned) return "当前只抓到标题，尚未获取单集简介。";
  const sentences = splitSentences(cleaned);
  let paragraph = "";
  for (const sentence of sentences) {
    if (!paragraph) {
      paragraph = sentence;
    } else if ((paragraph + sentence).length <= maxLength) {
      paragraph += sentence;
    } else {
      break;
    }
  }
  const value = paragraph || cleaned;
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function extractTimecodedPoints(text = "") {
  const source = String(text).replace(/\s+/g, " ");
  const matches = [...source.matchAll(/\d{1,2}:\d{2}(?::\d{2})?/g)];
  return matches.map((match, index) => {
    const next = matches[index + 1]?.index ?? source.length;
    const point = truncatePoint(source.slice(match.index + match[0].length, next));
    return point ? `${match[0]} ${point}` : "";
  }).filter(Boolean);
}

function extractStructuredPoints(text = "") {
  const cleaned = cleanPodcastText(text);
  const topicWords = /(AI|大模型|智能体|Agent|机器人|具身|产品|创业|商业|组织|融资|量产|算力|芯片|开发|代码|开源|模型|用户|市场)/i;
  const sentences = splitSentences(cleaned)
    .filter((sentence) => sentence.length >= 18 && sentence.length <= 120)
    .filter((sentence) => topicWords.test(sentence));
  return sentences.map((sentence) => truncatePoint(sentence));
}

function uniquePoints(points) {
  const seen = new Set();
  return points.map((point) => truncatePoint(point, 110)).filter((point) => {
    const key = point.replace(/\d{1,2}:\d{2}(?::\d{2})?/g, "").replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 40);
    if (!key || seen.has(key)) return false;
    if (/二维码|听友群|商务合作|公众号|视频号|加微信|欢迎订阅|BGM/i.test(point)) return false;
    seen.add(key);
    return true;
  });
}

function podcastSummary(episode) {
  const body = episode.shownotes || episode.description || "";
  const intro = firstParagraph(body, 280);
  const points = uniquePoints([
    ...extractTimecodedPoints(body),
    ...extractStructuredPoints(body)
  ]).slice(0, 6);
  const detailPoints = points.length ? points : [
    "节目简介信息较少，审核时需要重点打开原节目确认嘉宾、讨论深度和案例密度。",
    "如果正片主要是新闻转述或泛泛聊天，可以在审核页直接拒绝。"
  ];

  return {
    summaryZh: [
      `**讲了什么**：这一期来自 **${episode.podcastTitle}**，主题是「${episode.title}」。${intro}`,
      "**关键点细节**：",
      ...detailPoints.map((point) => `- ${point}`)
    ].join("\n"),
    transcriptText: body,
    detailCount: points.length
  };
}

function podcastCandidate(episode) {
  const score = scoreEpisode(episode);
  const id = `xiaoyuzhou-${episode.eid}`;
  const { summaryZh, transcriptText, detailCount } = podcastSummary(episode);
  const transcriptPath = transcriptText ? `transcripts/${id}.html` : "";

  return {
    id,
    category: "podcasts",
    titleZh: episode.title,
    title: episode.title,
    source: episode.podcastTitle,
    author: episode.podcastTitle,
    url: episode.url,
    audioUrl: episode.audioUrl,
    image: episode.image,
    publishedAt: publishedDate(episode.publishedAt),
    selectedAt: todayDate(),
    language: episode.language,
    duration: formatDuration(episode.durationSeconds),
    summaryZh,
    takeaways: [],
    transcriptText,
    transcriptPath,
    tags: ["播客", "小宇宙"],
    score,
    detailCount,
    selectionReason: `小宇宙收藏页候选，播客为「${episode.podcastTitle}」，质量分 ${score}。`,
    auditNote: "审核页可看这一段：请判断它是否有一手嘉宾、清晰主题、具体案例和可长期回看的信息密度。正式发布页不会展示这条审核判断。",
    reviewStatus: "pending",
    reviewNote: "",
    status: "candidate"
  };
}

function itemKeys(item) {
  return [normalizedLinkKey(item.url), normalizedTitleKey(item.titleZh || item.title)].filter(Boolean);
}

async function existingKeys(candidateStore) {
  const keys = new Set();
  for (const category of ["papers", "blogs", "podcasts"]) {
    for (const item of candidateStore[category] || []) {
      for (const key of itemKeys(item)) keys.add(key);
    }
  }
  for (const category of ["papers", "blogs", "podcasts"]) {
    for (const item of await readJson(path.join(curationDir, `${category}.json`), [])) {
      for (const key of itemKeys(item)) keys.add(key);
    }
  }
  for (const item of await readJson(rejectionsPath, [])) {
    if (item.linkKey) keys.add(item.linkKey);
    if (item.titleKey) keys.add(item.titleKey);
  }
  return keys;
}

async function main() {
  const config = await readJson(sourcesPath, { collections: [] });
  const today = todayDate();
  const candidatePath = path.join(candidatesDir, `${today}.json`);
  const candidateStore = await readJson(candidatePath, {
    date: today,
    generatedAt: new Date().toISOString(),
    papers: [],
    blogs: [],
    podcasts: []
  });
  const keys = await existingKeys(candidateStore);
  const episodes = [];

  for (const collection of config.collections || []) {
    if (!collection.enabled) continue;
    const podcasts = await podcastIdsFromCollection(collection);
    for (const podcast of podcasts) {
      try {
        episodes.push(...await latestEpisodes(podcast));
      } catch (error) {
        console.warn(`播客抓取失败：${podcast.title} - ${error.message}`);
      }
    }
  }

  const lookbackDays = config.lookbackDays ?? 14;
  const maxCandidates = config.maxCandidates ?? 6;
  const remainingSlots = Math.max(0, maxCandidates - (candidateStore.podcasts || []).length);
  const fresh = episodes
    .filter((episode) => !episode.publishedAt || ageInDays(episode.publishedAt) <= lookbackDays)
    .map(podcastCandidate)
    .filter((item) => item.score >= 18 && item.detailCount >= 3)
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      const hasSeen = itemKeys(item).some((key) => keys.has(key));
      if (hasSeen) return false;
      for (const key of itemKeys(item)) keys.add(key);
      return true;
    })
    .slice(0, remainingSlots);

  candidateStore.date = candidateStore.date || today;
  candidateStore.generatedAt = new Date().toISOString();
  candidateStore.podcasts = [...(candidateStore.podcasts || []), ...fresh];
  await writeJson(candidatePath, candidateStore);
  console.log(`播客候选：抓取 ${episodes.length} 集，新增 ${fresh.length} 条，写入 ${path.relative(root, candidatePath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
