import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {validateResearchArtifact} from "./research-canonical";

const ROOT=process.env.FIH_ROOT||process.cwd();
const arg=(n:string)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:undefined};
const DATE=arg("--date")||process.env.FIH_DATE||"";
const RID=arg("--research-run-id")||"";
const ID=arg("--fixture")||"";
if(!/^\d{4}-\d{2}-\d{2}$/.test(DATE))throw new Error("INVALID_DATE");
if(!RID)throw new Error("MISSING_RESEARCH_RUN_ID");

const lp=path.join(ROOT,"data/run-state",DATE+".json");
const ap=path.join(ROOT,"data/research-work",DATE+".json");
const cp=path.join(ROOT,"data/research",DATE+".json");
const MODE=DATE<new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())?"BACKTEST":"PREDICTION";
const read=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
const hash=(x:any)=>crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
function atomicWrite(p:string,x:any){
  fs.mkdirSync(path.dirname(p),{recursive:true});
  const tmp=p+".tmp";
  fs.writeFileSync(tmp,JSON.stringify(x,null,2)+"\n");
  fs.renameSync(tmp,p);
}
function universe(){
  const l=read(lp);
  if(!l.researchRunId||l.researchRunId!==RID)throw new Error("RESEARCH_RUN_ID_MISMATCH");
  const fixtures=l.fixtures.filter((f:any)=>f.eligible).map((f:any)=>({fixtureId:String(f.id),home:f.home,away:f.away,competition:f.competition,kickoff:f.kickoff}));
  return {l,fixtures,ids:fixtures.map((f:any)=>f.fixtureId).sort()};
}
function freshAccumulator(){
  const {fixtures,ids}=universe();
  return {
    schema:"fih-step2-working-v1",
    date:DATE,
    researchRunId:RID,
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    mode:MODE,
    cutoffAt:MODE==="BACKTEST"?DATE+"T04:00:00.000Z":null,
    expectedFixtureCount:ids.length,
    fixtureIds:fixtures.map((f:any)=>f.fixtureId),
    validatedFixtureIds:[],
    validatedCount:0,
    nextFixtureId:fixtures[0]?.fixtureId||null,
    status:"ACCUMULATING",
    fixtures:[] as any[]
  };
}
function accumulator(resetStale=false){
  const {ids}=universe();
  if(fs.existsSync(ap)){
    const a=read(ap);
    const validIdentity=a.schema==="fih-step2-working-v1"&&a.date===DATE&&a.researchRunId===RID&&a.mode===MODE&&a.expectedFixtureCount===ids.length&&JSON.stringify(a.fixtureIds)===JSON.stringify(universe().fixtures.map((f:any)=>f.fixtureId))&&Array.isArray(a.fixtures)&&Array.isArray(a.validatedFixtureIds);
    if(validIdentity)return a;
    if(!resetStale)throw new Error("RESEARCH_TEMP_ACCUMULATOR_IDENTITY_INVALID");
  }
  const a=freshAccumulator();
  atomicWrite(ap,a);
  return a;
}
function validateOne(r:any){
  const {ids}=universe();
  if(String(r.fixtureId)!==ID||r.researchRunId!==RID)throw new Error("CHECKPOINT_IDENTITY_INVALID");
  validateResearchArtifact({schema:"fih-daily-research-v5",date:DATE,mode:MODE,generatedAt:new Date().toISOString(),researchRunId:RID,fixtures:[r]},DATE,[ID],MODE);
  if(!ids.includes(ID))throw new Error("CHECKPOINT_FIXTURE_NOT_ELIGIBLE");
}
function verifyAccumulator(a:any){
  const {ids}=universe();
  if(a.fixtures.length!==a.validatedFixtureIds.length||a.expectedFixtureCount!==ids.length||a.nextFixtureId!==(a.fixtureIds.find((id:string)=>!a.validatedFixtureIds.includes(id))||null))throw new Error("RESEARCH_WORKING_INVARIANT_INVALID");
  if(new Set(a.fixtures.map((f:any)=>String(f.fixtureId))).size!==a.fixtures.length)throw new Error("RESEARCH_DUPLICATE_FIXTURE_RECORD");
  const validated=[...a.validatedFixtureIds].map(String).sort();
  if(a.validatedCount!==validated.length)throw new Error("RESEARCH_VALIDATED_COUNT_MISMATCH");
  if(validated.length!==new Set(validated).size)throw new Error("RESEARCH_TEMP_DUPLICATE_VALIDATED_ID");
  for(const id of validated){
    if(!ids.includes(id))throw new Error("RESEARCH_TEMP_ORPHAN_ID "+id);
    const r=a.fixtures.find((x:any)=>String(x.fixtureId)===id);
    if(!r)throw new Error("RESEARCH_TEMP_RECORD_MISSING "+id);
    if(String(r.fixtureId)!==id||r.researchRunId!==RID)throw new Error("RESEARCH_TEMP_RECORD_IDENTITY_INVALID "+id);
    validateResearchArtifact({schema:"fih-daily-research-v5",date:DATE,mode:MODE,generatedAt:new Date().toISOString(),researchRunId:RID,fixtures:[r]},DATE,[id],MODE);
  }
  return {validatedCount:validated.length,expectedCount:ids.length};
}

