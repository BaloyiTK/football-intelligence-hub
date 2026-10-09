import fs from "node:fs";
import path from "node:path";
import {execFileSync,spawnSync} from "node:child_process";

const ROOT=process.cwd();
const DATE=process.argv[process.argv.indexOf("--date")+1]||process.env.FIH_DATE||"";
if(!/^\d{4}-\d{2}-\d{2}$/.test(DATE))throw new Error("STEP2_RECOVERY_INVALID_DATE");

const queuePath=path.join(ROOT,"data/research-queue",DATE+".json");
const ledgerPath=path.join(ROOT,"data/run-state",DATE+".json");
const requestPath=path.join(ROOT,"data/recovery-requests",DATE+".json");
if(!fs.existsSync(queuePath)||!fs.existsSync(ledgerPath))throw new Error("STEP2_RECOVERY_STATE_MISSING");

const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const queue=read(queuePath),initialLedger=read(ledgerPath);
if(queue.schema!=="fih-chatgpt-research-queue-v3"||queue.date!==DATE||queue.researchRunId!==initialLedger.researchRunId)
  throw new Error("STEP2_RECOVERY_IDENTITY_MISMATCH");

const tsx=(...args)=>{
  const r=spawnSync(process.execPath,["node_modules/tsx/dist/cli.mjs",...args],{cwd:ROOT,stdio:"inherit",env:process.env});
  if(r.status!==0)throw new Error("STEP2_RECOVERY_COMMAND_FAILED "+args.join(" "));
};
const git=args=>execFileSync("git",args,{cwd:ROOT,encoding:"utf8",maxBuffer:64*1024*1024}).trim();

tsx("scripts/contract-gate.ts","--verdict","RECOVERING","--date",DATE,
  "--rules","REC-001,REC-005,RESUME-001,EXEC-001,RESEARCH-006,RESEARCH-012,RESEARCH-019,EVID-001",
  "--evidence","persisted-stale-ledger,recovery-request,same-researchRunId");

const researchRel=(queue.mode==="BACKTEST"?"data/backtest/research/":"data/research/")+DATE+".json";
const canonicalPath=path.join(ROOT,researchRel);
const oldRunId=initialLedger.runId,oldResearchRunId=initialLedger.researchRunId;
const durableValidated=Number(initialLedger.counts?.RESEARCH_VERIFIED||0);
let tempValidated=0;
const workingPath=queue.workingCheckpoint&&path.isAbsolute(queue.workingCheckpoint)?queue.workingCheckpoint:null;
if(workingPath&&fs.existsSync(workingPath)){
  const w=read(workingPath);
  if(w.researchRunId!==oldResearchRunId)throw new Error("STEP2_RECOVERY_TEMP_RUN_DRIFT");
  tempValidated=Number(w.validatedCount||0);
}
const kickoffMs=(raw)=>{
  const s=String(raw||"");
  if(!/^\\d{14}$/.test(s))return NaN;
  return new Date(s.slice(0,4)+"-"+s.slice(4,6)+"-"+s.slice(6,8)+"T"+s.slice(8,10)+":"+s.slice(10,12)+":"+s.slice(12,14)+"+02:00").getTime();
};
const expiredFixtures=queue.mode==="PREDICTION"?(queue.fixtures||[]).filter(f=>Number.isFinite(kickoffMs(f.kickoff))&&kickoffMs(f.kickoff)<=Date.now()):[];
const zeroProgressExpiry=!fs.existsSync(canonicalPath)&&queue.mode==="PREDICTION"&&durableValidated===0&&tempValidated===0&&expiredFixtures.length>0;

