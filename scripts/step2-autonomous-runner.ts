import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {execFileSync,spawnSync} from "node:child_process";
import {validateResearchArtifact} from "./research-canonical";

const ROOT=process.cwd();
const arg=(n:string)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:undefined};
const DATE=arg("--date")||process.env.FIH_DATE||"";
const SMOKE=process.argv.includes("--smoke");
const BASE=(process.env.FIH_RESEARCH_BASE_URL||process.env.FIH_INGEST_BASE_URL||"").replace(/\/$/,"");
if(!/^\d{4}-\d{2}-\d{2}$/.test(DATE))throw new Error("STEP2_INVALID_DATE");
if(!BASE)throw new Error("FIH_RESEARCH_BASE_URL_NOT_CONFIGURED");

const read=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
const hash=(x:any)=>crypto.createHash("sha256").update(typeof x==="string"?x:JSON.stringify(x)).digest("hex");
const queuePath=path.join(ROOT,"data/research-queue",DATE+".json");
const ledgerPath=path.join(ROOT,"data/run-state",DATE+".json");
if(!fs.existsSync(queuePath)||!fs.existsSync(ledgerPath))throw new Error("STEP2_QUEUE_OR_LEDGER_MISSING");
const queue=read(queuePath),ledger=read(ledgerPath);
if(queue.schema!=="fih-chatgpt-research-queue-v3"||queue.date!==DATE||queue.researchRunId!==ledger.researchRunId)throw new Error("STEP2_QUEUE_IDENTITY_INVALID");
const MODE=queue.mode||"PREDICTION";
if(!["PREDICTION","BACKTEST"].includes(MODE))throw new Error("STEP2_MODE_INVALID");
const fixtures=queue.fixtures||[],fixtureIds=fixtures.map((f:any)=>String(f.fixtureId));
if(!fixtures.length||fixtureIds.length!==new Set(fixtureIds).size||queue.count!==fixtures.length)throw new Error("STEP2_QUEUE_COVERAGE_INVALID");
const rawConcurrency=Number(process.env.FIH_RESEARCH_CONCURRENCY||"6");
const CONCURRENCY=Math.max(1,Math.min(6,Number.isFinite(rawConcurrency)?Math.floor(rawConcurrency):6));

const tempRoot=process.env.FIH_STEP2_WORK_DIR||path.join(process.env.RUNNER_TEMP||"/mnt/data","fih","research-work");
const workPath=path.join(tempRoot,DATE+".json");
function atomicWrite(p:string,x:any){fs.mkdirSync(path.dirname(p),{recursive:true});const t=p+".tmp";fs.writeFileSync(t,JSON.stringify(x,null,2)+"\n");fs.renameSync(t,p)}
function freshWork(){
 const t=new Date().toISOString();
 return {schema:"fih-step2-working-v1",date:DATE,researchRunId:queue.researchRunId,mode:MODE,cutoffAt:queue.cutoffAt??null,expectedFixtureCount:fixtureIds.length,fixtureIds:[...fixtureIds],validatedFixtureIds:[],validatedCount:0,nextFixtureId:fixtureIds[0]||null,status:"ACCUMULATING",createdAt:t,updatedAt:t,fixtures:[]};
}
function validateWork(w:any){
 if(w.schema!=="fih-step2-working-v1"||w.date!==DATE||w.researchRunId!==queue.researchRunId||w.mode!==MODE||w.expectedFixtureCount!==fixtureIds.length||JSON.stringify(w.fixtureIds)!==JSON.stringify(fixtureIds))throw new Error("STEP2_WORK_IDENTITY_INVALID");
 if(!Array.isArray(w.fixtures)||!Array.isArray(w.validatedFixtureIds)||w.validatedCount!==w.validatedFixtureIds.length||w.fixtures.length!==w.validatedFixtureIds.length)throw new Error("STEP2_WORK_COUNT_INVALID");
 if(new Set(w.validatedFixtureIds).size!==w.validatedFixtureIds.length||new Set(w.fixtures.map((r:any)=>String(r.fixtureId))).size!==w.fixtures.length)throw new Error("STEP2_WORK_DUPLICATE");
 const missing=fixtureIds.filter((id:string)=>!w.validatedFixtureIds.includes(id));
 if(w.nextFixtureId!==(missing[0]||null))throw new Error("STEP2_WORK_CURSOR_INVALID");
 for(const r of w.fixtures){
  const id=String(r.fixtureId);if(!fixtureIds.includes(id)||!w.validatedFixtureIds.includes(id))throw new Error("STEP2_WORK_ORPHAN "+id);
  validateResearchArtifact({schema:"fih-daily-research-v5",date:DATE,mode:MODE,generatedAt:new Date().toISOString(),researchRunId:queue.researchRunId,fixtures:[r]},DATE,[id],MODE);
 }
 return missing;
}
let work: any;
if(fs.existsSync(workPath)){work=read(workPath);try{validateWork(work)}catch{work=freshWork();atomicWrite(workPath,work)}}else{work=freshWork();atomicWrite(workPath,work)}
validateWork(read(workPath));

