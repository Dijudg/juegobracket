import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const APP_DATA_DIR = path.resolve("src", "data");
const ROOT_DATA_DIR = path.resolve("data");
const INTERVAL_MS = Number.parseInt(process.env.SPECIAL_DATA_SYNC_INTERVAL_MS || "", 10) || 5 * 60 * 1000;

const SOURCES = [
  {
    file: "teams.json",
    url: "https://especiales.eltelegrafo.com.ec/api/teams.json",
  },
  {
    file: "standings.json",
    url: "https://especiales.eltelegrafo.com.ec/api/standings.json",
  },
  {
    file: "matches.json",
    url: "https://especiales.eltelegrafo.com.ec/api/matches.json",
  },
  {
    file: "playoff-match-snapshots.json",
    url: "https://especiales.eltelegrafo.com.ec/api/playoff-match-snapshots.json",
  },
];

const normalizeJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const readCurrent = async (filePath) => {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
};

const directoryExists = async (dirPath) => {
  try {
    return (await stat(dirPath)).isDirectory();
  } catch {
    return false;
  }
};

const resolveDataDirs = async () => {
  const dirs = [APP_DATA_DIR];
  if (await directoryExists(ROOT_DATA_DIR)) dirs.push(ROOT_DATA_DIR);
  return dirs;
};

const syncOne = async ({ file, url }) => {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "fanatico-bracket-data-sync/1.0",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${file}: HTTP ${response.status}${body ? ` - ${body.slice(0, 120)}` : ""}`);
  }

  const payload = await response.json();
  const next = normalizeJson(payload);
  const dataDirs = await resolveDataDirs();
  let changed = false;

  for (const dir of dataDirs) {
    const filePath = path.join(dir, file);
    const current = await readCurrent(filePath);
    if (current === next) continue;
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, next, "utf8");
    changed = true;
  }

  return { file, changed };
};

const syncAll = async () => {
  const results = await Promise.allSettled(SOURCES.map(syncOne));
  let hasFailure = false;

  results.forEach((result, index) => {
    const source = SOURCES[index];
    if (result.status === "fulfilled") {
      const status = result.value.changed ? "updated" : "unchanged";
      console.log(`${source.file}: ${status}`);
      return;
    }
    hasFailure = true;
    console.error(result.reason?.message || `${source.file}: sync failed`);
  });

  if (hasFailure) {
    process.exitCode = 1;
  }
};

const watch = process.argv.includes("--watch");

await syncAll();

if (watch) {
  process.exitCode = 0;
  console.log(`Watching especiales API every ${Math.round(INTERVAL_MS / 1000)}s`);
  setInterval(() => {
    void syncAll();
  }, INTERVAL_MS);
}
