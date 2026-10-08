import fs from "node:fs";import path from "node:path";
export const REQUIRED=["form"];
const read=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
const attemptOk=(a:any)=>a&&typeof a.query==="string"&&a.query.trim()&&a.attemptedAt&&typeof a.outcome==="string";
const matchOk=(m:any)=>m&&typeof m==="object"&&m.date&&m.opponent&&["HOME","AWAY"].includes(String(m.venue))&&Number.isFinite(Number(m.goalsFor))&&Number.isFinite(Number(m.goalsAgainst))&&typeof m.sourceRef==="string"&&m.sourceRef.trim();
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
  if(!r.fixture||!r.researchedAt||!Array.isArray(r.sourceMetadata)||!r.evidence||!formOk(r.evidence.form))throw new Error("RESEARCH_RECORD_INCOMPLETE "+r.fixtureId);
  const refs=new Set(r.sourceMetadata.map((sm:any)=>String(sm.ref||sm.url)));
  for(const ref of r.evidence.form.sourceRefs||[])if(!refs.has(String(ref)))throw new Error("RESEARCH_SOURCE_REF_UNKNOWN "+r.fixtureId);
  for(const side of ["homeTeam","awayTeam"])for(const key of side==="homeTeam"?["overallLast5","homeLast5"]:["overallLast5","awayLast5"])for(const m of r.evidence.form.data?.[side]?.[key]||[])if(!refs.has(String(m.sourceRef)))throw new Error("RESEARCH_MATCH_SOURCE_REF_UNKNOWN "+r.fixtureId);
  for(const sm of r.sourceMetadata){if(!sm||typeof sm.url!=="string"||!/^https?:\/\//.test(sm.url)||!sm.retrievedAt||!Array.isArray(sm.supports))throw new Error("RESEARCH_SOURCE_INVALID "+r.fixtureId);if(mode==="BACKTEST"){if(!sm.availableAt)throw new Error("BACKTEST_SOURCE_AVAILABILITY_UNVERIFIED "+r.fixtureId);const a=new Date(sm.availableAt).getTime();if(!Number.isFinite(a)||a>cutoff!)throw new Error("BACKTEST_SOURCE_AFTER_CUTOFF "+r.fixtureId);}}
 }
 return {artifact:x,count:ids.length};
}
export function validateDailyResearch(root:string,date:string,eligibleIds:string[],mode:"PREDICTION"|"BACKTEST"){
 const p=path.join(root,mode==="BACKTEST"?"data/backtest/research":"data/research",date+".json");if(!fs.existsSync(p))throw new Error("CANONICAL_DAILY_RESEARCH_MISSING "+p);
 const x=read(p);const v=validateResearchArtifact(x,date,eligibleIds,mode);return {path,...v};
}