if(zeroProgressExpiry){
  if(fs.existsSync(requestPath)){
    const req=read(requestPath);
    if(req.runId!==oldRunId)throw new Error("STEP2_RECOVERY_REQUEST_RUN_DRIFT");
    req.status="SUPERSEDED_ZERO_PROGRESS_PREMATCH_EXPIRY";
    req.supersededAt=new Date().toISOString();
    req.oldRunId=oldRunId;
    req.oldResearchRunId=oldResearchRunId;
    req.validatedCount=0;
    req.expiredFixtureCount=expiredFixtures.length;
    req.firstExpiredFixtureId=String(expiredFixtures[0].fixtureId);
    fs.writeFileSync(requestPath,JSON.stringify(req,null,2)+"\\n");
    git(["config","user.name","fih-recovery-runner"]);
    git(["config","user.email","actions@users.noreply.github.com"]);
    git(["add","--","data/recovery-requests/"+DATE+".json"]);
    if(git(["diff","--cached","--name-only"])){
      git(["commit","-m","reliability: supersede zero-progress expired Step 2 "+DATE]);
      let p=spawnSync("git",["push","origin","HEAD:main"],{cwd:ROOT,encoding:"utf8"});
      if(p.status!==0){
        git(["pull","--rebase","origin","main"]);
        p=spawnSync("git",["push","origin","HEAD:main"],{cwd:ROOT,encoding:"utf8"});
        if(p.status!==0)throw new Error("STEP2_RECOVERY_SUPERSESSION_PUSH_FAILED "+p.stderr);
      }
    }
  }
  tsx("scripts/contract-gate.ts","--verdict","RECOVERING","--date",DATE,
    "--rules","REC-001,REC-005,RESUME-001,EXEC-001,RESEARCH-019,RESEARCH-025,MODEL-004,EVID-001",
    "--evidence","zero-validated-step2,canonical-research-missing,prematch-window-expired,supersession-persisted");
  const fresh=spawnSync(process.execPath,["scripts/step12-command-runner.mjs","run "+DATE],{cwd:ROOT,stdio:"inherit",env:process.env});
  if(fresh.status!==0)throw new Error("STEP2_RECOVERY_FRESH_LINEAGE_FAILED");
  git(["fetch","origin","main"]);
  git(["reset","--hard","origin/main"]);
  const newLedger=read(ledgerPath);
  if(!newLedger.runId||!newLedger.researchRunId||newLedger.runId===oldRunId||newLedger.researchRunId===oldResearchRunId)
    throw new Error("STEP2_RECOVERY_FRESH_LINEAGE_NOT_REPLACED");
  if(newLedger.counts?.PENDING!==0||newLedger.counts?.RESEARCH_VERIFIED!==newLedger.counts?.eligible)
    throw new Error("STEP2_RECOVERY_FRESH_STEP2_NOT_VERIFIED");
  const newCanonical=path.join(ROOT,"data/research",DATE+".json");
  if(!fs.existsSync(newCanonical)||read(newCanonical).researchRunId!==newLedger.researchRunId)
    throw new Error("STEP2_RECOVERY_FRESH_CANONICAL_MISSING");
  if(fs.existsSync(requestPath)){
    const req=read(requestPath);
    req.status="RECOVERED_STEP2_REPLACED_ZERO_PROGRESS_GENERATION";
    req.recoveredAt=new Date().toISOString();
    req.newRunId=newLedger.runId;
    req.newResearchRunId=newLedger.researchRunId;
    req.researchCount=newLedger.counts.RESEARCH_VERIFIED;
    fs.writeFileSync(requestPath,JSON.stringify(req,null,2)+"\\n");
    git(["add","--","data/recovery-requests/"+DATE+".json"]);
    if(git(["diff","--cached","--name-only"])){
      git(["commit","-m","reliability: verify replacement Step 2 "+DATE]);
      let p=spawnSync("git",["push","origin","HEAD:main"],{cwd:ROOT,encoding:"utf8"});
      if(p.status!==0){
        git(["pull","--rebase","origin","main"]);
        p=spawnSync("git",["push","origin","HEAD:main"],{cwd:ROOT,encoding:"utf8"});
        if(p.status!==0)throw new Error("STEP2_RECOVERY_REPLACEMENT_STATUS_PUSH_FAILED "+p.stderr);
      }
    }
  }
  tsx("scripts/contract-gate.ts","--verdict","PASS","--date",DATE,
    "--rules","RESEARCH-008,RESEARCH-010,RESEARCH-019,RESEARCH-025,MODEL-004,EVID-001",
    "--evidence","fresh-step1-reread,new-run-lineage,canonical-step2-verified,zero-progress-supersession");
  console.log(JSON.stringify({ok:true,status:"STEP2_RECOVERED_WITH_FRESH_LINEAGE",date:DATE,oldRunId,oldResearchRunId,newRunId:newLedger.runId,newResearchRunId:newLedger.researchRunId,count:newLedger.counts.RESEARCH_VERIFIED},null,2));
  process.exit(0);
}

