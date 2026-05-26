import { access, mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const root = process.cwd();
const reportsDir = path.join(root, "data", "reports");
const sourcesPath = path.join(root, "data", "sources.json");
const mediaDir = path.join(root, "public", "media");
const MAX_CACHE_VIDEO_BYTES = 32 * 1024 * 1024;
const execFileAsync = promisify(execFile);

function decodeEntities(value = "") {
  return value
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

function attrsFromTag(tag = "") {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)=["']([^"']+)["']/g)]
      .map(([, key, value]) => [key.toLowerCase(), decodeEntities(value).trim()])
  );
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
    url.search = "";
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return String(link).replace(/[#?].*$/, "").replace(/\/$/, "").toLowerCase();
  }
}

function uniqueUrls(urls) {
  return [...new Set(urls.filter(Boolean))];
}

function isLikelyAvatarImage(url = "") {
  return /profile_images\/|_normal\.(?:jpe?g|png|webp)(?:\?|$)|avatar|logo|favicon|placeholder/i.test(url);
}

function imageCandidatesFromHtml(html = "", base) {
  const decoded = decodeEntities(html);
  return uniqueUrls(
    [...decoded.matchAll(/<img\b[^>]*>/gi)]
      .map((match) => attrsFromTag(match[0]))
      .map((attrs) => absoluteUrl(attrs.src || attrs["data-src"] || attrs["data-original"], base))
      .filter((url) => url && !isLikelyAvatarImage(url))
  );
}

function videoCandidatesFromHtml(html = "", base) {
  const decoded = decodeEntities(html);
  const tags = [
    ...decoded.matchAll(/<video\b[^>]*>/gi),
    ...decoded.matchAll(/<source\b[^>]*>/gi)
  ];
  return uniqueUrls(
    tags
      .map((match) => attrsFromTag(match[0]))
      .map((attrs) => absoluteUrl(attrs.src, base))
      .filter((url) => /\.(mp4|mov|webm)(\?|$)/i.test(url))
  );
}

function parseFeedItems(xml, source) {
  const itemBlocks = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const entryBlocks = [...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const blocks = itemBlocks.length > 0 ? itemBlocks : entryBlocks;

  return blocks.map((block) => {
    const link = tagValue(block, "link") || attrValue(block, "link", "href") || tagValue(block, "guid") || source.url;
    const html = tagValue(block, "description") || tagValue(block, "content:encoded") || tagValue(block, "content") || tagValue(block, "summary");
    return {
      link: absoluteUrl(link, source.url) || link,
      title: stripHtml(tagValue(block, "title")),
      imageCandidates: imageCandidatesFromHtml(html, source.url),
      videoCandidates: videoCandidatesFromHtml(html, source.url)
    };
  });
}

async function fetchText(url, timeoutMs = 15000) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "user-agent": "ai-daily/0.1 (+https://github.com/Wan-Kai/ai-daily)"
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function latestReportPath() {
  const files = (await readdir(reportsDir))
    .filter((file) => file.endsWith(".json"))
    .sort();
  if (files.length === 0) throw new Error("没有找到日报 JSON。");
  return path.join(reportsDir, files.at(-1));
}

function stableMediaId(item, videoUrl) {
  const statusId = item.link?.match(/status\/(\d+)/)?.[1];
  if (statusId) return statusId;
  return crypto
    .createHash("sha1")
    .update(`${item.link || ""}\n${videoUrl}`)
    .digest("hex")
    .slice(0, 12);
}

async function localVideoPath(report, item, videoUrl) {
  if (!/video\.twimg\.com/i.test(videoUrl)) return videoUrl;

  const filename = `${report.date}-${stableMediaId(item, videoUrl)}.mp4`;
  const target = path.join(mediaDir, filename);
  try {
    await access(target);
  } catch {
    await mkdir(mediaDir, { recursive: true });
    const ok = await downloadWithProxyFallbackLimited(videoUrl, target, 120000, MAX_CACHE_VIDEO_BYTES);
    if (!ok) return "";
  }

  return `./media/${filename}`;
}

function proxyCandidates() {
  const candidates = [
    process.env.AI_DAILY_HTTPS_PROXY,
    process.env.HTTPS_PROXY,
    process.env.HTTP_PROXY,
    process.env.ALL_PROXY,
    "http://127.0.0.1:6789",
    "socks5h://127.0.0.1:6789",
    "http://127.0.0.1:7890",
    "socks5h://127.0.0.1:7890"
  ].filter(Boolean);
  return candidates.map((proxy) => String(proxy).replace(/^socks5:\/\//i, "socks5h://"));
}

async function contentLengthWithProxyFallback(url, timeoutMs) {
  try {
    const head = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "user-agent": "ai-daily/0.1 (+https://github.com/Wan-Kai/ai-daily)"
      }
    });
    if (!head.ok) throw new Error(`HTTP ${head.status}`);
    const bytes = Number(head.headers.get("content-length") || 0);
    if (bytes) return bytes;
  } catch {
    // fallthrough
  }

  const proxies = [...new Set(proxyCandidates())];
  const errors = [];

  try {
    const { stdout } = await execFileAsync("curl", [
      "-I",
      "-L",
      "--silent",
      "--show-error",
      "--connect-timeout",
      "10",
      "--max-time",
      String(Math.ceil(timeoutMs / 1000)),
      url
    ], { maxBuffer: 512 * 1024 });
    const match = stdout.match(/content-length:\\s*(\\d+)/i);
    const bytes = match ? Number(match[1]) : 0;
    if (bytes) return bytes;
  } catch (error) {
    errors.push(`direct: ${error.message}`);
  }

  for (const proxy of proxies) {
    try {
      const { stdout } = await execFileAsync("curl", [
        "-I",
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
      ], { maxBuffer: 512 * 1024 });
      const match = stdout.match(/content-length:\\s*(\\d+)/i);
      const bytes = match ? Number(match[1]) : 0;
      if (bytes) return bytes;
    } catch (error) {
      errors.push(`${proxy}: ${error.message}`);
    }
  }
  throw new Error(`无法获取视频大小：${errors.join("; ")}`);
}

