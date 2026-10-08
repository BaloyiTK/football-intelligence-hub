import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import { fihV2, Match, TeamEvidence } from "./fih-probability-v2";
import { validateDailyResearch } from "./research-canonical";

const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),root=process.cwd();

const finite=(v:any)=>{const n=Number(v);return Number.isFinite(n)?n:undefined};
const rate=(v:any)=>{const n=finite(v);return n===undefined?undefined:(n>1?n/100:n)};
const parseMatch=(s:any):Match|null=>{
 if(typeof s!=="string")return null;
 const m=s.trim().match(/^(.+?)\s+(\d+)\s*[-–]\s*(\d+)\s+(.+)$/);
 if(!m)return null;
 return {home:m[1].trim(),homeGoals:Number(m[2]),awayGoals:Number(m[3]),away:m[4].trim()};
};
const matches=(v:any):Match[]=>Array.isArray(v)?v.map(x=>typeof x==="string"?parseMatch(x):x).filter((m:any)=>m&&typeof m.home==="string"&&typeof m.away==="string"&&Number.isFinite(Number(m.homeGoals))&&Number.isFinite(Number(m.awayGoals))).map((m:any)=>({home:m.home,away:m.away,homeGoals:Number(m.homeGoals),awayGoals:Number(m.awayGoals),...(Number.isFinite(Number(m.opponentStrength))?{opponentStrength:Number(m.opponentStrength)}:{})})):[];

export function researchRecordToV2(r:any){
 const form=r.facts?.form?.data||{},homeTeam=r.fixture.home,awayTeam=r.fixture.away;
 const factual=(rows:any[])=>matches((rows||[]).map((m:any)=>({
  home:m.venue==="HOME"?(m.team||""):m.opponent,
  away:m.venue==="HOME"?m.opponent:(m.team||""),
  homeGoals:m.venue==="HOME"?Number(m.goalsFor):Number(m.goalsAgainst),
  awayGoals:m.venue==="HOME"?Number(m.goalsAgainst):Number(m.goalsFor)
 })));
 const homeOverall=(form.homeTeam?.overallLast5||[]).map((m:any)=>({...m,team:homeTeam}));
 const homeVenue=(form.homeTeam?.homeLast5||[]).map((m:any)=>({...m,team:homeTeam}));
 const awayOverall=(form.awayTeam?.overallLast5||[]).map((m:any)=>({...m,team:awayTeam}));
 const awayVenue=(form.awayTeam?.awayLast5||[]).map((m:any)=>({...m,team:awayTeam}));
 const home:TeamEvidence={team:homeTeam,overall:factual(homeOverall),venue:factual(homeVenue)};
 const away:TeamEvidence={team:awayTeam,overall:factual(awayOverall),venue:factual(awayVenue)};
 return {home,away};
}

export function modelFixture(r:any){const input=researchRecordToV2(r),result:any=fihV2(input);return {fixtureId:String(r.fixtureId),fixture:r.fixture,modelVersion:result.version,status:result.status,generatedAt:new Date().toISOString(),inputCounts:{homeOverall:input.home.overall.length,awayOverall:input.away.overall.length,homeVenue:input.home.venue?.length||0,awayVenue:input.away.venue?.length||0},inputCoverage:{home:{ppg:Number.isFinite(input.home.ppg),gd:Number.isFinite(input.home.goalDifferencePerGame),xgFor:Number.isFinite(input.home.xgFor),xgAgainst:Number.isFinite(input.home.xgAgainst),goalsProfile:Number.isFinite(input.home.over25Rate)||Number.isFinite(input.home.bttsRate),rest:Number.isFinite(input.home.restDays)},away:{ppg:Number.isFinite(input.away.ppg),gd:Number.isFinite(input.away.goalDifferencePerGame),xgFor:Number.isFinite(input.away.xgFor),xgAgainst:Number.isFinite(input.away.xgAgainst),goalsProfile:Number.isFinite(input.away.over25Rate)||Number.isFinite(input.away.bttsRate),rest:Number.isFinite(input.away.restDays)}},...result}};

if(process.env.FIH_MODEL_TEST_CHECKPOINT){
 const cp=JSON.parse(fs.readFileSync(path.join(root,process.env.FIH_MODEL_TEST_CHECKPOINT),"utf8")),id=String(process.env.FIH_FIXTURE_ID||""),r=cp.workingRecords?.[id];
 if(!r)throw new Error("MODEL_TEST_FIXTURE_NOT_FOUND "+id);
 console.log(JSON.stringify({testOnly:true,canonical:false,...modelFixture(r)},null,2));
}else{
 const gate=JSON.parse(execFileSync(process.execPath,["node_modules/tsx/dist/cli.mjs","scripts/step3-input-gate.ts","--date",DATE],{cwd:root,encoding:"utf8",env:{...process.env,FIH_DATE:DATE}}));
 if(gate.gate!=="STEP3_INPUT_VERIFIED")throw new Error("STEP3_INPUT_GATE_NOT_VERIFIED");
 const ledger=JSON.parse(fs.readFileSync(path.join(root,"data/run-state",DATE+".json"),"utf8")),ids=ledger.fixtures.filter((f:any)=>f.eligible).map((f:any)=>String(f.id)),v=validateDailyResearch(root,DATE,ids,"PREDICTION",ledger.researchRunId);
 if(v.researchRunId!==ledger.researchRunId||gate.researchRunId!==ledger.researchRunId)throw new Error("STEP3_RESEARCH_GENERATION_MISMATCH");
 const fixtures=v.artifact.fixtures.map(modelFixture),out=path.join(root,"data/model",DATE+".json"),artifact={schema:"fih-daily-model-v2",date:DATE,model:"FIH-V2-RESEARCH",generatedAt:new Date().toISOString(),researchRunId:v.researchRunId,inputResearchHash:gate.inputResearchHash,inputResearchCommit:gate.researchCommit,fixtureCount:fixtures.length,fixtures};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(artifact,null,2)+"\n");
 const check=JSON.parse(fs.readFileSync(out,"utf8")),raw=check.fixtures.map((x:any)=>String(x.fixtureId)),want=[...ids].sort(),got=[...raw].sort();
 if(check.date!==DATE||check.model!=="FIH-V2-RESEARCH"||check.researchRunId!==ledger.researchRunId||check.inputResearchHash!==gate.inputResearchHash||check.inputResearchCommit!==gate.researchCommit||check.fixtureCount!==ids.length||check.fixtures.length!==ids.length||raw.length!==new Set(raw).size||JSON.stringify(want)!==JSON.stringify(got))throw new Error("DAILY_MODEL_PERSIST_VERIFY_FAILED");
 console.log(JSON.stringify({ok:true,date:DATE,fixtures:fixtures.length,researchRunId:v.researchRunId,inputResearchHash:gate.inputResearchHash,inputResearchCommit:gate.researchCommit,canonical:out},null,2));
}
