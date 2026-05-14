import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const modelUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin";
const modelPath = path.join(root, ".cache", "whisper", "ggml-medium.bin");
const tempPath = `${modelPath}.part`;
const expectedMinBytes = 1.4 * 1024 * 1024 * 1024;

function proxyCandidates() {
  return [
    process.env.AI_DAILY_HTTPS_PROXY,
    process.env.HTTPS_PROXY,
    process.env.HTTP_PROXY,
    "http://127.0.0.1:6789",
    "http://127.0.0.1:7890"
  ].filter(Boolean);
}

async function fileSize(filePath) {
  try {
    return (await stat(filePath)).size;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

function runCurl(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("curl", args, {
      stdio: "inherit",
      env: { ...process.env, ...env }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`curl 退出码 ${code}`));
    });
  });
}

async function tryDownload(proxy) {
  const args = [
    "-L",
    "--fail",
    "--retry", "3",
    "--retry-delay", "2",
    "--connect-timeout", "20",
    "-o", tempPath,
    modelUrl
  ];
  if (proxy) args.splice(1, 0, "--proxy", proxy);
  console.log(proxy ? `尝试通过代理下载：${proxy}` : "尝试直连下载。");
  await runCurl(args);
}

async function download() {
  const currentSize = await fileSize(modelPath);
  if (currentSize >= expectedMinBytes) {
    console.log(`Whisper medium 模型已存在：${path.relative(root, modelPath)} (${(currentSize / 1024 / 1024).toFixed(1)} MB)`);
    return;
  }

  await mkdir(path.dirname(modelPath), { recursive: true });
  await unlink(tempPath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });

  console.log(`开始下载 Whisper medium 模型：${modelUrl}`);
  console.log(`保存到：${path.relative(root, modelPath)}`);

  const attempts = [...proxyCandidates(), null];
  const errors = [];
  for (const proxy of attempts) {
    try {
      await tryDownload(proxy);
      const finalSize = await fileSize(tempPath);
      if (finalSize < expectedMinBytes) {
        throw new Error(`模型文件过小，可能下载不完整：${(finalSize / 1024 / 1024).toFixed(1)} MB`);
      }
      await rename(tempPath, modelPath);
      console.log(`Whisper medium 模型下载完成：${path.relative(root, modelPath)} (${(finalSize / 1024 / 1024).toFixed(1)} MB)`);
      return;
    } catch (error) {
      errors.push(`${proxy || "direct"}: ${error.message}`);
      await unlink(tempPath).catch(() => {});
    }
  }

  throw new Error(`Whisper medium 模型下载失败。\n${errors.map((item) => `- ${item}`).join("\n")}`);
}

download().catch((error) => {
  console.error(error);
  process.exit(1);
});