async function oidcToken(){
 const u=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,t=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
 if(u&&t){
  const sep=u.includes("?")?"&":"?";
  const r=await fetch(u+sep+"audience=fih-step2",{headers:{Authorization:"Bearer "+t}});
  if(!r.ok)throw new Error("GITHUB_OIDC_REQUEST_FAILED "+r.status);
  const j=await r.json();if(!j.value)throw new Error("GITHUB_OIDC_TOKEN_MISSING");return j.value;
 }
 if(process.env.FIH_TRUSTED_OIDC_TOKEN)return process.env.FIH_TRUSTED_OIDC_TOKEN;
 throw new Error("GITHUB_OIDC_ENV_MISSING");
}
async function researchFixture(f:any){
 let last:any=null;
 for(let attempt=1;attempt<=Number(process.env.FIH_RESEARCH_RETRIES||"3");attempt++){
  const job={date:DATE,fixture:String(f.fixtureId)};
  try{
   const token=await oidcToken();
   const r=await fetch(BASE+"/api/research-fixture",{method:"POST",headers:{"Content-Type":"application/json","x-fih-github-oidc":token},body:JSON.stringify(job)});
   const txt=await r.text();if(!r.ok)throw new Error("RESEARCH_HTTP_"+r.status+" "+txt.slice(0,1600));
   const j=JSON.parse(txt),record=j.record;
   validateResearchArtifact({schema:"fih-daily-research-v5",date:DATE,mode:MODE,generatedAt:new Date().toISOString(),researchRunId:queue.researchRunId,fixtures:[record]},DATE,[String(f.fixtureId)],MODE);
   return {record,meta:{queries:j.observedQueries??j.searchCalls,sources:j.observedSources??0,model:j.model}};
  }catch(e){last=e;console.error("STEP2_FIXTURE_RETRY",f.fixtureId,attempt,String(e))}
 }
 throw new Error("STEP2_FIXTURE_EXHAUSTED "+f.fixtureId+" "+String(last));
}
async function checkpoint(f:any,record:any){
 work=read(workPath);validateWork(work);
 const id=String(f.fixtureId);if(work.validatedFixtureIds.includes(id))return;
 work.fixtures.push(record);work.validatedFixtureIds.push(id);
 work.validatedCount=work.validatedFixtureIds.length;
 work.nextFixtureId=fixtureIds.find((x:string)=>!work.validatedFixtureIds.includes(x))||null;
 work.status=work.validatedCount===work.expectedFixtureCount?"READY_FOR_VALIDATION":"ACCUMULATING";
 work.updatedAt=new Date().toISOString();atomicWrite(workPath,work);
 const reread=read(workPath);validateWork(reread);
 const rr=reread.fixtures.find((x:any)=>String(x.fixtureId)===id);
 if(!rr)throw new Error("STEP2_CHECKPOINT_REREAD_MISSING "+id);
 validateResearchArtifact({schema:"fih-daily-research-v5",date:DATE,mode:MODE,generatedAt:new Date().toISOString(),researchRunId:queue.researchRunId,fixtures:[rr]},DATE,[id],MODE);
}
if(SMOKE){
 const f=fixtures[0],r=await researchFixture(f);await checkpoint(f,r.record);
 console.log(JSON.stringify({ok:true,status:"STEP2_SMOKE_PASS",date:DATE,fixtureId:f.fixtureId,checkpoint:workPath,meta:r.meta},null,2));
 process.exit(0);
}
for(;;){
 work=read(workPath);
 const missing=validateWork(work);
 if(!missing.length)break;
 const wanted=new Set(missing.slice(0,CONCURRENCY));
 const batch=fixtures.filter((f:any)=>wanted.has(String(f.fixtureId)));
 console.log("STEP2_BATCH_BEGIN",work.validatedCount+"/"+work.expectedFixtureCount,"workers="+batch.length,"concurrency="+CONCURRENCY);
 const settled=await Promise.allSettled(batch.map(async(f:any)=>({f,r:await researchFixture(f)})));
 const failures:string[]=[];
 for(let i=0;i<settled.length;i++){
  const result=settled[i];
  if(result.status==="rejected"){failures.push(String(batch[i].fixtureId)+":"+String(result.reason));continue}
  const {f,r}=result.value;
  await checkpoint(f,r.record);
  work=read(workPath);
  console.log("STEP2_CHECKPOINT_PASS",work.validatedCount+"/"+work.expectedFixtureCount,f.fixtureId,r.meta.queries,r.meta.sources);
 }
 if(failures.length)throw new Error("STEP2_BATCH_RESEARCH_FAILED "+failures.join(" | "));
}
work=read(workPath);validateWork(work);
if(work.validatedCount!==work.expectedFixtureCount)throw new Error("STEP2_NOT_N_OF_N");
const artifact={schema:"fih-daily-research-v5",date:DATE,mode:MODE,generatedAt:new Date().toISOString(),researchRunId:queue.researchRunId,fixtureCount:work.fixtures.length,fixtures:fixtureIds.map((id:string)=>work.fixtures.find((r:any)=>String(r.fixtureId)===id))};
validateResearchArtifact(artifact,DATE,fixtureIds,MODE);
work.status="VALIDATED";work.updatedAt=new Date().toISOString();atomicWrite(workPath,work);validateWork(read(workPath));

