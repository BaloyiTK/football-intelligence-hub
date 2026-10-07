import fs from "node:fs";import path from "node:path";
export const REQUIRED=["overallForm","venueForm","xgXga","leaguePosition","teamQuality","motivationContext","h2h","goalsProfile","squadAvailability","opponentStrength","restSchedule"];
const read=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
function categoryOk(v:any){return v&&typeof v==="object"&&["VERIFIED","PARTIAL","UNAVAILABLE"].includes(String(v.status))&&Array.isArray(v.attempts)&&v.attempts.length>0&&v.attempts.every((a:any)=>a&&typeof a.query==="string"&&a.query.trim()&&a.attemptedAt&&typeof a.outcome==="string"&&a.outcome!=="NOT_SEARCHED_BY_DIRECT_EXTRACTOR");}
export function validateDailyResearch(root:string,date:string,eligibleIds:string[],mode:"PREDICTION"|"BACKTEST"){
 const p=path.join(root,mode==="BACKTEST"?"data/backtest/research":"data/research",date+".json");
 if(!fs.existsSync(p))throw new Error("CANONICAL_DAILY_RESEARCH_MISSING "+p);
 const x=read(p);if(x.schema!=="fih-daily-research-v2"||x.date!==date||x.mode!==mode||!Array.isArray(x.fixtures))throw new Error("CANONICAL_DAILY_RESEARCH_IDENTITY_INVALID");
 const ids=x.fixtures.map((r:any)=>String(r.fixtureId));if(ids.length!==new Set(ids).size)throw new Error("CANONICAL_DAILY_RESEARCH_DUPLICATE_FIXTURE");
 const want=[...eligibleIds].sort(),got=[...ids].sort();if(JSON.stringify(want)!==JSON.stringify(got))throw new Error("CANONICAL_DAILY_RESEARCH_COVERAGE_MISMATCH");
 const cutoff=mode==="BACKTEST"?new Date(date+"T04:00:00.000Z").getTime():null;
 for(const r of x.fixtures){
  if(!r.fixture||!r.researchedAt||!Array.isArray(r.sourceMetadata)||!r.evidence)throw new Error("RESEARCH_RECORD_INCOMPLETE "+r.fixtureId);
  for(const k of REQUIRED){const c=r.evidence[k];if(!categoryOk(c))throw new Error("RESEARCH_CATEGORY_INVALID "+r.fixtureId+" "+k);if(!Array.isArray(c.attempts)||c.attempts.length<1)throw new Error("RESEARCH_CATEGORY_ATTEMPTS_MISSING "+r.fixtureId+" "+k);if(c.status==="UNAVAILABLE"&&c.attempts.length<1)throw new Error("RESEARCH_UNAVAILABLE_UNJUSTIFIED "+r.fixtureId+" "+k);if(c.status!=="UNAVAILABLE"&&!Array.isArray(c.sourceRefs))throw new Error("RESEARCH_CATEGORY_SOURCE_REFS_MISSING "+r.fixtureId+" "+k);}
  const refs=new Set(r.sourceMetadata.map((s:any)=>String(s.ref||s.url)));for(const k of REQUIRED){const c=r.evidence[k];for(const ref of c.sourceRefs||[])if(!refs.has(String(ref)))throw new Error("RESEARCH_CATEGORY_SOURCE_REF_UNKNOWN "+r.fixtureId+" "+k);} for(const s of r.sourceMetadata){if(!s||typeof s.url!=="string"||!/^https?:\/\//.test(s.url)||!s.retrievedAt||!Array.isArray(s.supports))throw new Error("RESEARCH_SOURCE_INVALID "+r.fixtureId);if(mode==="BACKTEST"){if(!s.availableAt)throw new Error("BACKTEST_SOURCE_AVAILABILITY_UNVERIFIED "+r.fixtureId);const a=new Date(s.availableAt).getTime();if(!Number.isFinite(a)||a>cutoff!)throw new Error("BACKTEST_SOURCE_AFTER_CUTOFF "+r.fixtureId);}}
 }
 return {path:p,artifact:x,count:ids.length};
}
