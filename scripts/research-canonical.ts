import fs from "node:fs";import path from "node:path";
export const REQUIRED=["form","standings","headToHead","squadAvailability","schedule","competitionContext"];
const read=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
const attemptOk=(a:any)=>a&&typeof a.query==="string"&&a.query.trim()&&a.attemptedAt&&typeof a.outcome==="string";
const matchOk=(m:any)=>m&&typeof m==="object"&&m.date&&m.opponent&&["HOME","AWAY"].includes(String(m.venue))&&Number.isFinite(Number(m.goalsFor))&&Number.isFinite(Number(m.goalsAgainst))&&typeof m.sourceRef==="string"&&m.sourceRef.trim();
const factItemOk=(v:any)=>v&&typeof v==="object"&&typeof v.fact==="string"&&v.fact.trim()&&typeof v.sourceRef==="string"&&v.sourceRef.trim();
function factualCategoryOk(v:any){return v&&typeof v==="object"&&["VERIFIED","PARTIAL","UNAVAILABLE"].includes(String(v.status))&&Array.isArray(v.attempts)&&v.attempts.length>0&&v.attempts.every(attemptOk)&&(v.status==="UNAVAILABLE"||(v.data?.homeTeam&&v.data?.awayTeam&&Array.isArray(v.data.homeTeam)&&Array.isArray(v.data.awayTeam)&&v.data.homeTeam.every(factItemOk)&&v.data.awayTeam.every(factItemOk)&&Array.isArray(v.sourceRefs)));}
const genericFactCategoryOk=(v:any)=>v&&typeof v==="object"&&["VERIFIED","PARTIAL","UNAVAILABLE"].includes(String(v.status))&&Array.isArray(v.attempts)&&v.attempts.length>0&&v.attempts.every(attemptOk)&&Array.isArray(v.sourceRefs);
function xgOk(v:any){
 if(v===undefined)return true;
 if(!v||typeof v!=="object"||!["VERIFIED","PARTIAL","UNAVAILABLE"].includes(String(v.status))||!Array.isArray(v.attempts)||!v.attempts.length||!v.attempts.every(attemptOk))return false;
 if(v.status==="UNAVAILABLE")return true;
 if(v.evidenceType!=="OBSERVED_COMPLETED_MATCH_STATISTICS")return false;
 const d=v.data;if(!d?.homeTeam||!d?.awayTeam||!Array.isArray(v.sourceRefs)||!v.sourceRefs.length)return false;
 const sideOk=(s:any)=>{const n=s?.overall&&typeof s.overall==="object"?s.overall:s;return n&&Number.isFinite(Number(n.xgFor))&&Number.isFinite(Number(n.xgAgainst));};
 return sideOk(d.homeTeam)&&sideOk(d.awayTeam);
}
function formOk(v:any){
 if(!v||typeof v!=="object"||!["VERIFIED","PARTIAL","UNAVAILABLE"].includes(String(v.status))||!Array.isArray(v.attempts)||!v.attempts.length||!v.attempts.every(attemptOk))return false;
 if(v.status==="UNAVAILABLE")return true;
 const d=v.data;if(!d?.homeTeam||!d?.awayTeam)return false;
 for(const key of ["overallLast5","homeLast5"])if(!Array.isArray(d.homeTeam[key])||!d.homeTeam[key].every(matchOk))return false;
 for(const key of ["overallLast5","awayLast5"])if(!Array.isArray(d.awayTeam[key])||!d.awayTeam[key].every(matchOk))return false;
 return Array.isArray(v.sourceRefs);
}
export function validateResearchArtifact(x:any,date:string,eligibleIds:string[],mode:"PREDICTION"|"BACKTEST"){
 if(x.schema!=="fih-daily-research-v3"||x.date!==date||x.mode!==mode||!Array.isArray(x.fixtures))throw new Error("CANONICAL_DAILY_RESEARCH_IDENTITY_INVALID");
 const ids=x.fixtures.map((r:any)=>String(r.fixtureId));if(ids.length!==new Set(ids).size)throw new Error("CANONICAL_DAILY_RESEARCH_DUPLICATE_FIXTURE");
 const want=[...eligibleIds].sort(),got=[...ids].sort();if(JSON.stringify(want)!==JSON.stringify(got))throw new Error("CANONICAL_DAILY_RESEARCH_COVERAGE_MISMATCH");
 const cutoff=mode==="BACKTEST"?new Date(date+"T04:00:00.000Z").getTime():null;
 for(const r of x.fixtures){
  if(!r.fixture||!r.researchedAt||typeof r.researchRunId!=="string"||!r.researchRunId.trim()||!Array.isArray(r.sourceMetadata)||!r.facts||!formOk(r.facts.form)||!genericFactCategoryOk(r.facts.standings)||!genericFactCategoryOk(r.facts.headToHead)||!factualCategoryOk(r.facts.squadAvailability)||!genericFactCategoryOk(r.facts.schedule)||!factualCategoryOk(r.facts.competitionContext)||!xgOk(r.facts.xg))throw new Error("RESEARCH_RECORD_INCOMPLETE "+r.fixtureId);
  const refs=new Set(r.sourceMetadata.map((sm:any)=>String(sm.ref||sm.url)));
  for(const ref of r.facts.form.sourceRefs||[])if(!refs.has(String(ref)))throw new Error("RESEARCH_SOURCE_REF_UNKNOWN "+r.fixtureId);
  for(const k of ["standings","headToHead","schedule"])for(const ref of r.facts[k].sourceRefs||[])if(!refs.has(String(ref)))throw new Error("RESEARCH_CATEGORY_SOURCE_REF_UNKNOWN "+r.fixtureId+" "+k);
  for(const side of ["homeTeam","awayTeam"])for(const key of side==="homeTeam"?["overallLast5","homeLast5"]:["overallLast5","awayLast5"])for(const m of r.facts.form.data?.[side]?.[key]||[])if(!refs.has(String(m.sourceRef)))throw new Error("RESEARCH_MATCH_SOURCE_REF_UNKNOWN "+r.fixtureId);
  for(const k of ["squadAvailability","competitionContext"])for(const item of [...(r.facts[k].data?.homeTeam||[]),...(r.facts[k].data?.awayTeam||[])])if(!refs.has(String(item.sourceRef)))throw new Error("RESEARCH_FACT_SOURCE_REF_UNKNOWN "+r.fixtureId+" "+k);
  if(r.facts.xg&&r.facts.xg.status!=="UNAVAILABLE")for(const ref of r.facts.xg.sourceRefs||[])if(!refs.has(String(ref)))throw new Error("RESEARCH_XG_SOURCE_REF_UNKNOWN "+r.fixtureId);
  for(const sm of r.sourceMetadata){if(!sm||typeof sm.url!=="string"||!/^https?:\/\//.test(sm.url)||!sm.retrievedAt||!Array.isArray(sm.supports))throw new Error("RESEARCH_SOURCE_INVALID "+r.fixtureId);if(mode==="BACKTEST"){if(!sm.availableAt)throw new Error("BACKTEST_SOURCE_AVAILABILITY_UNVERIFIED "+r.fixtureId);const a=new Date(sm.availableAt).getTime();if(!Number.isFinite(a)||a>cutoff!)throw new Error("BACKTEST_SOURCE_AFTER_CUTOFF "+r.fixtureId);}}
 }
 const runIds=new Set(x.fixtures.map((r:any)=>String(r.researchRunId)));if(runIds.size!==1)throw new Error("CANONICAL_DAILY_RESEARCH_MIXED_RUNS");if(typeof x.researchRunId!=="string"||!x.researchRunId.trim()||!runIds.has(String(x.researchRunId)))throw new Error("CANONICAL_DAILY_RESEARCH_RUN_ID_INVALID");
 return {artifact:x,count:ids.length,researchRunId:x.researchRunId};
}
export function validateDailyResearch(root:string,date:string,eligibleIds:string[],mode:"PREDICTION"|"BACKTEST",expectedResearchRunId?:string){
 const p=path.join(root,mode==="BACKTEST"?"data/backtest/research":"data/research",date+".json");if(!fs.existsSync(p))throw new Error("CANONICAL_DAILY_RESEARCH_MISSING "+p);
 const x=read(p);const v=validateResearchArtifact(x,date,eligibleIds,mode);if(expectedResearchRunId&&v.researchRunId!==expectedResearchRunId)throw new Error("CANONICAL_DAILY_RESEARCH_STALE_GENERATION");return {path,...v};
}