const rel=MODE==="BACKTEST"?"data/backtest/research/"+DATE+".json":"data/research/"+DATE+".json";
const canonical=path.join(ROOT,rel);fs.mkdirSync(path.dirname(canonical),{recursive:true});fs.writeFileSync(canonical,JSON.stringify(artifact,null,2)+"\n");
validateResearchArtifact(read(canonical),DATE,fixtureIds,MODE);
const git=(args:string[])=>execFileSync("git",args,{cwd:ROOT,encoding:"utf8",maxBuffer:32*1024*1024}).trim();
git(["config","user.name","fih-runner"]);git(["config","user.email","actions@users.noreply.github.com"]);
let existing:string[]=[];
try{existing=git(["log","--format=%H","--",rel]).split(/\r?\n/).filter(Boolean).filter(sha=>{try{return JSON.parse(git(["show",sha+":"+rel]))?.researchRunId===queue.researchRunId}catch{return false}})}catch{}
if(existing.length>1)throw new Error("STEP2_CANONICAL_COMMIT_COUNT_"+existing.length);
if(existing.length===0){
 git(["add","--",rel]);git(["commit","-m",`research: canonical ${DATE} ${queue.researchRunId}`]);
 let p=spawnSync("git",["push","origin","HEAD:main"],{cwd:ROOT,encoding:"utf8"});
 if(p.status!==0){git(["pull","--rebase","origin","main"]);p=spawnSync("git",["push","origin","HEAD:main"],{cwd:ROOT,encoding:"utf8"});if(p.status!==0)throw new Error("STEP2_GIT_PUSH_FAILED "+p.stderr)}
}
git(["fetch","origin","main"]);
const remote=git(["show","origin/main:"+rel]),persisted=JSON.parse(remote);
validateResearchArtifact(persisted,DATE,fixtureIds,MODE);
if(persisted.researchRunId!==queue.researchRunId||hash(remote)!==hash(JSON.stringify(persisted,null,2)+"\n"))throw new Error("STEP2_GITHUB_REREAD_MISMATCH");
const commits=git(["log","origin/main","--format=%H","--",rel]).split(/\r?\n/).filter(Boolean).filter(sha=>{try{return JSON.parse(git(["show",sha+":"+rel]))?.researchRunId===queue.researchRunId}catch{return false}});
if(commits.length!==1)throw new Error("STEP2_CANONICAL_COMMIT_COUNT_"+commits.length);
console.log(JSON.stringify({ok:true,status:"STEP2_COMPLETE",date:DATE,mode:MODE,count:fixtureIds.length,researchRunId:queue.researchRunId,researchCommit:commits[0],canonical:rel,workHash:hash(read(workPath))},null,2));
