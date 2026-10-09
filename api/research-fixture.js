import { generateText, gateway, isStepCount } from "ai";
import {requireFihGitHubOidc} from "./_fih-auth.js";

const OWNER=process.env.FIH_GITHUB_OWNER||process.env.VERCEL_GIT_REPO_OWNER;
const REPO=process.env.FIH_GITHUB_REPO||process.env.VERCEL_GIT_REPO_SLUG;
const BRANCH=process.env.FIH_GITHUB_BRANCH||"main";
const MODEL=process.env.FIH_RESEARCH_MODEL||"openai/gpt-5.6-luna";
const GH_TOKEN=process.env.FIH_GITHUB_TOKEN;

function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s}
async function gh(path){
  const r=await fetch("https://api.github.com/repos/"+OWNER+"/"+REPO+"/contents/"+path+"?ref="+encodeURIComponent(BRANCH),{
    headers:{Authorization:"Bearer "+GH_TOKEN,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}
  });
  if(!r.ok)throw new Error("GITHUB_READ_"+r.status+"_"+path);
  const x=await r.json();
  return JSON.parse(Buffer.from(String(x.content||"").replace(/\s/g,""),"base64").toString("utf8"));
}
function parseJson(text){
  const t=String(text||"").trim().replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/,"");
  try{return JSON.parse(t)}catch{}
  const a=t.indexOf("{"),b=t.lastIndexOf("}");
  if(a<0||b<a)throw new Error("AI_RESEARCH_JSON_NOT_FOUND");
  return JSON.parse(t.slice(a,b+1));
}
function basicRecordCheck(r,f,rid){
  if(!r||String(r.fixtureId)!==String(f.fixtureId)||r.researchRunId!==rid)throw new Error("AI_RESEARCH_IDENTITY_MISMATCH");
  if(!r.fixture||!r.researchedAt||!Array.isArray(r.sourceMetadata)||!r.facts)throw new Error("AI_RESEARCH_RECORD_SHAPE_INVALID");
  for(const k of ["form","standings","headToHead","squadAvailability","schedule","competitionContext"]){
    const c=r.facts[k];
    if(!c||!["VERIFIED","PARTIAL","UNAVAILABLE"].includes(String(c.status))||!Array.isArray(c.attempts)||!c.attempts.length||!Array.isArray(c.sourceRefs))throw new Error("AI_RESEARCH_CATEGORY_INVALID_"+k);
    for(const a of c.attempts){
      if(!a?.query||!a?.attemptedAt||!a?.outcome)throw new Error("AI_RESEARCH_ATTEMPT_INVALID_"+k);
      if(/CHATGPT_.*COMPLETED|^SEARCH_COMPLETE$/i.test(String(a.outcome)))throw new Error("AI_RESEARCH_SYNTHETIC_MARKER_"+k);
    }
    if(["PARTIAL","UNAVAILABLE"].includes(c.status)&&!(c.searchExhausted===true&&c.attempts.some(a=>/SEARCH_EXHAUSTED/i.test(String(a.outcome)))))throw new Error("AI_RESEARCH_FALSE_EXHAUSTION_"+k);
  }
  const refs=new Set(r.sourceMetadata.map(x=>String(x?.ref||"")));
  for(const s of r.sourceMetadata)if(!s?.ref||!/^https?:\/\//.test(String(s.url||""))||!s.retrievedAt||!Array.isArray(s.supports))throw new Error("AI_RESEARCH_SOURCE_INVALID");
  for(const k of ["form","standings","headToHead","schedule"])for(const ref of r.facts[k].sourceRefs||[])if(!refs.has(String(ref)))throw new Error("AI_RESEARCH_UNKNOWN_SOURCE_"+k);
  return r;
}
function collectToolEvidence(result){
  const queries=new Set(),urls=new Set();
  const visit=v=>{
    if(!v)return;
    if(Array.isArray(v)){for(const x of v)visit(x);return;}
    if(typeof v!=="object")return;
    if(typeof v.query==="string"&&v.query.trim())queries.add(v.query.trim());
    if(typeof v.url==="string"&&/^https?:\/\//i.test(v.url))urls.add(v.url);
    for(const x of Object.values(v))visit(x);
  };
  for(const step of (result.steps||[]))visit(step);
  return {queries:[...queries],urls:[...urls]};
}
function enforceObservedResearch(record,evidence){
  if(evidence.queries.length<6)throw new Error("CATEGORY_SEARCH_PARITY_FAILED_"+evidence.queries.length);
  const qs=new Set(evidence.queries),urls=new Set(evidence.urls);
  for(const k of ["form","standings","headToHead","squadAvailability","schedule","competitionContext"]){
    const c=record.facts[k];
    if(!c.attempts.some(a=>qs.has(String(a?.query||"").trim())))throw new Error("UNOBSERVED_CATEGORY_QUERY_"+k);
  }
  for(const sm of record.sourceMetadata)if(urls.size&&!urls.has(String(sm.url)))throw new Error("UNOBSERVED_SOURCE_URL_"+sm.url);
}
function systemPrompt(date,fixture,rid,kickoff,mode,cutoffAt){
 const temporal=mode==="BACKTEST"?`This is BACKTEST mode. Retain only evidence verifiably available at or before ${cutoffAt}. Every retained sourceMetadata item MUST include availableAt and it must be <= ${cutoffAt}. Do not use this target fixture result or any later information.`:`This is PREDICTION mode. Use only information available before the fixture kickoff; reject any source/result that reveals this fixture\'s live or final outcome.`;
 return `You are the authoritative FIH Step-2 football research executor. Research exactly one fixture using the provided Browserbase web search and fetch tools. You MUST perform genuine category-specific web searches and retain only source-backed facts. Never invent a score, table position, injury, date, H2H row, URL, or source. If a required category cannot be verified after targeted search, use PARTIAL or UNAVAILABLE only with searchExhausted:true and an attempt outcome containing SEARCH_EXHAUSTED. Do not use generic SEARCH_COMPLETE markers.

RUN: date=${date}; researchRunId=${rid}; fixtureId=${fixture.fixtureId}; ${fixture.home} vs ${fixture.away}; competition=${fixture.competition}; kickoff=${kickoff}. ${temporal}

Required categories:
1) form: last 5 completed overall matches for each team AND last 5 HOME matches for the home team AND last 5 AWAY matches for the away team. Each retained row: date, opponent, venue HOME/AWAY, goalsFor, goalsAgainst, sourceRef. VERIFIED requires exactly 5 in all four series. If exact coverage cannot be verified, retain only verified rows and mark PARTIAL+SEARCH_EXHAUSTED; if none, UNAVAILABLE+SEARCH_EXHAUSTED.
2) standings: current competition table for both sides, preferably position,matches,points,goalsFor,goalsAgainst,goalDifference. VERIFIED requires at least position,matches,points for both. PARTIAL requires at least one numeric field per side plus SEARCH_EXHAUSTED.
3) headToHead: last 5 completed meetings, exact date, homeTeam, awayTeam, homeGoals, awayGoals, sourceRef. VERIFIED exactly 5; 1-4 PARTIAL+SEARCH_EXHAUSTED; zero UNAVAILABLE+SEARCH_EXHAUSTED.
4) squadAvailability: source-backed injuries, suspensions, goalkeeper/key-attacker absences, rotation or lineup changes for both sides as arrays of {fact,sourceRef}. If no reliable facts for either side after search, UNAVAILABLE+SEARCH_EXHAUSTED.
5) schedule: source-backed fixture timing and meaningful scheduling/congestion/travel information. Store factual data only.
6) competitionContext: per-team facts and zero or more tags. Allowed tags only MUST_WIN,KNOCKOUT_ELIMINATION,TITLE_DECIDER,RELEGATION_DECIDER,PROMOTION_DECIDER,TITLE_RACE,RELEGATION_BATTLE,PROMOTION_RACE,QUALIFICATION_RACE,PLAYOFF_RACE,DEAD_RUBBER,ROTATION_EXPECTED,FRIENDLY.

For every source add sourceMetadata {ref,url,retrievedAt,supports${mode==="BACKTEST"?",availableAt":""}}. Every sourceRef in facts must equal one sourceMetadata.ref. Search attempts must contain the real query, attemptedAt, and outcome SOURCE_BACKED_FACTS_FOUND or SEARCH_EXHAUSTED:<short reason>. Do not store xG, probabilities, ratings, PPG calculations, predictions, betting opinions, or derived metrics.

Return ONLY one JSON object with this exact top-level shape:
{"fixtureId":"...","fixture":{"home":"...","away":"...","competition":"...","kickoff":"..."},"researchedAt":"ISO","researchRunId":"...","sourceMetadata":[],"facts":{"form":{},"standings":{},"headToHead":{},"squadAvailability":{},"schedule":{},"competitionContext":{}}}
Use status/sourceRefs/attempts/data/searchExhausted fields inside each category as required. competitionContext data must be {"homeTeam":{"facts":[],"tags":[]},"awayTeam":{"facts":[],"tags":[]}} when available.`;
}

export default async function handler(req,res){
  if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"GET or POST required"});
  if(!await requireFihGitHubOidc(req,res))return;
  if(!OWNER||!REPO||!GH_TOKEN)return res.status(500).json({error:"required GitHub configuration missing"});
  const date=String(req.query?.date||req.body?.date||"").trim();
  const fixtureId=String(req.query?.fixture||req.body?.fixture||"").trim();
  if(!validDate(date)||!fixtureId)return res.status(400).json({error:"valid date and fixture are required"});
  try{
    const [queue,ledger]=await Promise.all([gh("data/research-queue/"+date+".json"),gh("data/run-state/"+date+".json")]);
    if(queue.date!==date||queue.researchRunId!==ledger.researchRunId||!Array.isArray(queue.fixtures))throw new Error("ACTIVE_RESEARCH_QUEUE_IDENTITY_INVALID");
    const mode=queue.mode||"PREDICTION";
    if(!["PREDICTION","BACKTEST"].includes(mode))throw new Error("ACTIVE_RESEARCH_MODE_INVALID");
    if(mode==="BACKTEST"&&!queue.cutoffAt)throw new Error("BACKTEST_RESEARCH_CUTOFF_MISSING");
    const f=queue.fixtures.find(x=>String(x.fixtureId)===fixtureId);
    if(!f)throw new Error("FIXTURE_NOT_IN_ACTIVE_RESEARCH_QUEUE");
    const lf=(ledger.fixtures||[]).find(x=>String(x.id)===fixtureId);
    if(!lf?.eligible)throw new Error("FIXTURE_NOT_ELIGIBLE");
    const nowSast=new Date();
    const raw=String(f.kickoff||"");
    const kickoffIso=/^\d{14}$/.test(raw)?raw.slice(0,4)+"-"+raw.slice(4,6)+"-"+raw.slice(6,8)+"T"+raw.slice(8,10)+":"+raw.slice(10,12)+":"+raw.slice(12,14)+"+02:00":null;
    if(mode==="PREDICTION"&&kickoffIso&&nowSast.getTime()>=new Date(kickoffIso).getTime())return res.status(409).json({error:"PREMATCH_RESEARCH_WINDOW_CLOSED",fixtureId,kickoff:kickoffIso});
    const result=await generateText({
      model:MODEL,
      system:systemPrompt(date,f,queue.researchRunId,kickoffIso||raw,mode,queue.cutoffAt||null),
      prompt:"Perform the required searches now, fetch sources when needed, then return the validated facts-only JSON record.",
      tools:{
        browserbase_search:gateway.tools.browserbaseSearch({numResults:5}),
        browserbase_fetch:gateway.tools.browserbaseFetch({allowRedirects:true})
      },
      stopWhen:isStepCount(24),
      maxOutputTokens:18000
    });
    const record=basicRecordCheck(parseJson(result.text),f,queue.researchRunId);
    if(mode==="BACKTEST"){
      const cutoff=new Date(queue.cutoffAt).getTime();
      for(const sm of record.sourceMetadata){
        if(!sm.availableAt)throw new Error("BACKTEST_SOURCE_AVAILABILITY_MISSING");
        const at=new Date(sm.availableAt).getTime();
        if(!Number.isFinite(at)||at>cutoff)throw new Error("BACKTEST_SOURCE_AFTER_CUTOFF");
      }
    }
    const calls=(result.steps||[]).flatMap(s=>s.toolCalls||[]);
    const searchCalls=calls.filter(c=>String(c.toolName||"").includes("browserbase_search")).length;
    const evidence=collectToolEvidence(result);
    enforceObservedResearch(record,evidence);
    return res.status(200).json({ok:true,date,mode,fixtureId,researchRunId:queue.researchRunId,model:MODEL,searchCalls,observedQueries:evidence.queries.length,observedSources:evidence.urls.length,record});
  }catch(e){
    console.error("FIH_RESEARCH_FIXTURE_ERROR",e);
    return res.status(502).json({error:String(e?.message||e)});
  }
}
