import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const root = process.cwd();
const curationDir = path.join(root, "data", "curation");
const candidatesDir = path.join(root, "data", "curation-candidates");
const rejectionsPath = path.join(root, "data", "curation-rejections.json");
const repo = process.env.AI_DAILY_GITHUB_REPO || "Wan-Kai/ai-daily";
const execFileAsync = promisify(execFile);
const maxApprovedPodcastsPerRun = Math.max(0, Number(process.env.AI_DAILY_MAX_APPROVED_PODCASTS_PER_RUN || 1));

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
  return String(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
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

async function listApprovalIssues() {
  try {
    const { stdout } = await execFileAsync("gh", [
      "issue",
      "list",
      "--repo",
      repo,
      "--state",
      "open",
      "--search",
      "精选内容审批 in:title",
      "--limit",
      "30",
      "--json",
      "number,title,body"
    ], { maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(stdout || "[]");
  } catch (error) {
    console.warn(`未能读取 GitHub Issue 审批信息，跳过精选发布同步：${error.message}`);
    return [];
  }
}

function parseApprovalPayload(body = "") {
  const fenced = body.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] || body.match(/\{[\s\S]*\}/)?.[0] || "";
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload.decisions)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function readCandidateStores() {
  const stores = new Map();
  let files = [];
  try {
    files = (await readdir(candidatesDir)).filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const file of files) {
    stores.set(file, await readJson(path.join(candidatesDir, file), {
      date: file.replace(".json", ""),
      papers: [],
      blogs: [],
      podcasts: []
    }));
  }
  return stores;
}

function findCandidate(stores, category, id) {
  for (const [file, store] of stores.entries()) {
    const list = store[category] || [];
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) return { file, store, list, index, item: list[index] };
  }
  return null;
}

async function closeIssue(number, message) {
  try {
    await execFileAsync("gh", [
      "issue",
      "close",
      String(number),
      "--repo",
      repo,
      "--comment",
      message
    ], { maxBuffer: 1024 * 1024 });
  } catch (error) {
    console.warn(`审批 Issue #${number} 已处理，但自动关闭失败：${error.message}`);
  }
}

async function commentIssue(number, message) {
  try {
    await execFileAsync("gh", [
      "issue",
      "comment",
      String(number),
      "--repo",
      repo,
      "--body",
      message
    ], { maxBuffer: 1024 * 1024 });
  } catch (error) {
    console.warn(`审批 Issue #${number} 已部分处理，但自动评论失败：${error.message}`);
  }
}

function toPublishedItem(item, note = "") {
  const { reviewStatus, reviewNote, selectionReason, auditNote, category, ...rest } = item;
  return {
    ...rest,
    selectedAt: rest.selectedAt || new Date().toISOString().slice(0, 10),
    reviewNote: note || reviewNote || "",
    status: "published"
  };
}

function candidateDateFromFile(file) {
  return file.replace(/\.json$/, "");
}

function hasLocalWhisperTranscript(item) {
  return item.transcriptSource === "local-whisper-medium" && Boolean(item.transcriptText);
}

function hasAiReviewedTranscript(item) {
  return item.transcriptAiReviewStatus === "approved" && Boolean(item.transcriptAiReviewedAt);
}

function isApprovedPodcastWaitingForPublish(item) {
  return ["approved_needs_local_transcription", "approved_needs_ai_review"].includes(item.reviewStatus);
}

async function transcribePodcastBeforePublish(stores, found) {
  if (hasLocalWhisperTranscript(found.item)) return found;
  if (!found.item.audioUrl) {
    throw new Error("播客候选缺少音频链接，无法自动生成逐字稿。");
  }

  const date = candidateDateFromFile(found.file);
  console.log(`播客通过审批，开始自动转写：${found.item.titleZh || found.item.title}`);
  // 转写脚本会从磁盘读取候选文件；先落盘可避免覆盖本轮已处理的拒绝/待审变更。
  await writeJson(path.join(candidatesDir, found.file), found.store);
  await execFileAsync("npm", [
    "run",
    "podcasts:transcribe",
    "--",
    date,
    found.item.id
  ], {
    cwd: root,
    maxBuffer: 80 * 1024 * 1024
  });

  const refreshedStore = await readJson(path.join(candidatesDir, found.file), found.store);
  stores.set(found.file, refreshedStore);
  const refreshedFound = findCandidate(stores, "podcasts", found.item.id);
  if (!refreshedFound || !hasLocalWhisperTranscript(refreshedFound.item)) {
    throw new Error("播客转写命令已结束，但候选内容中未写入转写结果。");
  }
  return refreshedFound;
}

function markPodcastWaitingForAiReview(found, note) {
  found.item.reviewStatus = "approved_needs_ai_review";
  found.item.reviewNote = note;
  found.item.transcriptAiReviewStatus = found.item.transcriptAiReviewStatus || "needs_review";
}

function publishCandidate(found, published, changedPublished, changedStores, category, note = "") {
  const linkKey = normalizedLinkKey(found.item.url);
  const titleKey = normalizedTitleKey(found.item.titleZh || found.item.title);
  const exists = published[category].some((item) => normalizedLinkKey(item.url) === linkKey || normalizedTitleKey(item.titleZh || item.title) === titleKey);
  if (!exists) {
    published[category].unshift(toPublishedItem(found.item, note));
    changedPublished.add(category);
  }
  found.list.splice(found.index, 1);
  changedStores.add(found.file);
  return !exists;
}

function publishReadyApprovedPodcasts(stores, published, changedPublished, changedStores) {
  const messages = [];
  let publishedCount = 0;
  for (const [file, store] of stores.entries()) {
    const list = store.podcasts || [];
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const item = list[index];
      if (!isApprovedPodcastWaitingForPublish(item) || !hasLocalWhisperTranscript(item) || !hasAiReviewedTranscript(item)) continue;
      const found = { file, store, list, index, item };
      const didPublish = publishCandidate(found, published, changedPublished, changedStores, "podcasts", item.reviewNote || "");
      if (didPublish) publishedCount += 1;
      messages.push(`${didPublish ? "自动发布已校准播客" : "移除重复已校准播客"}：${item.titleZh || item.title}`);
    }
  }
  return { messages, publishedCount };
}