async function downloadWithProxyFallback(url, target, timeoutMs) {
  const proxies = [...new Set(proxyCandidates())];
  const errors = [];

  try {
    await execFileAsync("curl", [
      "-L",
      "--silent",
      "--show-error",
      "--connect-timeout",
      "10",
      "--max-time",
      String(Math.ceil(timeoutMs / 1000)),
      "-o",
      target,
      url
    ], { maxBuffer: 1024 * 1024 });
    return;
  } catch (error) {
    errors.push(`direct: ${error.message}`);
  }

  for (const proxy of proxies) {
    try {
      await execFileAsync("curl", [
        "-L",
        "--silent",
        "--show-error",
        "--connect-timeout",
        "10",
        "--max-time",
        String(Math.ceil(timeoutMs / 1000)),
        "--proxy",
        proxy,
        "-o",
        target,
        url
      ], { maxBuffer: 1024 * 1024 });
      return;
    } catch (error) {
      errors.push(`${proxy}: ${error.message}`);
    }
  }

  throw new Error(`视频下载失败：${errors.join("; ")}`);
}

async function downloadWithProxyFallbackLimited(url, target, timeoutMs, maxBytes) {
  const proxies = [...new Set(proxyCandidates())];
  const errors = [];

  async function attempt(args, label) {
    try {
      await execFileAsync("curl", args, { maxBuffer: 1024 * 1024 });
      const info = await stat(target);
      if (info.size > maxBytes) {
        await unlink(target).catch(() => {});
        return false;
      }
      return true;
    } catch (error) {
      if (error?.code === 63) {
        // curl: Maximum file size exceeded
        await unlink(target).catch(() => {});
        return false;
      }
      errors.push(`${label}: ${error.message}`);
      await unlink(target).catch(() => {});
      return null;
    }
  }

  const base = [
    "-L",
    "--silent",
    "--show-error",
    "--connect-timeout",
    "10",
    "--max-time",
    String(Math.ceil(timeoutMs / 1000)),
    "--max-filesize",
    String(maxBytes),
    "-o",
    target,
    url
  ];

  const direct = await attempt(base, "direct");
  if (direct !== null) return direct;

  for (const proxy of proxies) {
    const out = await attempt([
      "-L",
      "--silent",
      "--show-error",
      "--connect-timeout",
      "10",
      "--max-time",
      String(Math.ceil(timeoutMs / 1000)),
      "--max-filesize",
      String(maxBytes),
      "--proxy",
      proxy,
      "-o",
      target,
      url
    ], proxy);
    if (out !== null) return out;
  }

  throw new Error(`视频下载失败：${errors.join("; ")}`);
}

async function buildSourceMediaIndex(sources, report) {
  const sourceByName = new Map(sources.map((source) => [source.name, source]));
  const selectedSources = new Set(
    (report.sections || [])
      .flatMap((section) => section.items || [])
      .map((item) => item.source)
  );
  const index = new Map();

  for (const sourceName of selectedSources) {
    const source = sourceByName.get(sourceName);
    if (!source || source.kind !== "rss") continue;
    try {
      const xml = await fetchText(source.url, source.timeoutMs ?? 15000);
      for (const item of parseFeedItems(xml, source)) {
        index.set(normalizedLinkKey(item.link), item);
      }
    } catch (error) {
      console.warn(`媒体回源失败：${sourceName} - ${error.message}`);
    }
  }

  return index;
}

async function repairReportMedia(reportPath) {
  const [sources, report] = await Promise.all([
    readFile(sourcesPath, "utf8").then(JSON.parse),
    readFile(reportPath, "utf8").then(JSON.parse)
  ]);
  const sourceMediaIndex = await buildSourceMediaIndex(sources, report);
  let changed = 0;

  for (const section of report.sections || []) {
    for (const item of section.items || []) {
      if (/video\.twimg\.com/i.test(item.video || "")) {
        try {
          const video = await localVideoPath(report, item, item.video);
          if (video) {
            item.video = video;
            item.image = "";
            changed += 1;
            continue;
          }
        } catch (error) {
          console.warn(`视频缓存失败：${item.titleZh || item.title} - ${error.message}`);
        }
      }

      if (item.image || item.video) continue;

      const sourceMedia = sourceMediaIndex.get(normalizedLinkKey(item.link));
      if (!sourceMedia) continue;

      const image = sourceMedia.imageCandidates.find((url) => !isLikelyAvatarImage(url)) || "";
      const remoteVideo = sourceMedia.videoCandidates[0] || "";
      let video = "";
      if (remoteVideo) {
        try {
          video = await localVideoPath(report, item, remoteVideo);
        } catch (error) {
          console.warn(`视频缓存失败：${item.titleZh || item.title} - ${error.message}`);
        }
      }

      if (video || image) {
        item.video = video;
        item.image = video ? "" : image;
        changed += 1;
      }
    }
  }

  if (changed > 0) {
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(`媒体修复完成：${changed} 条补充了图片或视频`);
}

repairReportMedia(process.argv[2] || await latestReportPath()).catch((error) => {
  console.error(error);
  process.exit(1);
});
