import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import { fihV2 } from "./fih-probability-v2";
import { normalizeResearchRecord } from "./step3-normalize";
import { validateDailyResearch } from "./research-canonical";

const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),root=process.cwd();

export function researchRecordToV2(r:any){
 const normalized=normalizeResearchRecord(r);
 return normalized.input;
}

export function modelFixture(r:any){
 const normalized=normalizeResearchRecord(r),input=normalized.input,result:any=fihV2(input);
 return {
  fixtureId:String(r.fixtureId),
  fixture:r.fixture,
  modelVersion:result.version,
  status:result.status,
  generatedAt:new Date().toISOString(),
  inputCounts:{
   homeOverall:input.home.overall.length,
   awayOverall:input.away.overall.length,
   homeVenue:input.home.venue?.length||0,
   awayVenue:input.away.venue?.length||0,
   h2h:input.h2h?.length||0
  },
  inputCoverage:{
   home:{
    ppg:Number.isFinite(input.home.ppg),
    gd:Number.isFinite(input.home.goalDifferencePerGame),
    goalsProfile:Number.isFinite(input.home.over25Rate)||Number.isFinite(input.home.bttsRate),
    resultOverall:input.home.overall.length>0,
    resultVenue:(input.home.venue?.length||0)===5,
    rest:Number.isFinite(input.home.restDays),
    motivation:Number.isFinite(input.home.motivation)
   },
   away:{
    ppg:Number.isFinite(input.away.ppg),
    gd:Number.isFinite(input.away.goalDifferencePerGame),
    goalsProfile:Number.isFinite(input.away.over25Rate)||Number.isFinite(input.away.bttsRate),
    resultOverall:input.away.overall.length>0,
    resultVenue:(input.away.venue?.length||0)===5,
    rest:Number.isFinite(input.away.restDays),
    motivation:Number.isFinite(input.away.motivation)
   },
   shared:{h2h:(input.h2h?.length||0)===5}
  },
  evidenceUsage:normalized.usage,
  ...result
 };
}

if(process.env.FIH_MODEL_TEST_CHECKPOINT){
 const cp=JSON.parse(fs.readFileSync(path.join(root,process.env.FIH_MODEL_TEST_CHECKPOINT),"utf8")),id=String(process.env.FIH_FIXTURE_ID||""),r=cp.workingRecords?.[id];
 if(!r)throw new Error("MODEL_TEST_FIXTURE_NOT_FOUND "+id);
 console.log(JSON.stringify({testOnly:true,canonical:false,...modelFixture(r)},null,2));
}else{
 const gate=JSON.parse(execFileSync(process.execPath,["node_modules/tsx/dist/cli.mjs","scripts/step3-input-gate.ts","--date",DATE],{cwd:root,encoding:"utf8",env:{...process.env,FIH_DATE:DATE}}));
 if(gate.gate!=="STEP3_INPUT_VERIFIED")throw new Error("STEP3_INPUT_GATE_NOT_VERIFIED");
 const ledger=JSON.parse(fs.readFileSync(path.join(root,"data/run-state",DATE+".json"),"utf8")),ids=ledger.fixtures.filter((f:any)=>f.eligible).map((f:any)=>String(f.id)),v=validateDailyResearch(root,DATE,ids,"PREDICTION",ledger.researchRunId);
 if(v.researchRunId!==ledger.researchRunId||gate.researchRunId!==ledger.researchRunId)throw new Error("STEP3_RESEARCH_GENERATION_MISMATCH");
 const fixtures=v.artifact.fixtures.map(modelFixture);
 const coverageSummary:any={
  calculated:fixtures.filter((f:any)=>f.status==="CALCULATED").length,
  insufficientData:fixtures.filter((f:any)=>f.status==="INSUFFICIENT_DATA").length,
  home:{ppg:0,gd:0,goalsProfile:0,resultOverall:0,resultVenue:0,rest:0,motivation:0},
  away:{ppg:0,gd:0,goalsProfile:0,resultOverall:0,resultVenue:0,rest:0,motivation:0},
  shared:{h2h:0},
  contextOnly:{headToHead:0,squadAvailability:0,competitionContext:0,teamQuality:0,opponentStrength:0}
 };
 for(const f of fixtures){
  for(const side of ["home","away"]){
   const q=f.inputCoverage?.[side]||{};
   if(q.ppg)coverageSummary[side].ppg++;
   if(q.gd)coverageSummary[side].gd++;
   if(q.goalsProfile)coverageSummary[side].goalsProfile++;
   if(q.resultOverall)coverageSummary[side].resultOverall++;
   if(q.resultVenue)coverageSummary[side].resultVenue++;
   if(q.rest)coverageSummary[side].rest++;
  }
  if(f.inputCoverage?.shared?.h2h)coverageSummary.shared.h2h++;
  for(const k of Object.keys(coverageSummary.contextOnly))if(f.evidenceUsage?.shared?.[k]?.status==="CONTEXT_ONLY")coverageSummary.contextOnly[k]++;
 }
 const out=path.join(root,"data/model",DATE+".json"),artifact={schema:"fih-daily-model-v2",date:DATE,model:"FIH-V2-RESEARCH",generatedAt:new Date().toISOString(),researchRunId:v.researchRunId,inputResearchHash:gate.inputResearchHash,inputResearchCommit:gate.researchCommit,fixtureCount:fixtures.length,coverageSummary,fixtures};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(artifact,null,2)+"\n");
 const check=JSON.parse(fs.readFileSync(out,"utf8")),raw=check.fixtures.map((x:any)=>String(x.fixtureId)),want=[...ids].sort(),got=[...raw].sort();
 if(check.date!==DATE||check.model!=="FIH-V2-RESEARCH"||check.researchRunId!==ledger.researchRunId||check.inputResearchHash!==gate.inputResearchHash||check.inputResearchCommit!==gate.researchCommit||check.fixtureCount!==ids.length||check.fixtures.length!==ids.length||!check.coverageSummary||raw.length!==new Set(raw).size||JSON.stringify(want)!==JSON.stringify(got))throw new Error("DAILY_MODEL_PERSIST_VERIFY_FAILED");
 console.log(JSON.stringify({ok:true,date:DATE,fixtures:fixtures.length,researchRunId:v.researchRunId,inputResearchHash:gate.inputResearchHash,inputResearchCommit:gate.researchCommit,coverageSummary,canonical:out},null,2));
}
