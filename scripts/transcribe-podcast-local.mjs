import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import * as OpenCC from "opencc-js";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const configPath = path.join(root, "data", "podcast-sources.json");
const candidatesDir = path.join(root, "data", "curation-candidates");
const cacheDir = path.join(root, ".cache", "podcast-audio");
const transcriptDir = path.join(root, "data", "podcast-transcripts");
const simplifyChinese = OpenCC.Converter({ from: "tw", to: "cn" });

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function commandExists(command) {
  try {
    await execFileAsync("which", [command]);
    return true;
  } catch {
    return false;
  }
}

function proxyCandidates() {
  return [
    process.env.AI_DAILY_HTTPS_PROXY,
    process.env.HTTPS_PROXY,
    process.env.HTTP_PROXY,
    "http://127.0.0.1:6789",
    "http://127.0.0.1:7890"
  ].filter(Boolean);
}

function runCurl(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("curl", args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`curl 退出码 ${code}`));
    });
  });
}

async function resolveWhisperBinary() {
  if (process.env.WHISPER_CPP_BIN) return process.env.WHISPER_CPP_BIN;
  for (const command of ["whisper-cli", "whisper-cpp", "main"]) {
    if (await commandExists(command)) return command;
  }
  throw new Error("未找到 whisper.cpp 命令。可先安装：brew install whisper-cpp；或设置 WHISPER_CPP_BIN=/path/to/whisper-cli。");
}

async function resolveFfmpeg() {
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN;
  if (await commandExists("ffmpeg")) return "ffmpeg";
  throw new Error("未找到 ffmpeg。可先安装：brew install ffmpeg。");
}

async function downloadFile(url, filePath) {
  if (await fileExists(filePath)) return;
  await mkdir(path.dirname(filePath), { recursive: true });
  const attempts = [...proxyCandidates(), null];
  const errors = [];
  for (const proxy of attempts) {
    const args = [
      "-L",
      "--fail",
      "--retry", "3",
      "--retry-delay", "2",
      "--connect-timeout", "20",
      "-o", filePath,
      url
    ];
    if (proxy) args.splice(1, 0, "--proxy", proxy);
    try {
      await runCurl(args);
      return;
    } catch (error) {
      errors.push(`${proxy || "direct"}: ${error.message}`);
    }
  }
  throw new Error(`音频下载失败。\n${errors.map((item) => `- ${item}`).join("\n")}`);
}

async function latestCandidateStore() {
  const explicitDate = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));
  if (explicitDate) {
    return {
      file: path.join(candidatesDir, `${explicitDate}.json`),
      store: await readJson(path.join(candidatesDir, `${explicitDate}.json`), null)
    };
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  return {
    file: path.join(candidatesDir, `${today}.json`),
    store: await readJson(path.join(candidatesDir, `${today}.json`), null)
  };
}

async function transcribe(item, tools, modelPath) {
  const audioPath = path.join(cacheDir, `${item.id}.audio`);
  const wavPath = path.join(cacheDir, `${item.id}.wav`);
  const outBase = path.join(transcriptDir, item.id);
  const outTextPath = `${outBase}.txt`;

  await downloadFile(item.audioUrl, audioPath);
  await mkdir(path.dirname(wavPath), { recursive: true });
  await execFileAsync(tools.ffmpeg, [
    "-y",
    "-i", audioPath,
    "-ar", "16000",
    "-ac", "1",
    "-c:a", "pcm_s16le",
    wavPath
  ], { maxBuffer: 1024 * 1024 });

  await mkdir(transcriptDir, { recursive: true });
  await execFileAsync(tools.whisper, [
    "-m", modelPath,
    "-f", wavPath,
    "-l", "zh",
    "-otxt",
    "-of", outBase
  ], { maxBuffer: 50 * 1024 * 1024 });

  const transcript = await readFile(outTextPath, "utf8");
  return calibrateTranscript(item, transcript.trim());
}

function replaceAllLiteral(text, replacements) {
  return replacements.reduce((value, [from, to]) => {
    return value.replaceAll(from, to);
  }, text);
}

function toSimplifiedChinese(value = "") {
  return simplifyChinese(String(value || ""))
    .replaceAll("什幺", "什么")
    .replaceAll("怎幺", "怎么")
    .replaceAll("这幺", "这么")
    .replaceAll("那幺", "那么")
    .replaceAll("多幺", "多么")
    .replaceAll("幺样", "么样");
}