const cmd=process.argv[2]||"status";
let out:any;
if(cmd==="init"){
  const a=accumulator(true);
  const v=verifyAccumulator(a);
  out={tempAccumulator:ap,researchRunId:RID,...v};
}else if(cmd==="put"){
  if(!ID)throw new Error("MISSING_FIXTURE");
  const input=arg("--input");if(!input)throw new Error("MISSING_INPUT");
  const r=read(path.resolve(input));
  validateOne(r);
  const a=accumulator(false);
  a.fixtures=a.fixtures.filter((x:any)=>String(x.fixtureId)!==ID);
  a.fixtures.push(r);
  if(!a.validatedFixtureIds.includes(ID))a.validatedFixtureIds.push(ID);
  a.validatedFixtureIds.sort();
  a.validatedCount=a.validatedFixtureIds.length;
  a.nextFixtureId=a.fixtureIds.find((id:string)=>!a.validatedFixtureIds.includes(id))||null;
  a.status=a.validatedCount===a.expectedFixtureCount?"READY_FOR_VALIDATION":"ACCUMULATING";
  a.updatedAt=new Date().toISOString();
  atomicWrite(ap,a);
  const reread=read(ap);
  const rr=reread.fixtures.find((x:any)=>String(x.fixtureId)===ID);
  if(!rr)throw new Error("RESEARCH_TEMP_REREAD_MISSING "+ID);
  validateOne(rr);
  const v=verifyAccumulator(reread);
  out={fixtureId:ID,validated:true,tempAccumulator:ap,checkpointHash:hash(rr),...v};
}else if(cmd==="status"){
  const a=accumulator(false),v=verifyAccumulator(a);
  const missing=a.fixtureIds.filter((id:string)=>!a.validatedFixtureIds.includes(id));
  out={researchRunId:RID,tempAccumulator:ap,...v,missing,next:missing[0]||null};
}else if(cmd==="promote"){
  const a=accumulator(false),v=verifyAccumulator(a);
  if(v.validatedCount!==v.expectedCount)throw new Error("RESEARCH_WORK_INCOMPLETE "+v.validatedCount+"/"+v.expectedCount);
  const records=a.fixtureIds.map((id:string)=>{const r=a.fixtures.find((f:any)=>String(f.fixtureId)===id);if(!r)throw new Error("RESEARCH_TEMP_RECORD_MISSING "+id);return r});
  const artifact={schema:"fih-daily-research-v5",date:DATE,mode:MODE,generatedAt:new Date().toISOString(),researchRunId:RID,fixtureCount:records.length,fixtures:records};
  validateResearchArtifact(artifact,DATE,a.fixtureIds,MODE);
  a.status="VALIDATED";a.updatedAt=new Date().toISOString();atomicWrite(ap,a);
  atomicWrite(cp,artifact);
  const reread=read(cp);
  validateResearchArtifact(reread,DATE,a.fixtureIds,MODE);
  out={promoted:true,count:records.length,researchRunId:RID,tempAccumulator:ap,canonicalHash:hash(reread)};
}else throw new Error("UNKNOWN_COMMAND");

console.log(JSON.stringify({ok:true,command:cmd,date:DATE,...out},null,2));
