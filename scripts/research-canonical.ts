import fs from "node:fs";import path from "node:path";
export const REQUIRED=["form","standings","headToHead","squadAvailability","schedule","competitionContext"];
const read=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
const attemptOk=(a:any)=>a&&typeof a.query==="string"&&a.query.trim()&&a.attemptedAt&&typeof a.outcome==="string";
const matchOk=(m:any)=>m&&typeof m==="object"&&m.date&&m.opponent&&["HOME","AWAY"].includes(String(m.venue))&&Number.isFinite(Number(m.goalsFor))&&Number.isFinite(Number(m.goalsAgainst))&&typeof m.sourceRef==="string"&&m.sourceRef.trim();
const factItemOk=(v:any)=>v&&typeof v==="object"&&typeof v.fact==="string"&&v.fact.trim()&&typeof v.sourceRef==="string"&&v.sourceRef.trim();
function factualCategoryOk(v:any){return v&&typeof v==="object"&&["VERIFIED","PARTIAL","UNAVAILABLE"].includes(String(v.status))&&Array.isArray(v.attempts)&&v.attempts.length>0&&v.attempts.every(attemptOk)&&(v.status==="UNAVAILABLE"||(v.data?.homeTeam&&v.data?.awayTeam&&Array.isArray(v.data.homeTeam)&&Array.isArray(v.data.awayTeam)&&v.data.homeTeam.every(factItemOk)&&v.data.awayTeam.every(factItemOk)&&Array.isArray(v.sourceRefs)));}
const genericFactCategoryOk=(v:any)=>v&&typeof v==="object"&&["VERIFIED","PARTIAL","UNAVAILABLE"].includes(String(v.status))&&Array.isArray(v.attempts)&&v.attempts.length>0&&v.attempts.every(attemptOk)&&Array.isArray(v.sourceRefs);
const h2hMatchOk=(m:any)=>m&&typeof m==="object"&&m.date&&typeof m.homeTeam==="string"&&m.homeTeam.trim()&&typeof m.awayTeam==="string"&&m.awayTeam.trim()&&Number.isFinite(Number(m.homeGoals))&&Number.isFinite(Number(m.awayGoals))&&typeof m.sourceRef==="string"&&m.sourceRef.trim();
function headToHeadOk(v:any,strict=false){
 if(!genericFactCategoryOk(v))return false;
 if(!strict)return true;
 const rows=v?.data?.matches;
 if(v.status==="UNAVAILABLE")return v.searchExhausted===true&&(!Array.isArray(rows)||rows.length===0);
 if(!Array.isArray(rows)||rows.length>5||!rows.every(h2hMatchOk))return false;
 const keys=rows.map((m:any)=>[String(m.date),String(m.homeTeam),String(m.awayTeam),String(m.homeGoals),String(m.awayGoals)].join("|"));
 if(keys.length!==new Set(keys).size)return false;
 if(v.status==="VERIFIED")return rows.length===5;
 if(v.status==="PARTIAL")return rows.length>=1&&rows.length<=4&&v.searchExhausted===true;
 return false;
}
const optionalGenericFactCategoryOk=(v:any)=>v===undefined||genericFactCategoryOk(v);
const seriesOk=(rows:any[],venue?:string)=>{
 if(!Array.isArray(rows)||rows.length>5||!rows.every(matchOk))return false;
 if(venue&&rows.some((m:any)=>m.venue!==venue))return false;
 const keys=rows.map((m:any)=>[String(m.date),String(m.opponent),String(m.venue)].join("|"));
 if(keys.length!==new Set(keys).size)return false;
 return true;
};
function formOkLegacy(v:any){
 if(!v||typeof v!=="object"||!["VERIFIED","PARTIAL","UNAVAILABLE"].includes(String(v.status))||!Array.isArray(v.attempts)||!v.attempts.length||!v.attempts.every(attemptOk))return false;
 if(v.status==="UNAVAILABLE")return true;
 const d=v.data;if(!d?.homeTeam||!d?.awayTeam)return false;
 if(!seriesOk(d.homeTeam.overallLast5)||!seriesOk(d.homeTeam.homeLast5,"HOME"))return false;
 if(!seriesOk(d.awayTeam.overallLast5)||!seriesOk(d.awayTeam.awayLast5,"AWAY"))return false;
 return Array.isArray(v.sourceRefs);
}
function formOkStrict(v:any,requiredCount=5){
 if(!formOkLegacy(v))return false;
 if(v.status!=="VERIFIED")return true;
 const d=v.data;
 return d.homeTeam.overallLast5.length===requiredCount&&
   d.homeTeam.homeLast5.length===requiredCount&&
   d.awayTeam.overallLast5.length===requiredCount&&
   d.awayTeam.awayLast5.length===requiredCount;
}

