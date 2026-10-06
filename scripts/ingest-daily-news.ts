import fs from "node:fs";
import path from "node:path";

const date = process.argv[2];
const force = process.argv.includes("--force");
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error("Usage: npm run news:ingest -- YYYY-MM-DD [--force]");
}
const dir = path.join(process.cwd(), "data", "news-snapshots");
const file = path.join(dir, date + ".json");
if (fs.existsSync(file) && !force) {
  const cached = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(JSON.stringify({action:"REUSE",file:path.relative(process.cwd(),file),date,fetchedAt:cached.fetchedAt},null,2));
  process.exit(0);
}
const apiKey = process.env.RAPIDAPI_KEY;
if (!apiKey) throw new Error("Missing RAPIDAPI_KEY environment variable");
const host = "livescore6.p.rapidapi.com";
const endpoint = "/news/v2/list";
const response = await fetch("https://" + host + endpoint, {
  headers: {"X-RapidAPI-Key":apiKey,"X-RapidAPI-Host":host}
});
if (!response.ok) throw new Error("LiveScore news fetch failed: HTTP " + response.status);
const payload:any = await response.json();
fs.mkdirSync(dir,{recursive:true});
const snapshot = {
  schema:"fih-livescore-daily-news-v1",
  date,
  timezone:"Africa/Johannesburg",
  provider:"LiveScore via RapidAPI",
  endpoint,
  fetchedAt:new Date().toISOString(),
  purpose:"Daily contextual evidence. Does not independently alter locked V2.9 model rules.",
  payload
};
fs.writeFileSync(file,JSON.stringify(snapshot,null,2)+"\n");
console.log(JSON.stringify({action:"FETCH_AND_STORE",file:path.relative(process.cwd(),file),date},null,2));
