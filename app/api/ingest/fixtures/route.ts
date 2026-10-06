import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const REPO = "BaloyiTK/football-intelligence-hub";
const OWNER = "BaloyiTK";
const REPO_NAME = "football-intelligence-hub";
const PATH = "data/today_fixture.json";

function sastDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

async function github(path: string, token: string, init?: RequestInit) {
  return fetch(`https://api.github.com/repos/${OWNER}/${REPO_NAME}/contents/${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "FIH-Vercel-Ingest",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
}

export async function GET() {
  try {
    const date = sastDate();
    const apiKey = process.env.ls_api_key ?? process.env.RAPIDAPI_KEY;
    const githubToken = process.env.FIH_GITHUB_TOKEN;
    if (!apiKey) return NextResponse.json({ok:false,error:"LiveScore credential unavailable"},{status:500});
    if (!githubToken) return NextResponse.json({ok:false,error:"GitHub write credential unavailable"},{status:500});

    const dateParam = date.replace(/-/g, "");
    const endpoint = "/matches/v2/list-by-date";
    const url = `https://livescore6.p.rapidapi.com${endpoint}?Category=soccer&Date=${dateParam}&Timezone=2`;
    const response = await fetch(url, {
      headers: {"X-RapidAPI-Key":apiKey,"X-RapidAPI-Host":"livescore6.p.rapidapi.com"},
      cache:"no-store"
    });
    if (!response.ok) return NextResponse.json({ok:false,error:`LiveScore HTTP ${response.status}`},{status:502});
    const text = await response.text();
    if (!text.trim()) return NextResponse.json({ok:false,error:"LiveScore returned empty body"},{status:502});

    let payload:any;
    try { payload=JSON.parse(text); } catch { return NextResponse.json({ok:false,error:"LiveScore returned invalid JSON"},{status:502}); }
    const stages=Array.isArray(payload?.Stages)?payload.Stages:[];
    const fixtureCount=stages.reduce((n:number,s:any)=>n+(Array.isArray(s?.Events)?s.Events.length:0),0);
    if (!stages.length || !fixtureCount) return NextResponse.json({ok:false,error:"LiveScore payload contains no fixtures"},{status:502});

    const snapshot={
      schema:"fih-today-fixture-v1",date,timezone:"Africa/Johannesburg",
      provider:"LiveScore via RapidAPI",endpoint,
      query:{Category:"soccer",Date:dateParam,Timezone:2},
      fetchedAt:new Date().toISOString(),stageCount:stages.length,fixtureCount,payload
    };
    const body=JSON.stringify(snapshot,null,2)+"\n";

    const existing=await github(PATH,githubToken);
    let sha:string|undefined;
    if (existing.ok) {
      const current=await existing.json();
      sha=current.sha;
    } else if (existing.status!==404) {
      return NextResponse.json({ok:false,error:`GitHub read HTTP ${existing.status}`},{status:502});
    }

    const write=await github(PATH,githubToken,{
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        message:`data: refresh today_fixture for ${date}`,
        content:Buffer.from(body,"utf8").toString("base64"),
        ...(sha?{sha}:{})
      })
    });
    if (!write.ok) {
      const detail=(await write.text()).slice(0,500);
      return NextResponse.json({ok:false,error:`GitHub write HTTP ${write.status}`,detail},{status:502});
    }
    const written=await write.json();

    const verify=await github(PATH,githubToken);
    if (!verify.ok) return NextResponse.json({ok:false,error:`GitHub verify HTTP ${verify.status}`},{status:502});
    const verified=await verify.json();
    const decoded=Buffer.from(verified.content,"base64").toString("utf8");
    const saved=JSON.parse(decoded);
    if (saved.date!==date || saved.fixtureCount!==fixtureCount || saved.stageCount!==stages.length) {
      return NextResponse.json({ok:false,error:"GitHub post-write verification mismatch"},{status:502});
    }

    return NextResponse.json({
      ok:true,repository:REPO,path:PATH,date,stageCount:stages.length,fixtureCount,
      commitSha:written?.commit?.sha ?? null,contentSha:verified?.sha ?? null,verified:true
    });
  } catch(e) {
    return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Unknown ingestion error"},{status:500});
  }
}
