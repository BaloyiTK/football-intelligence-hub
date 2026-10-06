import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function sastDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

export async function GET() {
  try {
    const date = sastDate();
    const apiKey = process.env.ls_api_key ?? process.env.RAPIDAPI_KEY;
    if (!apiKey) return NextResponse.json({ ok:false, error:"LiveScore credential unavailable" }, { status:500 });

    const dateParam = date.replace(/-/g, "");
    const endpoint = "/matches/v2/list-by-date";
    const url = `https://livescore6.p.rapidapi.com${endpoint}?Category=soccer&Date=${dateParam}&Timezone=2`;
    const response = await fetch(url, {
      headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host":"livescore6.p.rapidapi.com" },
      cache: "no-store"
    });
    if (!response.ok) return NextResponse.json({ok:false,error:`LiveScore HTTP ${response.status}`},{status:502});
    const text = await response.text();
    if (!text.trim()) return NextResponse.json({ok:false,error:"LiveScore returned empty body"},{status:502});
    let payload:any;
    try { payload=JSON.parse(text); } catch { return NextResponse.json({ok:false,error:"LiveScore returned invalid JSON"},{status:502}); }
    const stages=Array.isArray(payload?.Stages)?payload.Stages:[];
    const fixtureCount=stages.reduce((n:number,s:any)=>n+(Array.isArray(s?.Events)?s.Events.length:0),0);
    if (!stages.length || !fixtureCount) return NextResponse.json({ok:false,error:"LiveScore payload contains no fixtures"},{status:502});
    return NextResponse.json({
      ok:true,
      snapshot:{schema:"fih-today-fixture-v1",date,timezone:"Africa/Johannesburg",provider:"LiveScore via RapidAPI",endpoint,
        query:{Category:"soccer",Date:dateParam,Timezone:2},fetchedAt:new Date().toISOString(),
        stageCount:stages.length,fixtureCount,payload}
    });
  } catch (e) {
    return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Unknown ingestion error"},{status:500});
  }
}
