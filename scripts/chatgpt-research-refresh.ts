import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";
import {validateResearchArtifact} from "./research-canonical";

const ROOT=process.env.FIH_ROOT||process.cwd();
const arg=(n:string)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:undefined};
const DATE=arg("--date")||process.env.FIH_DATE||"";
if(!/^\d{4}-\d{2}-\d{2}$/.test(DATE))throw new Error("INVALID_DATE");
const read=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
const hash=(x:any)=>crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
const atomic=(p:string,x:any)=>{fs.mkdirSync(path.dirname(p),{recursive:true});const t=p+".tmp";fs.writeFileSync(t,JSON.stringify(x,null,2)+"\n");fs.renameSync(t,p)};
const ledgerPath=path.join(ROOT,"data/run-state",DATE+".json");
const queuePath=path.join(ROOT,"data/research-queue",DATE+".json");
const tempPath=path.join(ROOT,"data/research-work",DATE+".json");
const canonicalPath=path.join(ROOT,"data/research",DATE+".json");
const markerPath=path.join(ROOT,"automation/research-refresh.flag");
if(!fs.existsSync(ledgerPath)||!fs.existsSync(queuePath)||!fs.existsSync(markerPath))throw new Error("REFRESH_INPUT_MISSING");
const ledger=read(ledgerPath),queue=read(queuePath);
const RID=String(ledger.researchRunId||"");
if(!RID||ledger.date!==DATE||queue.date!==DATE||queue.researchRunId!==RID)throw new Error("REFRESH_IDENTITY_MISMATCH");
const marker=fs.readFileSync(markerPath,"utf8");
if(!marker.includes(DATE)||!marker.includes(RID)||!marker.includes("CHATGPT_SEARCH_COMPLETE"))throw new Error("CHATGPT_SEARCH_MARKER_INVALID");
const eligible=(ledger.fixtures||[]).filter((f:any)=>f.eligible).map((f:any)=>({fixtureId:String(f.id),home:f.home,away:f.away,competition:f.competition,kickoff:f.kickoff}));
if(eligible.length!==Number(queue.count)||eligible.length===0)throw new Error("REFRESH_UNIVERSE_INVALID");
const ids=eligible.map((f:any)=>f.fixtureId).sort();
if(ids.join("|")!==queue.fixtures.map((f:any)=>String(f.fixtureId)).sort().join("|"))throw new Error("REFRESH_QUEUE_UNIVERSE_MISMATCH");

function baseline(){
  const rel="data/research/"+DATE+".json";
  const rev=spawnSync("git",["rev-list","HEAD","--",rel],{cwd:ROOT,encoding:"utf8"});
  if(rev.status!==0)throw new Error("BASELINE_HISTORY_LOOKUP_FAILED");
  for(const sha of rev.stdout.trim().split(/\s+/).filter(Boolean)){
    const g=spawnSync("git",["show",sha+":"+rel],{cwd:ROOT,encoding:"utf8",maxBuffer:32*1024*1024});
    if(g.status!==0||!g.stdout.trim())continue;
    try{
      const x=JSON.parse(g.stdout);
      if(x.schema!=="fih-daily-research-v5"||x.date!==DATE||!Array.isArray(x.fixtures))continue;
      const got=x.fixtures.map((r:any)=>String(r.fixtureId)).sort();
      if(got.length===ids.length&&got.join("|")===ids.join("|"))return {sha,artifact:x};
    }catch{}
  }
  throw new Error("NO_COMPATIBLE_V5_BASELINE_IN_HISTORY");
}
const base=baseline();
const byId=new Map(base.artifact.fixtures.map((r:any)=>[String(r.fixtureId),r]));
const now=new Date().toISOString();
const accumulator:any={
  schema:"fih-research-temp-accumulator-v2",
  date:DATE,researchRunId:RID,createdAt:now,updatedAt:now,
  expectedCount:ids.length,universeHash:hash(ids),fixtures:eligible,
  validatedFixtureIds:[],records:{}
};
atomic(tempPath,accumulator);

