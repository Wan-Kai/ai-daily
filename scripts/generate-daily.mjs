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

const KEYWORDS = [
  ["model", "Model release"],
  ["benchmark", "Benchmark"],
  ["agent", "Agent workflow"],
  ["reasoning", "Reasoning"],
  ["multimodal", "Multimodal"],
  ["open source", "Open source"],
  ["safety", "Safety"],
  ["eval", "Evaluation"],
  ["inference", "Inference"],
  ["training", "Training"],
  ["robot", "Robotics"],
  ["enterprise", "Enterprise"],
  ["developer", "Developer tooling"],
  ["paper", "Paper"],
  ["dataset", "Dataset"]
];

const ADVANTAGE_RULES = [
  ["outperform", "Claims stronger benchmark performance"],
  ["state-of-the-art", "Positions itself around state-of-the-art results"],
  ["open source", "May improve adoption through open source availability"],
  ["faster", "Potential speed or productivity advantage"],
  ["lower cost", "Potential cost advantage"],
  ["efficient", "Potential efficiency advantage"],
  ["safety", "Includes safety or governance signal"],
  ["agent", "Useful for agentic workflows and automation"],
  ["multimodal", "Expands modality coverage"],
  ["developer", "Improves developer experience or integration path"],
  ["enterprise", "Targets enterprise adoption"],
  ["reasoning", "Improves reasoning-oriented capability"]
];

function decodeEntities(value = "") {
  return value
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
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

function parseFeed(xml, source) {
  const itemBlocks = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const entryBlocks = [...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const blocks = itemBlocks.length > 0 ? itemBlocks : entryBlocks;

  return blocks.map((block) => {
    const title = stripHtml(tagValue(block, "title"));
    const link = tagValue(block, "link") || attrValue(block, "link", "href") || tagValue(block, "guid") || source.url;
    const description = stripHtml(tagValue(block, "description") || tagValue(block, "summary") || tagValue(block, "content"));
    const publishedAt = tagValue(block, "pubDate") || tagValue(block, "published") || tagValue(block, "updated") || "";

    return {
      title,
      link,
      description,
      publishedAt,
      source: source.name,
      sourceType: source.type,
      sourceWeight: source.weight ?? 1
    };
  }).filter((item) => item.title && item.link);
}

function isRecent(item) {
  if (!item.publishedAt) return true;
  const published = new Date(item.publishedAt);
  if (Number.isNaN(published.getTime())) return true;
  const ageMs = Date.now() - published.getTime();
  return ageMs <= 1000 * 60 * 60 * 24 * 4;
}

function inferTags(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return KEYWORDS.filter(([keyword]) => text.includes(keyword)).map(([, label]) => label).slice(0, 5);
}

function inferAdvantages(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const advantages = ADVANTAGE_RULES
    .filter(([keyword]) => text.includes(keyword))
    .map(([, label]) => label);

  if (advantages.length === 0 && item.sourceType === "paper") {
    advantages.push("Worth watching for research direction and method signal");
  }

  return [...new Set(advantages)].slice(0, 4);
}

function summarize(item) {
  const text = item.description || item.title;
  if (text.length <= 220) return text;
  return `${text.slice(0, 217).trim()}...`;
}

function scoreItem(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const keywordScore = KEYWORDS.reduce((score, [keyword]) => score + (text.includes(keyword) ? 1 : 0), 0);
  const advantageScore = ADVANTAGE_RULES.reduce((score, [keyword]) => score + (text.includes(keyword) ? 2 : 0), 0);
  return item.sourceWeight * 2 + keywordScore + advantageScore;
}

async function fetchSource(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "user-agent": "ai-daily/0.1 (+https://github.com/Wan-Kai/ai-daily)"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();
    return parseFeed(xml, source);
  } finally {
    clearTimeout(timeout);
  }
}

function publicItem(item) {
  return {
    title: item.title,
    link: item.link,
    publishedAt: item.publishedAt,
    source: item.source,
    sourceType: item.sourceType,
    summary: summarize(item),
    tags: inferTags(item),
    advantages: inferAdvantages(item),
    score: scoreItem(item)
  };
}

async function main() {
  const sources = JSON.parse(await readFile(sourcesPath, "utf8"));
  const results = await Promise.allSettled(sources.map(async (source) => ({
    source,
    items: await fetchSource(source)
  })));

  const failures = [];
  const fetched = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      fetched.push(...result.value.items);
    } else {
      const source = sources[results.indexOf(result)];
      failures.push({
        source: source.name,
        url: source.url,
        error: result.reason?.message || "Unknown error"
      });
    }
  }

  const deduped = new Map();
  for (const item of fetched.filter(isRecent)) {
    const key = item.link.replace(/[#?].*$/, "");
    const enriched = publicItem(item);
    const existing = deduped.get(key);
    if (!existing || enriched.score > existing.score) {
      deduped.set(key, enriched);
    }
  }

  const items = [...deduped.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  const report = {
    date: today,
    generatedAt: new Date().toISOString(),
    title: `AI Daily - ${today}`,
    stats: {
      sources: sources.length,
      fetched: fetched.length,
      selected: items.length,
      failures: failures.length
    },
    sections: [
      {
        id: "top",
        title: "Top Signals",
        items: items.slice(0, 8)
      },
      {
        id: "papers",
        title: "Papers And Research",
        items: items.filter((item) => item.sourceType === "paper" || item.sourceType === "research").slice(0, 10)
      },
      {
        id: "industry",
        title: "Company And Product Updates",
        items: items.filter((item) => item.sourceType === "company" || item.sourceType === "blog").slice(0, 10)
      }
    ],
    failures
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, `${today}.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Generated ${items.length} items for ${today}`);
  if (failures.length > 0) {
    console.warn(`Source failures: ${failures.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