if(!fs.existsSync(canonicalPath)){
  tsx("scripts/step2-autonomous-runner.ts","--date",DATE);
}

if(queue.mode==="PREDICTION"){
  tsx("scripts/step3-input-gate.ts","--date",DATE);
}else{
  const x=read(path.join(ROOT,researchRel));
  if(x.researchRunId!==queue.researchRunId||x.fixtureCount!==queue.count||!Array.isArray(x.fixtures)||x.fixtures.length!==queue.count)
    throw new Error("STEP2_RECOVERY_BACKTEST_CANONICAL_INVALID");
}

const ledger=read(ledgerPath);
if(ledger.researchRunId!==queue.researchRunId)throw new Error("STEP2_RECOVERY_LEDGER_DRIFT");
const t=new Date().toISOString();
let eligible=0;
for(const f of ledger.fixtures||[]){
  if(!f.eligible)continue;
  eligible++;
  f.state="RESEARCH_VERIFIED";
  f.updatedAt=t;
}
if(eligible!==queue.count)throw new Error("STEP2_RECOVERY_COVERAGE_MISMATCH");
ledger.counts={...(ledger.counts||{}),PENDING:0,RESEARCH_VERIFIED:eligible};
ledger.runStatus="RUNNING";
ledger.heartbeatAt=t;
ledger.updatedAt=t;
ledger.next=(ledger.fixtures||[]).find(f=>f.eligible)?{fixtureId:(ledger.fixtures||[]).find(f=>f.eligible).id,state:"RESEARCH_VERIFIED"}:null;
fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+"\n");

if(fs.existsSync(requestPath)){
  const req=read(requestPath);
  if(req.runId!==ledger.runId)throw new Error("STEP2_RECOVERY_REQUEST_RUN_DRIFT");
  req.status="RECOVERED_STEP2";
  req.recoveredAt=t;
  req.researchRunId=queue.researchRunId;
  req.researchCount=eligible;
  fs.writeFileSync(requestPath,JSON.stringify(req,null,2)+"\n");
}

git(["config","user.name","fih-recovery-runner"]);
git(["config","user.email","actions@users.noreply.github.com"]);
const paths=["data/run-state/"+DATE+".json"];
if(fs.existsSync(requestPath))paths.push("data/recovery-requests/"+DATE+".json");
git(["add","--",...paths]);
if(git(["diff","--cached","--name-only"])){
  git(["commit","-m","reliability: verify recovered Step 2 "+DATE]);
  let p=spawnSync("git",["push","origin","HEAD:main"],{cwd:ROOT,encoding:"utf8"});
  if(p.status!==0){
    git(["pull","--rebase","origin","main"]);
    p=spawnSync("git",["push","origin","HEAD:main"],{cwd:ROOT,encoding:"utf8"});
    if(p.status!==0)throw new Error("STEP2_RECOVERY_PUSH_FAILED "+p.stderr);
  }
}

git(["fetch","origin","main"]);
const remoteLedger=JSON.parse(git(["show","origin/main:data/run-state/"+DATE+".json"]));
if(remoteLedger.researchRunId!==queue.researchRunId||remoteLedger.counts?.RESEARCH_VERIFIED!==eligible||remoteLedger.counts?.PENDING!==0)
  throw new Error("STEP2_RECOVERY_GITHUB_REREAD_INVALID");

tsx("scripts/contract-gate.ts","--verdict","PASS","--date",DATE,
  "--rules","RESEARCH-001,RESEARCH-002,RESEARCH-006,RESEARCH-008,RESEARCH-009,RESEARCH-010,RESEARCH-011,RESEARCH-015,RESEARCH-019,EVID-001",
  "--evidence","canonical-step2-verified,github-reread-verified,same-researchRunId");

console.log(JSON.stringify({ok:true,status:"STEP2_RECOVERED",date:DATE,researchRunId:queue.researchRunId,count:eligible},null,2));