async function main() {
  const issues = await listApprovalIssues();
  const payloads = issues
    .map((issue) => ({ issue, payload: parseApprovalPayload(issue.body || "") }))
    .filter((entry) => entry.payload);

  const stores = await readCandidateStores();
  const published = {
    papers: await readJson(path.join(curationDir, "papers.json"), []),
    blogs: await readJson(path.join(curationDir, "blogs.json"), []),
    podcasts: await readJson(path.join(curationDir, "podcasts.json"), [])
  };
  const rejections = await readJson(rejectionsPath, []);
  const changedStores = new Set();
  const changedPublished = new Set();
  let approved = 0;
  let rejected = 0;
  let kept = 0;
  let processedApprovedPodcasts = 0;

  if (!payloads.length) {
    console.log("没有待处理的精选内容审批 Issue。");
  }

  for (const { issue, payload } of payloads) {
    const messages = [];
    let hasDeferredDecision = false;
    for (const decision of payload.decisions) {
      const category = decision.category;
      const id = decision.id;
      const action = decision.action;
      if (!["papers", "blogs", "podcasts"].includes(category) || !id) continue;

      let found = findCandidate(stores, category, id);
      if (!found) {
        hasDeferredDecision = true;
        kept += 1;
        messages.push(`未找到候选，无法同步：${category}/${id}（可能候选池已被后续任务覆盖或清理）`);
        continue;
      }

      if (action === "approve") {
        if (category === "podcasts") {
          const needsTranscription = !hasLocalWhisperTranscript(found.item);
          if (needsTranscription && processedApprovedPodcasts >= maxApprovedPodcastsPerRun) {
            found.item.reviewStatus = "approved_needs_local_transcription";
            found.item.reviewNote = "已通过内容审核，等待本机 Codex 执行 Whisper 转写和 AI 校准；校准完成后会自动发布，无需重新审批。";
            changedStores.add(found.file);
            kept += 1;
            hasDeferredDecision = true;
            messages.push(`延后处理：${found.item.titleZh || found.item.title}（等待后续批次自动转写）`);
            continue;
          }
          try {
            found = await transcribePodcastBeforePublish(stores, found);
            if (needsTranscription) processedApprovedPodcasts += 1;
          } catch (error) {
            found.item.reviewStatus = "pending";
            found.item.reviewNote = `已通过审核，但自动转写失败：${error.message}`;
            changedStores.add(found.file);
            kept += 1;
            hasDeferredDecision = true;
            messages.push(`播客转写失败，保留待审：${found.item.titleZh || found.item.title} - ${error.message}`);
            continue;
          }

          if (!hasAiReviewedTranscript(found.item)) {
            markPodcastWaitingForAiReview(
              found,
              "已通过内容审核并完成本地 Whisper 转写，但逐字稿仍需 Codex 结合标题、节目稿和上下文做 AI 校准；校准完成后会自动发布，无需重新审批。"
            );
            changedStores.add(found.file);
            kept += 1;
            hasDeferredDecision = true;
            messages.push(`播客等待 AI 校准后自动发布：${found.item.titleZh || found.item.title}`);
            continue;
          }
        }

        if (publishCandidate(found, published, changedPublished, changedStores, category, decision.note || "")) {
          approved += 1;
        }
        messages.push(`通过：${found.item.titleZh || found.item.title}`);
      } else if (action === "reject") {
        const linkKey = normalizedLinkKey(found.item.url);
        const titleKey = normalizedTitleKey(found.item.titleZh || found.item.title);
        rejections.push({
          id,
          category,
          title: found.item.titleZh || found.item.title,
          url: found.item.url,
          linkKey,
          titleKey,
          reason: decision.note || "",
          rejectedAt: new Date().toISOString()
        });
        found.list.splice(found.index, 1);
        changedStores.add(found.file);
        rejected += 1;
        messages.push(`拒绝：${found.item.titleZh || found.item.title}`);
      } else {
        found.item.reviewStatus = "pending";
        found.item.reviewNote = decision.note || found.item.reviewNote || "";
        changedStores.add(found.file);
        kept += 1;
        messages.push(`保留待审：${found.item.titleZh || found.item.title}`);
      }
    }

    const summary = messages.map((item) => `- ${item}`).join("\n") || "- 没有可同步的决策。";
    const suffix = hasDeferredDecision
      ? "\n\n部分播客仍需本地转写或 Codex AI 校准，已继续保留在待审池；校准完成后会自动发布，无需重新审批。"
      : "";
    await closeIssue(issue.number, `已同步精选内容审批。\n\n${summary}${suffix}`);
  }

  const { messages: autoPublishedPodcastMessages, publishedCount: autoPublishedPodcastCount } = publishReadyApprovedPodcasts(stores, published, changedPublished, changedStores);
  if (autoPublishedPodcastMessages.length) {
    approved += autoPublishedPodcastCount;
    console.log(autoPublishedPodcastMessages.join("\n"));
  }

  await mkdir(curationDir, { recursive: true });
  for (const category of changedPublished) {
    await writeJson(path.join(curationDir, `${category}.json`), published[category]);
  }
  for (const file of changedStores) {
    await writeJson(path.join(candidatesDir, file), stores.get(file));
  }
  if (rejected > 0) await writeJson(rejectionsPath, rejections);

  console.log(`精选审批同步完成：通过 ${approved} 条，拒绝 ${rejected} 条，保留待审 ${kept} 条。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
