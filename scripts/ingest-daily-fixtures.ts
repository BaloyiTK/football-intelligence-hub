import fs from "node:fs";
import path from "node:path";

const date = process.argv[2];
const force = process.argv.includes("--force");
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error("Usage: npm run fixtures:ingest -- YYYY-MM-DD");
}

const outputDir = path.join(process.cwd(), "data", "fixture-snapshots");
const outputFile = path.join(outputDir, date + ".json");

if (fs.existsSync(outputFile) && !force) {
  const cached = JSON.parse(fs.readFileSync(outputFile, "utf8"));
  console.log(JSON.stringify({
    action: "REUSE",
    file: path.relative(process.cwd(), outputFile),
    date,
    fetchedAt: cached.fetchedAt,
    stageCount: cached.stageCount
  }, null, 2));
  process.exit(0);
}

const apiKey = process.env.RAPIDAPI_KEY ?? process.env.ls_api_key;
if (!apiKey) throw new Error("Missing RAPIDAPI_KEY or ls_api_key environment variable");

const host = "livescore6.p.rapidapi.com";
const dateParam = date.replace(/-/g, "");
const endpoint = "/matches/v2/list-by-date";
const url = "https://" + host + endpoint +
  "?Category=soccer&Date=" + dateParam + "&Timezone=2";

const response = await fetch(url, {
  headers: {
    "X-RapidAPI-Key": apiKey,
    "X-RapidAPI-Host": host
  }
});
if (!response.ok) {
  throw new Error("LiveScore daily fixture fetch failed: HTTP " + response.status);
}

const payload: any = await response.json();
const stages = Array.isArray(payload?.Stages) ? payload.Stages : [];
fs.mkdirSync(outputDir, { recursive: true });

const snapshot = {
  schema: "fih-livescore-daily-snapshot-v1",\n  fetchPolicy: "HARD LIMIT: maximum one LiveScore fixture API fetch per SAST calendar date; all reruns must reuse this snapshot.",
  date,
  timezone: "Africa/Johannesburg",
  provider: "LiveScore via RapidAPI",
  endpoint,
  query: { Category: "soccer", Date: dateParam, Timezone: 2 },
  fetchedAt: new Date().toISOString(),
  stageCount: stages.length,
  payload
};

fs.writeFileSync(outputFile, JSON.stringify(snapshot, null, 2) + "\n");
console.log(JSON.stringify({
  action: "FETCH_AND_STORE",
  file: path.relative(process.cwd(), outputFile),
  date,
  stageCount: stages.length
}, null, 2));
