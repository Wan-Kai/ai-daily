import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const reportsDir = path.join(root, "data", "reports");
const REQUIRED_SECTIONS = new Map([
  ["product_updates", "产品快讯"],
  ["research_frontier", "研究前线"],
  ["open_source_top", "开源项目"],
  ["social_shares", "社媒观察"],
  ["extended_reading", "延伸阅读"]
]);
const REQUIRED_SECTION_ORDER = [...REQUIRED_SECTIONS.keys()];
const LOOKBACK_HOURS = 24;
const RECENT_DEDUPE_DAYS = 7;

function hasChinese(value = "") {
  return /[\u4e00-\u9fff]/.test(value);
}

function chineseRatio(value = "") {
  const text = value.replace(/\s/g, "");
  if (!text) return 0;
  const chinese = [...text].filter((char) => /[\u4e00-\u9fff]/.test(char)).length;
  return chinese / text.length;
}

function textOf(item) {
  return `${item.title || ""} ${item.titleZh || ""} ${item.summary || ""} ${item.summaryZh || ""} ${item.source || ""}`.toLowerCase();
}

function isLikelyProductUpdate(item) {
  const text = textOf(item);
  return item.channel === "social" &&
    isTrustedProductSignalSource(item) &&
    /new in|now available|available today|introducing|launch|released|preview|beta|api|feature|plugin|integration|agent view|cursor|teams|gemini|claude code|模型|发布|上线|接入|功能|预览|可用|codex.*(?:phone|mobile|app|keyboard|shortcut|device|anywhere)|(?:phone|mobile|app|keyboard|shortcut|device|anywhere).*codex/.test(text) &&
    !/paper|benchmark|constitution|misalignment|we found|we observed|opinion|roundup|论文|评测|观点|原则|研究发现/.test(text);
}

function isTrustedProductSignalSource(item) {
  if (item.channel !== "social") return false;
  if (item.trust === "official") return true;
  return /Sam Altman|Greg Brockman|Dario Amodei|Alex Albert|Logan Kilpatrick|Demis Hassabis|Sundar Pichai|Satya Nadella|Aravind Srinivas|Harrison Chase|Jerry Liu|Guillermo Rauch|Arthur Mensch|李继刚|宝玉/i.test(item.source || "");
}

function isLikelyOpenSource(item) {
  const text = textOf(item);
  return item.channel === "open_source_rank" ||
    /github|open source|开源|仓库|项目|repo|qdrant|milvus|weaviate|ollama|deepseek-tui/.test(text);
}

function isLikelyPracticeCase(item) {
  const text = textOf(item);
  return /case study|customer story|deployed|production|a\/b testing|conversion|shopify|mahindra|客户|案例|部署|落地|生产|转化率|企业/.test(text);
}

function isLikelyGenericImage(url = "") {
  return /profile_images\/|_normal\.(?:jpe?g|png|webp)(?:\?|$)|avatar|logo|favicon|placeholder|BlogHeroFeature|TWLIFB|PressCoverage|ML-\d+-image/i.test(url);
}

async function latestReportPath() {
  const files = (await readdir(reportsDir))
    .filter((file) => file.endsWith(".json"))
    .sort();
  if (files.length === 0) throw new Error("没有找到日报 JSON。");
  return path.join(reportsDir, files.at(-1));
}

