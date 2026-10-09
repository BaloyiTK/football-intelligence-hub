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
if(!fs.existsSync(path.join(ROOT,researchRel))){
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
