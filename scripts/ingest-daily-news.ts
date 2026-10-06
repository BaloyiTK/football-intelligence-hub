import fs from "node:fs";
import path from "node:path";

async function main() {
  const date=process.argv[2]; const refresh=process.argv.includes("--refresh");
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Usage: npm run news:ingest -- YYYY-MM-DD [--refresh]");
  const file=path.join(process.cwd(),"data","today_news.json");
  if(fs.existsSync(file)&&!refresh){const cached=JSON.parse(fs.readFileSync(file,"utf8"));if(cached.date===date){console.log(JSON.stringify({action:"REUSE",file:"data/today_news.json",date,fetchedAt:cached.fetchedAt},null,2));return;}}
  const apiKey=process.env.RAPIDAPI_KEY??process.env.ls_api_key;if(!apiKey)throw new Error("Missing RAPIDAPI_KEY or ls_api_key environment variable");
  const host="livescore6.p.rapidapi.com",endpoint="/news/v2/list";
  const response=await fetch("https://"+host+endpoint,{headers:{"X-RapidAPI-Key":apiKey,"X-RapidAPI-Host":host}});
  if(!response.ok)throw new Error("LiveScore news fetch failed: HTTP "+response.status);
  const text=await response.text();if(!text.trim())throw new Error("LiveScore news fetch returned an empty body; existing rolling file was not overwritten");
  let payload:any;try{payload=JSON.parse(text)}catch{throw new Error("LiveScore news fetch returned invalid JSON; existing rolling file was not overwritten")}
  const snapshot={schema:"fih-today-news-v1",date,timezone:"Africa/Johannesburg",provider:"LiveScore via RapidAPI",endpoint,fetchedAt:new Date().toISOString(),cachePolicy:"Fetch at daily-run start; reuse same-date rolling file by default. Refresh only when explicitly requested.",purpose:"Contextual evidence for injuries, suspensions, squad/rotation and coaching context. Does not independently alter locked V2.9 model rules.",payload};
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(snapshot,null,2)+"\n");
  console.log(JSON.stringify({action:refresh?"REFRESH_AND_STORE":"FETCH_AND_STORE",file:"data/today_news.json",date},null,2));
}

main().catch((error)=>{ console.error(error); process.exit(1); });