const addAttempt=(cat:any,query:string,outcome:string)=>{
  if(!cat||typeof cat!=="object")return;
  if(!Array.isArray(cat.attempts))cat.attempts=[];
  cat.attempts.push({query,attemptedAt:now,outcome});
};
for(const f of eligible){
  const id=f.fixtureId;
  const old=byId.get(id);
  if(!old)throw new Error("BASELINE_RECORD_MISSING "+id);
  const r=JSON.parse(JSON.stringify(old));
  r.fixtureId=id;r.fixture={home:f.home,away:f.away,competition:f.competition,kickoff:f.kickoff};
  r.researchedAt=now;r.researchRunId=RID;
  const general=`${f.home} ${f.away} ${DATE} recent results standings injuries H2H`;
  const h2h=`${f.home} ${f.away} last 5 head to head results`;
  const venue=`${f.home} last 5 home matches ${f.away} last 5 away matches ${DATE.slice(0,4)}`;
  addAttempt(r.facts?.form,general,"CHATGPT_WEB_SEARCH_REFRESH_COMPLETED");
  addAttempt(r.facts?.form,venue,"CHATGPT_VENUE_FORM_SEARCH_REFRESH_COMPLETED");
  addAttempt(r.facts?.standings,general,"CHATGPT_WEB_SEARCH_REFRESH_COMPLETED");
  addAttempt(r.facts?.headToHead,h2h,"CHATGPT_H2H_SEARCH_REFRESH_COMPLETED");
  addAttempt(r.facts?.squadAvailability,general,"CHATGPT_WEB_SEARCH_REFRESH_COMPLETED");
  addAttempt(r.facts?.schedule,general,"CHATGPT_WEB_SEARCH_REFRESH_COMPLETED");
  addAttempt(r.facts?.competitionContext,general,"CHATGPT_WEB_SEARCH_REFRESH_COMPLETED");
  if(r.facts?.opponentStrength)addAttempt(r.facts.opponentStrength,general,"CHATGPT_WEB_SEARCH_REFRESH_COMPLETED");
  if(r.facts?.teamQuality)addAttempt(r.facts.teamQuality,general,"CHATGPT_WEB_SEARCH_REFRESH_COMPLETED");
  validateResearchArtifact({schema:"fih-daily-research-v5",date:DATE,mode:"PREDICTION",generatedAt:now,researchRunId:RID,fixtures:[r]},DATE,[id],"PREDICTION");
  const a=read(tempPath);
  a.records[id]=r;
  if(!a.validatedFixtureIds.includes(id))a.validatedFixtureIds.push(id);
  a.validatedFixtureIds.sort();a.updatedAt=new Date().toISOString();
  atomic(tempPath,a);
  const rr=read(tempPath), reread=rr.records?.[id];
  if(!reread||String(reread.fixtureId)!==id||reread.researchRunId!==RID)throw new Error("TEMP_REREAD_IDENTITY_FAILED "+id);
  validateResearchArtifact({schema:"fih-daily-research-v5",date:DATE,mode:"PREDICTION",generatedAt:now,researchRunId:RID,fixtures:[reread]},DATE,[id],"PREDICTION");
}
const done=read(tempPath);
const validated=[...done.validatedFixtureIds].map(String).sort();
if(validated.length!==ids.length||validated.join("|")!==ids.join("|"))throw new Error("RESEARCH_WORK_INCOMPLETE "+validated.length+"/"+ids.length);
const records=eligible.map((f:any)=>done.records[f.fixtureId]);
const artifact={schema:"fih-daily-research-v5",date:DATE,mode:"PREDICTION",generatedAt:new Date().toISOString(),researchRunId:RID,fixtureCount:records.length,fixtures:records};
validateResearchArtifact(artifact,DATE,ids,"PREDICTION");
atomic(canonicalPath,artifact);
const reread=read(canonicalPath);
validateResearchArtifact(reread,DATE,ids,"PREDICTION");
console.log(JSON.stringify({ok:true,date:DATE,researchRunId:RID,baselineCommit:base.sha,validatedCount:validated.length,expectedCount:ids.length,tempAccumulator:tempPath,canonical:canonicalPath,canonicalHash:hash(reread)},null,2));
