import fs from "node:fs";
import path from "node:path";

async function main() {
  const date = process.argv[2];
  const refresh = process.argv.includes("--refresh");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Usage: npm run fixtures:ingest -- YYYY-MM-DD [--refresh]");

  const file = path.join(process.cwd(), "data", "today_fixture.json");
  if (fs.existsSync(file) && !refresh) {
    const cached = JSON.parse(fs.readFileSync(file, "utf8"));
    if (cached.date === date) {
      console.log(JSON.stringify({action:"REUSE",file:"data/today_fixture.json",date,fetchedAt:cached.fetchedAt,stageCount:cached.stageCount,fixtureCount:cached.fixtureCount},null,2));
      return;
    }
  }

  const apiKey = process.env.RAPIDAPI_KEY ?? process.env.ls_api_key;
  if (!apiKey) throw new Error("Missing RAPIDAPI_KEY or ls_api_key environment variable");
  const host = "livescore6.p.rapidapi.com";
  const dateParam = date.replace(/-/g, "");
  const endpoint = "/matches/v2/list-by-date";
  const response = await fetch(`https://${host}${endpoint}?Category=soccer&Date=${dateParam}&Timezone=2`,{headers:{"X-RapidAPI-Key":apiKey,"X-RapidAPI-Host":host}});
  if (!response.ok) throw new Error("LiveScore daily fixture fetch failed: HTTP " + response.status);
  const text = await response.text();
  if (!text.trim()) throw new Error("LiveScore daily fixture fetch returned an empty body");
  let payload:any; try { payload=JSON.parse(text); } catch { throw new Error("LiveScore daily fixture fetch returned invalid JSON"); }
  const stages=Array.isArray(payload?.Stages)?payload.Stages:[];
  const fixtureCount=stages.reduce((n:number,s:any)=>n+(Array.isArray(s?.Events)?s.Events.length:0),0);
  if (!stages.length || !fixtureCount) throw new Error("LiveScore fixture payload contains no stages/events; existing rolling file was not overwritten");
  const snapshot={schema:"fih-today-fixture-v1",date,timezone:"Africa/Johannesburg",provider:"LiveScore via RapidAPI",endpoint,query:{Category:"soccer",Date:dateParam,Timezone:2},fetchedAt:new Date().toISOString(),cachePolicy:"Fetch at daily-run start; reuse same-date rolling file by default. Refresh only when explicitly requested.",stageCount:stages.length,fixtureCount,payload};
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(snapshot,null,2)+"\n");
  console.log(JSON.stringify({action:refresh?"REFRESH_AND_STORE":"FETCH_AND_STORE",file:"data/today_fixture.json",date,stageCount:stages.length,fixtureCount},null,2));
}

main().catch((error)=>{ console.error(error); process.exit(1); });
