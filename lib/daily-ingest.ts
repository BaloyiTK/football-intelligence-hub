const RAPIDAPI_HOST = "livescore6.p.rapidapi.com";
const REPO = process.env.FIH_GITHUB_REPO ?? "BaloyiTK/football-intelligence-hub";
const BRANCH = process.env.FIH_GITHUB_BRANCH ?? "main";

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) throw new Error(`Missing ${name}${fallback ? ` or ${fallback}` : ""}`);
  return value;
}

async function githubFile(path: string) {
  const token = requireEnv("FIH_GITHUB_TOKEN");
  const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`;
  const res = await fetch(url, {headers:{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},cache:"no-store"});
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read failed: HTTP ${res.status}`);
  return await res.json() as {sha:string};
}

async function writeGithub(path: string, payload: unknown, message: string) {
  const token = requireEnv("FIH_GITHUB_TOKEN");
  const current = await githubFile(path);
  const content = Buffer.from(JSON.stringify(payload, null, 2) + "\n").toString("base64");
  const body: Record<string, unknown> = {message,content,branch:BRANCH};
  if (current?.sha) body.sha = current.sha;
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method:"PUT",
    headers:{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`GitHub write failed: HTTP ${res.status} ${await res.text()}`);
  const out = await res.json() as {commit?:{sha?:string}};
  return out.commit?.sha;
}

async function liveScore(path: string) {
  const key = requireEnv("RAPIDAPI_KEY", "ls_api_key");
  const res = await fetch("https://" + RAPIDAPI_HOST + path, {
    headers:{"X-RapidAPI-Key":key,"X-RapidAPI-Host":RAPIDAPI_HOST},
    cache:"no-store"
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LiveScore fetch failed: HTTP ${res.status}`);
  if (!text.trim()) throw new Error("LiveScore returned an empty body");
  try { return JSON.parse(text); } catch { throw new Error("LiveScore returned invalid JSON"); }
}

export async function ingestTodayFixtures(date: string) {
  const dateParam = date.replace(/-/g, "");
  const payload:any = await liveScore(`/matches/v2/list-by-date?Category=soccer&Date=${dateParam}&Timezone=2`);
  const stages = Array.isArray(payload?.Stages) ? payload.Stages : [];
  if (!stages.length) throw new Error("Fixture payload has no stages");
  const fixtureCount = stages.reduce((n:number,s:any)=>n+(Array.isArray(s?.Events)?s.Events.length:0),0);
  if (!fixtureCount) throw new Error("Fixture payload has no events");
  const snapshot = {schema:"fih-today-fixture-v1",date,timezone:"Africa/Johannesburg",provider:"LiveScore via RapidAPI",fetchedAt:new Date().toISOString(),stageCount:stages.length,fixtureCount,payload};
  const commit = await writeGithub("data/today_fixture.json",snapshot,`data: refresh today fixtures ${date}`);
  return {date,stageCount:stages.length,fixtureCount,commit};
}

export async function ingestTodayNews(date: string) {
  const payload = await liveScore("/news/v2/list");
  const snapshot = {schema:"fih-today-news-v1",date,timezone:"Africa/Johannesburg",provider:"LiveScore via RapidAPI",fetchedAt:new Date().toISOString(),purpose:"Contextual research evidence only; does not independently alter locked V2.9 probabilities.",payload};
  const commit = await writeGithub("data/today_news.json",snapshot,`data: refresh today news ${date}`);
  return {date,commit};
}