function calibrateTranscript(item, transcript) {
  const title = `${item.titleZh || item.title || ""} ${item.source || ""}`;
  let text = toSimplifiedChinese(transcript)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  text = replaceAllLiteral(text, [
    ["Open AI", "OpenAI"],
    ["OpenEye", "OpenAI"],
    ["open AI", "OpenAI"],
    ["openai", "OpenAI"],
    ["codex", "Codex"],
    ["claude", "Claude"],
    ["Cloud 3.7", "Claude 3.7"],
    ["Cloud 4.5", "Claude 4.5"],
    ["Cloud目前", "Claude 目前"],
    ["Gemini", "Gemini"],
    ["Gemina", "Gemini"],
    ["Anthroic", "Anthropic"],
    ["Authropic", "Anthropic"],
    ["Anthorpec", "Anthropic"],
    ["Anthropics", "Anthropic"],
    ["Anthropics是", "Anthropic 是"],
    ["Anthropics", "Anthropic"],
    ["Ansorbit", "Anthropic"],
    ["Ensorbit", "Anthropic"],
    ["Anthropic", "Anthropic"],
    ["Deepmind", "DeepMind"],
    ["deepmind", "DeepMind"],
    ["Google Deepmind", "Google DeepMind"],
    ["Mita", "Meta"],
    ["Minus", "Manus"],
    ["XAI", "xAI"],
    ["pre train", "pre-train"],
    ["Pre train", "Pre-train"],
    ["RL", "RL"]
  ]);

  if (/Vibe Coding|AI炼金术|Harness|公共厕所/i.test(title)) {
    text = replaceAllLiteral(text, [
      ["vibe calling", "Vibe Coding"],
      ["vibe coding", "Vibe Coding"],
      ["Vibe calling", "Vibe Coding"],
      ["web coding", "Vibe Coding"],
      ["Web coding", "Vibe Coding"],
      ["疯狂web coding", "疯狂 Vibe Coding"],
      ["疯狂 Vibe Coding", "疯狂 Vibe Coding"],
      ["cloud code", "Claude Code"],
      ["Cloud code", "Claude Code"],
      ["Claude code", "Claude Code"],
      ["overcloud", "OpenClaw"],
      ["openclaw", "OpenClaw"],
      ["AI令经树", "AI 炼金术"],
      ["AI炼金术", "AI 炼金术"],
      ["徐文昊", "徐文浩"],
      ["徐永浩", "徐文浩"],
      ["徐宏昊", "徐文浩"],
      ["史山", "屎山"],
      ["可扣格管理", "可控、可管理"],
      ["可扣可管理", "可控、可管理"]
    ]);
  }

  if (/姚顺宇|Anthropic|Gemini|张小珺/i.test(title)) {
    text = replaceAllLiteral(text, [
      ["姚顺雨", "姚顺宇"],
      ["姚顺禹", "姚顺宇"],
      ["姚舜宇", "姚顺宇"],
      ["姚顺字", "姚顺宇"],
      ["姚顺宇", "姚顺宇"],
      ["小俊", "小珺"],
      ["硅谷AI业界有两位Yao Shunyu", "硅谷 AI 业界有两位 Yao Shunyu"],
      ["非恶米", "非厄米"],
      ["老邓", "老登"],
      ["桂谷", "硅谷"],
      ["宁太理论", "凝聚态理论"],
      ["克劳德", "Claude"],
      ["Claude 3.7", "Claude 3.7"],
      ["Gemini 3", "Gemini 3"],
      ["DeepSeek", "DeepSeek"],
      ["Manus", "Manus"],
      ["Cursor", "Cursor"],
      ["Space X", "SpaceX"],
      ["Space x", "SpaceX"],
      ["SpaceXAI", "SpaceX AI"],
      ["Underdog", "Underdog"],
      ["Pre-train", "pre-train"],
      ["post train", "post-train"],
      ["Post train", "Post-train"]
    ]);
  }

  return text;
}

async function main() {
  const config = await readJson(configPath, {});
  const transcribeConfig = config.transcribe || {};
  const modelPath = path.resolve(root, transcribeConfig.modelPath || ".cache/whisper/ggml-medium.bin");
  if (!(await fileExists(modelPath))) {
    throw new Error(`未找到 Whisper medium 模型：${path.relative(root, modelPath)}。请先运行 npm run whisper:download。`);
  }

  const { file, store } = await latestCandidateStore();
  if (!store) throw new Error("未找到当天精选候选文件，请先运行 npm run podcasts:collect。");

  const limit = Number(transcribeConfig.maxEpisodesPerRun || 1);
  const targetId = process.argv.find((arg) => arg.startsWith("xiaoyuzhou-"));
  const podcasts = (store.podcasts || [])
    .filter((item) => item.audioUrl)
    .filter((item) => !targetId || item.id === targetId)
    .slice(0, targetId ? 1 : limit);

  if (!podcasts.length) {
    console.log("没有需要转写的播客候选。");
    return;
  }

  const tools = {
    whisper: await resolveWhisperBinary(),
    ffmpeg: await resolveFfmpeg()
  };

  let changed = false;
  for (const item of podcasts) {
    console.log(`开始本地转写：${item.titleZh || item.title}`);
    const transcript = await transcribe(item, tools, modelPath);
    if (!transcript) continue;
    item.transcriptText = transcript;
    item.transcriptSource = "local-whisper-medium";
    item.transcriptGeneratedAt = new Date().toISOString();
    item.transcriptCalibratedAt = new Date().toISOString();
    changed = true;
    console.log(`转写完成：${item.id}，${transcript.length} 字符。`);
  }

  if (changed) {
    await writeFile(file, `${JSON.stringify(store, null, 2)}\n`);
    console.log(`已更新候选文件：${path.relative(root, file)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