function add(issues, item, message) {
  const label = item ? `${item.titleZh || item.title || "未命名条目"} (${item.link || "无链接"})` : "日报";
  issues.push(`${label}: ${message}`);
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

async function previousReportDuplicateKeys(date) {
  const keys = {
    links: new Set(),
    titles: new Set()
  };
  if (!date) return keys;
  try {
    const report = JSON.parse(await readFile(path.join(reportsDir, `${previousDate(date)}.json`), "utf8"));
    for (const item of (report.sections || []).flatMap((section) => section.items || [])) {
      const linkKey = normalizedLinkKey(item.link);
      const titleKeys = [item.title, item.titleZh].map(normalizedTitleKey).filter(Boolean);
      if (linkKey) keys.links.add(linkKey);
      for (const titleKey of titleKeys) keys.titles.add(titleKey);
    }
  } catch {
    // 没有前一天日报时不做跨日去重审查。
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
  if (!date) return keys;
  let files = [];
  try {
    files = (await readdir(reportsDir)).filter((file) => file.endsWith(".json")).sort().reverse();
  } catch {
    return keys;
  }

  let readCount = 0;
  for (const file of files) {
    const reportDate = file.replace(/\.json$/, "");
    if (reportDate >= date) continue;
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
      // 单个历史日报损坏时跳过。
    }
  }
  return keys;
}

function validatePublishedWindow(issues, report, section, item) {
  if (!item.publishedAt) {
    add(issues, item, "缺少发布时间，无法确认是否属于生成时间前 24 小时内的资讯。");
    return;
  }
  const generatedAt = new Date(report.generatedAt || `${report.date}T23:59:59+08:00`);
  const publishedAt = new Date(item.publishedAt);
  if (Number.isNaN(generatedAt.getTime()) || Number.isNaN(publishedAt.getTime())) {
    add(issues, item, "发布时间或生成时间无法解析，无法做 24 小时窗口审查。");
    return;
  }
  const ageMs = generatedAt.getTime() - publishedAt.getTime();
  const maxHours = section.id === "extended_reading" && item.sourceType === "podcast" ? 24 * 14 : LOOKBACK_HOURS;
  if (ageMs < 0 || ageMs > maxHours * 60 * 60 * 1000) {
    add(issues, item, `发布时间不在生成时间前 ${maxHours} 小时内：${item.publishedAt}`);
  }
}

function validateSectionOrder(issues, report) {
  const sectionIds = (report.sections || []).map((section) => section.id);
  const requiredInReport = REQUIRED_SECTION_ORDER.filter((id) => sectionIds.includes(id));
  const actualRequiredOrder = sectionIds.filter((id) => REQUIRED_SECTIONS.has(id));
  if (actualRequiredOrder.join("|") !== requiredInReport.join("|")) {
    add(issues, null, "栏目顺序不符合要求，应为：产品快讯、研究前线、开源项目、社媒观察、延伸阅读。");
  }
}

function validateDailySummary(issues, report) {
  const bullets = report.summaryBullets || [];
  if (!Array.isArray(bullets) || bullets.length < 3 || bullets.length > 5) {
    add(issues, null, "今日摘要需要提供 3-5 条中文要点。");
    return;
  }
  for (const bullet of bullets) {
    if (!hasChinese(bullet) || chineseRatio(bullet) < 0.25) {
      add(issues, null, `今日摘要疑似不是中文或中文占比过低：${bullet}`);
    }
    if (String(bullet).length < 28) {
      add(issues, null, `今日摘要过短，需要能概括当天主线：${bullet}`);
    }
  }
}

function validateMediaCoverage(issues, report) {
  const items = (report.sections || []).flatMap((section) => section.items || []);
  const mediaCount = items.filter((item) => item.image || item.video).length;
  if (items.length >= 10 && mediaCount < 3) {
    add(issues, null, `当前日报共 ${items.length} 条，但只有 ${mediaCount} 条有图片或视频；需要回看原文和源 RSS，补回适合展示的媒体。`);
  } else if (items.length >= 5 && mediaCount === 0) {
    add(issues, null, "当前日报没有任何图片或视频；需要确认是否真的所有原文都没有可用媒体。");
  }
}

function validateOpenSourceCoverage(issues, report) {
  const openSourceSection = report.sections?.find((section) => section.id === "open_source_top");
  if (!openSourceSection || (openSourceSection.items || []).length > 0) return;

  const failedOpenSourceSources = (report.failures || [])
    .filter((failure) => /github trending|hellogithub|逛逛github|开源/i.test(`${failure.source || ""} ${failure.url || ""}`));

  if (failedOpenSourceSources.length > 0) {
    add(issues, null, `开源项目为空，但开源信息源抓取失败：${failedOpenSourceSources.map((failure) => failure.source).join("、")}。需要先修复抓取/代理或人工确认后再发布。`);
  }
}

function validateSocialCoverage(issues, report) {
  const socialSection = report.sections?.find((section) => section.id === "social_shares");
  if (!socialSection) return;

  const failedSocialSources = (report.failures || [])
    .filter((failure) => /xgo|twitter|x\.com|社媒|social/i.test(`${failure.source || ""} ${failure.url || ""}`));
  const socialCount = (socialSection.items || []).length;

  if (socialCount < 4 && failedSocialSources.length > 0) {
    add(issues, null, `社媒观察只有 ${socialCount} 条，且社媒信息源抓取失败：${failedSocialSources.map((failure) => failure.source).join("、")}。需要先修复抓取/代理或人工确认后再发布。`);
    return;
  }

  if (socialCount < 4 && (report.stats?.fetched || 0) >= 200) {
    add(issues, null, `社媒观察只有 ${socialCount} 条，但本次共抓取 ${report.stats.fetched} 条候选；需要回看社媒候选池，确认不是后处理或人工筛选过度导致。`);
  }
}

async function validateVideo(issues, item) {
  if (!item.video) return;
  if (/video\.twimg\.com/i.test(item.video)) {
    add(issues, item, "Twitter 远程视频在页面内播放不稳定，请缓存到 public/media 后使用本站相对路径。");
    return;
  }
  if (!/\.(mp4|webm|mov)(\?|$)/i.test(item.video)) {
    add(issues, item, "视频地址不是可直接播放的视频文件。");
    return;
  }
  if (item.video.startsWith("./") || item.video.startsWith("/")) {
    const localPath = path.join(root, "public", item.video.replace(/^\.?\//, ""));
    try {
      await access(localPath);
    } catch {
      add(issues, item, `本地视频文件不存在：${item.video}`);
    }
  }
}

function reviewItem(issues, section, item) {
  const titleZh = item.titleZh || "";
  const summaryZh = item.summaryZh || "";
  const isPaper = item.channel === "paper_feed" || /论文/.test(`${item.titleZh || ""} ${item.tags?.join(" ") || ""}`);

  if (!hasChinese(titleZh)) add(issues, item, "中文标题缺失或没有中文。");
  if (!hasChinese(summaryZh) || chineseRatio(summaryZh) < 0.35) add(issues, item, "中文摘要缺失、中文占比过低，疑似仍是原文。");
  if (summaryZh.length < 70) add(issues, item, "摘要过短，需要讲清楚发生了什么以及为什么值得关注。");
  if (/Your browser does not support|View on Twitter|Powered by xgo\.ing|💬|🔄|❤️|👀|📊|来自.+的(?:资讯|社媒)/i.test(summaryZh)) {
    add(issues, item, "摘要包含播放器/社媒指标/模板前缀等不应展示给用户的噪音。");
  }
  if (section.id === "research_frontier" && !/核心结论|结论|要点|价值|支撑|结果|数据显示|案例/i.test(summaryZh)) {
    add(issues, item, "研究类摘要需要按金字塔原理写出核心结论与支撑信息。");
  }
  if (isPaper) {
    if (!/\*\*核心结论\*\*/.test(summaryZh) || !/\*\*支撑证据\*\*/.test(summaryZh) || !/\*\*我的判断\*\*/.test(summaryZh)) {
      add(issues, item, "论文解读需要用加粗标签结构化写出「核心结论」「支撑证据」「我的判断」。");
    }
    if (!/\*\*[^*]+\*\*/.test(summaryZh)) {
      add(issues, item, "论文解读需要适度加粗核心结论、关键方法、重要数据或判断，方便读者扫读。");
    }
    if (/不是[^。！？\n]{0,80}而是/.test(summaryZh)) {
      add(issues, item, "论文解读需要说人话，避免使用「不是……而是……」这类模板句式。");
    }
  }
  if (section.id === "product_updates" && !isLikelyProductUpdate(item)) {
    add(issues, item, "产品快讯只允许来自官方社媒或高可信产品相关个人号的明确产品/功能/API/模型/集成/可用性更新。");
  }
  if (section.id === "open_source_top" && !isLikelyOpenSource(item)) {
    add(issues, item, "开源项目栏目需要明确开源、GitHub、仓库、版本或项目教程信号。");
  }
  if (section.id === "extended_reading" && item.sourceType === "podcast" && !/小宇宙|播客|讲了什么|简介要点/i.test(summaryZh + " " + (item.tags || []).join(" "))) {
    add(issues, item, "延伸阅读里的播客需要基于小宇宙简介写清楚这期讲了什么。");
  }
  if (item.image && isLikelyGenericImage(item.image)) {
    add(issues, item, `配图疑似头像、Logo、泛化头图或低质量图：${item.image}`);
  }
}

async function main() {
  const reportPath = process.argv[2] || await latestReportPath();
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const issues = [];
  const previousKeys = await historicalReportDuplicateKeys(report.date, { maxDays: RECENT_DEDUPE_DAYS });
  const podcastHistoryKeys = await historicalReportDuplicateKeys(report.date, { maxDays: Infinity });
  const currentLinks = new Map();
  const currentTitles = new Map();

  for (const [id, title] of REQUIRED_SECTIONS) {
    const section = report.sections?.find((candidate) => candidate.id === id);
    if (!section) add(issues, null, `缺少栏目：${title} (${id})`);
  }
  validateSectionOrder(issues, report);
  validateDailySummary(issues, report);
  validateMediaCoverage(issues, report);
  validateOpenSourceCoverage(issues, report);
  validateSocialCoverage(issues, report);

  for (const section of report.sections || []) {
    if (!REQUIRED_SECTIONS.has(section.id)) add(issues, null, `未知栏目：${section.id}`);
    for (const item of section.items || []) {
      const linkKey = normalizedLinkKey(item.link);
      const titleKey = normalizedTitleKey(item.titleZh || item.title);
      if (currentLinks.has(linkKey)) add(issues, item, `与当前日报条目重复：${currentLinks.get(linkKey)}`);
      if (currentTitles.has(titleKey)) add(issues, item, `与当前日报标题完全重复：${currentTitles.get(titleKey)}`);
      if (previousKeys.links.has(linkKey) || previousKeys.titles.has(titleKey)) {
        add(issues, item, `与最近 ${RECENT_DEDUPE_DAYS} 天日报完全重复，需要从今日入选资讯中去掉。`);
      }
      if (item.sourceType === "podcast" && (podcastHistoryKeys.podcastLinks.has(linkKey) || podcastHistoryKeys.podcastTitles.has(titleKey))) {
        add(issues, item, "播客延伸阅读不允许重复；该播客已在历史日报中出现过。");
      }
      if (linkKey) currentLinks.set(linkKey, item.titleZh || item.title || item.link);
      if (titleKey) currentTitles.set(titleKey, item.titleZh || item.title || item.link);
      validatePublishedWindow(issues, report, section, item);
      reviewItem(issues, section, item);
      await validateVideo(issues, item);
    }
  }

  if (issues.length > 0) {
    console.error(`日报质量审查未通过：${reportPath}`);
    for (const issue of issues) console.error(`- ${issue}`);
    console.error("请根据以上问题修订日报内容、分类、摘要或媒体后重新运行审查。");
    process.exit(1);
  }

  console.log(`日报质量审查通过：${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
