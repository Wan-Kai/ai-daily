import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const reportsDir = path.join(root, "data", "reports");
const REQUIRED_SECTIONS = new Map([
  ["product_updates", "产品快讯"],
  ["practice_cases", "实践案例"],
  ["research_frontier", "研究前线"],
  ["open_source_top", "开源项目"],
  ["social_shares", "社媒观察"]
]);

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
    item.trust === "official" &&
    /new in|now available|available today|introducing|launch|released|preview|beta|api|feature|plugin|integration|agent view|cursor|teams|gemini|codex|claude code|模型|发布|上线|接入|功能|预览|可用/.test(text) &&
    !/paper|benchmark|constitution|misalignment|we found|we observed|opinion|roundup|论文|评测|观点|原则|研究发现/.test(text);
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

  if (!hasChinese(titleZh)) add(issues, item, "中文标题缺失或没有中文。");
  if (!hasChinese(summaryZh) || chineseRatio(summaryZh) < 0.35) add(issues, item, "中文摘要缺失、中文占比过低，疑似仍是原文。");
  if (summaryZh.length < 70) add(issues, item, "摘要过短，需要讲清楚发生了什么以及为什么值得关注。");
  if (/Your browser does not support|View on Twitter|Powered by xgo\.ing|💬|🔄|❤️|👀|📊|来自.+的(?:资讯|社媒)/i.test(summaryZh)) {
    add(issues, item, "摘要包含播放器/社媒指标/模板前缀等不应展示给用户的噪音。");
  }
  if ((section.id === "research_frontier" || section.id === "practice_cases") && !/核心结论|结论|要点|价值|支撑|结果|数据显示|案例/i.test(summaryZh)) {
    add(issues, item, "研究/实践类摘要需要按金字塔原理写出核心结论与支撑信息。");
  }
  if (section.id === "product_updates" && !isLikelyProductUpdate(item)) {
    add(issues, item, "产品快讯只允许来自官方社媒的明确产品/功能/API/模型/集成/可用性更新。");
  }
  if (section.id === "open_source_top" && !isLikelyOpenSource(item)) {
    add(issues, item, "开源项目栏目需要明确开源、GitHub、仓库、版本或项目教程信号。");
  }
  if (section.id === "practice_cases" && !isLikelyPracticeCase(item)) {
    add(issues, item, "实践案例栏目需要真实组织/客户/团队落地或生产采用信号。");
  }
  if (item.image && isLikelyGenericImage(item.image)) {
    add(issues, item, `配图疑似头像、Logo、泛化头图或低质量图：${item.image}`);
  }
}

async function main() {
  const reportPath = process.argv[2] || await latestReportPath();
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const issues = [];

  for (const [id, title] of REQUIRED_SECTIONS) {
    const section = report.sections?.find((candidate) => candidate.id === id);
    if (!section) add(issues, null, `缺少栏目：${title} (${id})`);
  }

  for (const section of report.sections || []) {
    if (!REQUIRED_SECTIONS.has(section.id)) add(issues, null, `未知栏目：${section.id}`);
    for (const item of section.items || []) {
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
