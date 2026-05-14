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

function toPublishedItem(item, note = "") {
  const { reviewStatus, reviewNote, selectionReason, category, ...rest } = item;
  return {
    ...rest,
    selectedAt: rest.selectedAt || new Date().toISOString().slice(0, 10),
    reviewNote: note || reviewNote || "",
    status: "published"
  };
}

async function main() {
  const issues = await listApprovalIssues();
  const payloads = issues
    .map((issue) => ({ issue, payload: parseApprovalPayload(issue.body || "") }))
    .filter((entry) => entry.payload);

  if (!payloads.length) {
    console.log("没有待处理的精选内容审批 Issue。");
    return;
  }

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

  for (const { issue, payload } of payloads) {
    const messages = [];
    for (const decision of payload.decisions) {
      const category = decision.category;
      const id = decision.id;
      const action = decision.action;
      if (!["papers", "blogs", "podcasts"].includes(category) || !id) continue;

      const found = findCandidate(stores, category, id);
      if (!found) {
        messages.push(`未找到候选：${category}/${id}`);
        continue;
      }

      if (action === "approve") {
        const linkKey = normalizedLinkKey(found.item.url);
        const titleKey = normalizedTitleKey(found.item.titleZh || found.item.title);
        const exists = published[category].some((item) => normalizedLinkKey(item.url) === linkKey || normalizedTitleKey(item.titleZh || item.title) === titleKey);
        if (!exists) {
          published[category].unshift(toPublishedItem(found.item, decision.note || ""));
          changedPublished.add(category);
          approved += 1;
        }
        found.list.splice(found.index, 1);
        changedStores.add(found.file);
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

    await closeIssue(issue.number, `已同步精选内容审批。\n\n${messages.map((item) => `- ${item}`).join("\n") || "- 没有可同步的决策。"}`);
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
