export const config={maxDuration:300};

const REQUIRED=["form","standings","headToHead","squadAvailability","schedule","competitionContext"];
const MODEL=process.env.FIH_RESEARCH_MODEL||"openai/gpt-5.6-sol";
const GATEWAY="https://ai-gateway.vercel.sh/v1/responses";

const isObj=x=>x&&typeof x==="object"&&!Array.isArray(x);
const asArray=x=>Array.isArray(x)?x:[];
const now=()=>new Date().toISOString();

function outputText(response){
  for(const item of asArray(response?.output)){
    if(item?.type!=="message")continue;
    for(const part of asArray(item.content))if(part?.type==="output_text"&&typeof part.text==="string")return part.text;
  }
  return "";
}
function collectEvidence(response){
  const queries=new Set(),urls=new Set();
  const visit=v=>{
    if(!v)return;
    if(Array.isArray(v)){for(const x of v)visit(x);return;}
    if(typeof v!=="object")return;
    if(typeof v.query==="string"&&v.query.trim())queries.add(v.query.trim());
    if(Array.isArray(v.queries))for(const q of v.queries)if(typeof q==="string"&&q.trim())queries.add(q.trim());
    if(typeof v.url==="string"&&/^https?:\/\//i.test(v.url))urls.add(v.url);
    for(const x of Object.values(v))visit(x);
  };
  for(const item of asArray(response?.output))if(item?.type==="web_search_call")visit(item);
  return {queries:[...queries],urls:[...urls]};
}
function categoryShape(name){
  if(name==="form")return "{status,searchExhausted,attempts,sourceRefs,data:{homeTeam:{overallLast5:[{date,opponent,venue,goalsFor,goalsAgainst,sourceRef}],homeLast5:[same]},awayTeam:{overallLast5:[same],awayLast5:[same]}}}";
  if(name==="standings")return "{status,searchExhausted,attempts,sourceRefs,data:{homeTeam:{position,matches,points,goalsFor,goalsAgainst,goalDifference},awayTeam:{position,matches,points,goalsFor,goalsAgainst,goalDifference}}}";
  if(name==="headToHead")return "{status,searchExhausted,attempts,sourceRefs,data:{matches:[{date,homeTeam,awayTeam,homeGoals,awayGoals,sourceRef}]}}";
  if(name==="squadAvailability")return "{status,searchExhausted,attempts,sourceRefs,data:{homeTeam:[{fact,sourceRef}],awayTeam:[{fact,sourceRef}]}}";
  if(name==="competitionContext")return "{status,searchExhausted,attempts,sourceRefs,data:{homeTeam:{facts:[{fact,sourceRef}],tags:[]},awayTeam:{facts:[{fact,sourceRef}],tags:[]}}}";
  return "{status,searchExhausted,attempts,sourceRefs,data:{homeTeam:[{fact,sourceRef}],awayTeam:[{fact,sourceRef}]}}";
}
function prompt(job){
  const cutoff=job.mode==="BACKTEST"?`Only retain evidence verifiably available at or before ${job.cutoffAt}. Every retained sourceMetadata item MUST include availableAt <= cutoff.`:"Use only information available at execution time.";
  return `Research this football fixture for FIH Step 2. You are the authoritative ChatGPT web-research executor. You MUST actually use web search for EVERY required category. Return ONE JSON object only; never make a prediction.

Fixture:
${JSON.stringify(job.fixture)}
date=${job.date}
mode=${job.mode}
researchRunId=${job.researchRunId}
${cutoff}

Integrity rules:
- Research BOTH teams.
- Required categories: ${REQUIRED.join(", ")} plus optional factual opponentStrength and teamQuality when source-backed.
- For form, target exactly 5 overall matches for each team, exactly 5 HOME matches for the home team, and exactly 5 AWAY matches for the away team.
- For headToHead, target exactly 5 completed meetings with date, teams, score and sourceRef.
- VERIFIED form requires all four exact-five series. VERIFIED H2H requires exactly 5 rows.
- PARTIAL or UNAVAILABLE is allowed only after genuine category-specific search exhaustion. Set searchExhausted=true and include an attempt outcome containing SEARCH_EXHAUSTED.
- Each category attempt query MUST be a query you actually sent to web search in this response. Do not invent attempts.
- sourceRef MUST be the exact source URL. sourceRefs must use URLs present in sourceMetadata.
- Every sourceMetadata URL must come from the web-search sources used in this response.
- Store raw facts only. Do not calculate PPG, rates, strength scores, xG, probabilities, fair odds or betting conclusions.
- competitionContext tags may only be MUST_WIN,KNOCKOUT_ELIMINATION,TITLE_DECIDER,RELEGATION_DECIDER,PROMOTION_DECIDER,TITLE_RACE,RELEGATION_BATTLE,PROMOTION_RACE,QUALIFICATION_RACE,PLAYOFF_RACE,DEAD_RUBBER,ROTATION_EXPECTED,FRIENDLY.
- attempts items are {query,attemptedAt,outcome}. Use factual outcomes such as SOURCE_BACKED or SEARCH_EXHAUSTED, never SEARCH_COMPLETE or CHATGPT_*_COMPLETED markers.
- sourceMetadata items are {ref,url,title,retrievedAt,supports${job.mode==="BACKTEST"?",availableAt":""}}. Use ref=url.

Return this top-level shape:
{
 "fixtureId":"${job.fixture.fixtureId}",
 "fixture":${JSON.stringify({home:job.fixture.home,away:job.fixture.away,competition:job.fixture.competition,kickoff:job.fixture.kickoff})},
 "researchedAt":"ISO",
 "researchRunId":"${job.researchRunId}",
 "sourceMetadata":[],
 "facts":{
   "form":${categoryShape("form")},
   "standings":${categoryShape("standings")},
   "headToHead":${categoryShape("headToHead")},
   "squadAvailability":${categoryShape("squadAvailability")},
   "schedule":${categoryShape("schedule")},
   "competitionContext":${categoryShape("competitionContext")},
   "opponentStrength":${categoryShape("schedule")},
   "teamQuality":${categoryShape("schedule")}
 }
}
If a category has zero trustworthy evidence after real searches, use UNAVAILABLE with empty data/sourceRefs and genuine SEARCH_EXHAUSTED attempts.`;
}
function normalize(record,job){
  if(!isObj(record))throw new Error("RESEARCH_OUTPUT_NOT_OBJECT");
  record.fixtureId=String(job.fixture.fixtureId);
  record.fixture={home:job.fixture.home,away:job.fixture.away,competition:job.fixture.competition,kickoff:job.fixture.kickoff};
  record.researchRunId=job.researchRunId;
  record.researchedAt=now();
  record.sourceMetadata=asArray(record.sourceMetadata).map(s=>({...s,ref:String(s?.url||s?.ref||""),url:String(s?.url||""),retrievedAt:now(),supports:asArray(s?.supports)}));
  return record;
}
function enforceProvenance(record,evidence){
  if(evidence.queries.length<REQUIRED.length)throw new Error("INSUFFICIENT_CATEGORY_SPECIFIC_WEB_SEARCHES "+evidence.queries.length);
  const querySet=new Set(evidence.queries.map(String));
  const sourceSet=new Set(evidence.urls.map(String));
  for(const k of REQUIRED){
    const c=record?.facts?.[k];
    if(!isObj(c)||!Array.isArray(c.attempts)||c.attempts.length<1)throw new Error("CATEGORY_ATTEMPTS_MISSING "+k);
    if(!c.attempts.some(a=>querySet.has(String(a?.query||"").trim())))throw new Error("CATEGORY_ATTEMPT_NOT_OBSERVED_WEB_QUERY "+k);
    if(["PARTIAL","UNAVAILABLE"].includes(String(c.status))){
      if(c.searchExhausted!==true||!c.attempts.some(a=>/SEARCH_EXHAUSTED/i.test(String(a?.outcome||""))))throw new Error("CATEGORY_EXHAUSTION_INVALID "+k);
    }
  }
  if(!Array.isArray(record.sourceMetadata))throw new Error("SOURCE_METADATA_MISSING");
  for(const s of record.sourceMetadata){
    if(!/^https?:\/\//i.test(String(s?.url||"")))throw new Error("SOURCE_METADATA_URL_INVALID");
    if(sourceSet.size&&!sourceSet.has(String(s.url)))throw new Error("SOURCE_NOT_OBSERVED_IN_WEB_SEARCH "+s.url);
  }
}
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"POST required"});
  const job=req.body||{};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(job.date||""))||!["PREDICTION","BACKTEST"].includes(job.mode)||!job.researchRunId||!isObj(job.fixture)||!job.fixture.fixtureId||!job.fixture.home||!job.fixture.away)return res.status(400).json({error:"invalid research job"});
  if(job.mode==="BACKTEST"&&!job.cutoffAt)return res.status(400).json({error:"BACKTEST cutoffAt required"});
  const token=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;
  if(!token)return res.status(500).json({error:"AI_GATEWAY_AUTH_MISSING"});
  const body={
    model:MODEL,
    reasoning:{effort:"medium"},
    tools:[{type:"web_search",external_web_access:true,search_context_size:"medium"}],
    tool_choice:"required",
    include:["web_search_call.action.sources"],
    text:{format:{type:"json_object"}},
    max_output_tokens:18000,
    input:[
      {role:"system",content:"You execute FIH Step 2 factual football research. Use live web search and output strict JSON only. Never fabricate evidence."},
      {role:"user",content:prompt(job)}
    ]
  };
  let response;
  try{
    const r=await fetch(GATEWAY,{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(body)});
    const text=await r.text();
    if(!r.ok)return res.status(502).json({error:"AI_GATEWAY_REQUEST_FAILED",status:r.status,detail:text.slice(0,2000)});
    response=JSON.parse(text);
  }catch(e){return res.status(502).json({error:"AI_GATEWAY_TRANSPORT_FAILED",detail:String(e)})}
  const evidence=collectEvidence(response);
  if(!evidence.queries.length)return res.status(502).json({error:"NO_OBSERVED_WEB_SEARCH"});
  const raw=outputText(response);
  let record;
  try{record=normalize(JSON.parse(raw),job);enforceProvenance(record,evidence)}
  catch(e){return res.status(422).json({error:"RESEARCH_OUTPUT_VALIDATION_FAILED",detail:String(e),observedQueries:evidence.queries.length,observedSources:evidence.urls.length})}
  return res.status(200).json({ok:true,model:response.model||MODEL,webSearchQueries:evidence.queries.length,webSearchSources:evidence.urls.length,record});
}

export {collectEvidence,enforceProvenance,normalize,prompt};