export function validateResearchArtifact(x:any,date:string,eligibleIds:string[],mode:"PREDICTION"|"BACKTEST"){
 if(!["fih-daily-research-v3","fih-daily-research-v4","fih-daily-research-v5"].includes(String(x.schema))||x.date!==date||x.mode!==mode||!Array.isArray(x.fixtures))throw new Error("CANONICAL_DAILY_RESEARCH_IDENTITY_INVALID");
 const strictVenue=["fih-daily-research-v4","fih-daily-research-v5"].includes(String(x.schema));
 const strictH2h=x.schema==="fih-daily-research-v5";
 const ids=x.fixtures.map((r:any)=>String(r.fixtureId));if(ids.length!==new Set(ids).size)throw new Error("CANONICAL_DAILY_RESEARCH_DUPLICATE_FIXTURE");
 const want=[...eligibleIds].sort(),got=[...ids].sort();if(JSON.stringify(want)!==JSON.stringify(got))throw new Error("CANONICAL_DAILY_RESEARCH_COVERAGE_MISMATCH");
 const cutoff=mode==="BACKTEST"?new Date(date+"T04:00:00.000Z").getTime():null;
 for(const r of x.fixtures){
  if(!r.fixture||!r.researchedAt||typeof r.researchRunId!=="string"||!r.researchRunId.trim()||!Array.isArray(r.sourceMetadata)||!r.facts||!(strictVenue?formOkStrict(r.facts.form,5):formOkLegacy(r.facts.form))||!genericFactCategoryOk(r.facts.standings)||!headToHeadOk(r.facts.headToHead,strictH2h)||!factualCategoryOk(r.facts.squadAvailability)||!genericFactCategoryOk(r.facts.schedule)||!factualCategoryOk(r.facts.competitionContext)||!optionalGenericFactCategoryOk(r.facts.opponentStrength)||!optionalGenericFactCategoryOk(r.facts.teamQuality))throw new Error("RESEARCH_RECORD_INCOMPLETE "+r.fixtureId);
  if(r.facts.xg!==undefined)throw new Error("RESEARCH_EXTERNAL_XG_FORBIDDEN "+r.fixtureId);
  const refs=new Set(r.sourceMetadata.map((sm:any)=>String(sm.ref||sm.url)));
  for(const ref of r.facts.form.sourceRefs||[])if(!refs.has(String(ref)))throw new Error("RESEARCH_SOURCE_REF_UNKNOWN "+r.fixtureId);
  for(const k of ["standings","headToHead","schedule"])for(const ref of r.facts[k].sourceRefs||[])if(!refs.has(String(ref)))throw new Error("RESEARCH_CATEGORY_SOURCE_REF_UNKNOWN "+r.fixtureId+" "+k);
  if(strictH2h)for(const m of r.facts.headToHead?.data?.matches||[])if(!refs.has(String(m.sourceRef)))throw new Error("RESEARCH_H2H_MATCH_SOURCE_REF_UNKNOWN "+r.fixtureId);
  for(const k of ["opponentStrength","teamQuality"])if(r.facts[k])for(const ref of r.facts[k].sourceRefs||[])if(!refs.has(String(ref)))throw new Error("RESEARCH_OPTIONAL_CONTEXT_SOURCE_REF_UNKNOWN "+r.fixtureId+" "+k);
  for(const side of ["homeTeam","awayTeam"])for(const key of side==="homeTeam"?["overallLast5","homeLast5"]:["overallLast5","awayLast5"])for(const m of r.facts.form.data?.[side]?.[key]||[])if(!refs.has(String(m.sourceRef)))throw new Error("RESEARCH_MATCH_SOURCE_REF_UNKNOWN "+r.fixtureId);
  for(const k of ["squadAvailability","competitionContext"])for(const item of [...(r.facts[k].data?.homeTeam||[]),...(r.facts[k].data?.awayTeam||[])])if(!refs.has(String(item.sourceRef)))throw new Error("RESEARCH_FACT_SOURCE_REF_UNKNOWN "+r.fixtureId+" "+k);
  for(const sm of r.sourceMetadata){if(!sm||typeof sm.url!=="string"||!/^https?:\/\//.test(sm.url)||!sm.retrievedAt||!Array.isArray(sm.supports))throw new Error("RESEARCH_SOURCE_INVALID "+r.fixtureId);if(mode==="BACKTEST"){if(!sm.availableAt)throw new Error("BACKTEST_SOURCE_AVAILABILITY_UNVERIFIED "+r.fixtureId);const a=new Date(sm.availableAt).getTime();if(!Number.isFinite(a)||a>cutoff!)throw new Error("BACKTEST_SOURCE_AFTER_CUTOFF "+r.fixtureId);}}
 }
 const runIds=new Set(x.fixtures.map((r:any)=>String(r.researchRunId)));if(runIds.size!==1)throw new Error("CANONICAL_DAILY_RESEARCH_MIXED_RUNS");if(typeof x.researchRunId!=="string"||!x.researchRunId.trim()||!runIds.has(String(x.researchRunId)))throw new Error("CANONICAL_DAILY_RESEARCH_RUN_ID_INVALID");
 return {artifact:x,count:ids.length,researchRunId:x.researchRunId};
}
export function validateDailyResearch(root:string,date:string,eligibleIds:string[],mode:"PREDICTION"|"BACKTEST",expectedResearchRunId?:string){
 const p=path.join(root,mode==="BACKTEST"?"data/backtest/research":"data/research",date+".json");if(!fs.existsSync(p))throw new Error("CANONICAL_DAILY_RESEARCH_MISSING "+p);
 const x=read(p);const v=validateResearchArtifact(x,date,eligibleIds,mode);if(expectedResearchRunId&&v.researchRunId!==expectedResearchRunId)throw new Error("CANONICAL_DAILY_RESEARCH_STALE_GENERATION");return {path,...v};
}
