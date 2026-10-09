import {execFileSync,spawnSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {resolveCommand} from "./fih-command-router.mjs";

const ROOT=process.cwd();
const command=process.argv.slice(2).join(" ").trim()||process.env.FIH_COMMAND||"run today";
const plan=resolveCommand(command);
if(plan.action!=="RUN")throw new Error("STEP12_COMMAND_MUST_BE_RUN");
const base=String(process.env.FIH_INGEST_BASE_URL||"").replace(/\/$/,"");
if(!base)throw new Error("FIH_INGEST_BASE_URL_NOT_CONFIGURED");
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
const git=(args,opts={})=>execFileSync("git",args,{cwd:ROOT,encoding:"utf8",maxBuffer:64*1024*1024,...opts}).trim();
const tsx=(...args)=>{const r=spawnSync(process.execPath,["node_modules/tsx/dist/cli.mjs",...args],{cwd:ROOT,stdio:"inherit",env:process.env});if(r.status!==0)throw new Error("STEP12_COMMAND_FAILED "+args.join(" "));};

async function acquire(date,mode){
 const oidc=await oidcToken();
 const r=await fetch(base+"/api/backtest-ingest?date="+encodeURIComponent(date),{headers:{"x-fih-github-oidc":oidc}});
 const txt=await r.text();if(!r.ok)throw new Error("STEP1_HTTP_"+r.status+" "+txt.slice(0,1000));
 const j=JSON.parse(txt);
 if(j.ok!==true||j.verified!==true||j.date!==date||j.mode!==mode||!j.commit||!Number.isInteger(j.fixtureCount)||j.fixtureCount<1)throw new Error("STEP1_RESPONSE_INVALID "+date);
 git(["fetch","origin","main"]);git(["reset","--hard","origin/main"]);
 const rel=mode==="BACKTEST"?"data/backtest/fixtures/"+date+".json":"data/prediction-fixtures/"+date+".json";
 const x=JSON.parse(fs.readFileSync(path.join(ROOT,rel),"utf8"));
 const n=(x.payload?.Stages||[]).reduce((a,s)=>a+(Array.isArray(s.Events)?s.Events.length:0),0);
 if(x.date!==date||x.mode!==mode||x.fixtureCount!==n||n!==j.fixtureCount||x.fetchedAt==null)throw new Error("STEP1_GITHUB_REREAD_INVALID "+date);
 return {commit:j.commit,fixtureCount:n,rel};
}
function commitPreparation(date){
 git(["config","user.name","fih-runner"]);git(["config","user.email","actions@users.noreply.github.com"]);
 const paths=["data/run-state/"+date+".json","data/research-queue/"+date+".json","data/recovery-requests/"+date+".json"];
 git(["add","--",...paths]);
 if(git(["diff","--cached","--name-only"]))git(["commit","-m","step12: freeze "+date+" research universe"]);
 let p=spawnSync("git",["push","origin","HEAD:main"],{cwd:ROOT,encoding:"utf8"});
 if(p.status!==0){git(["pull","--rebase","origin","main"]);p=spawnSync("git",["push","origin","HEAD:main"],{cwd:ROOT,encoding:"utf8"});if(p.status!==0)throw new Error("STEP12_PREPARE_PUSH_FAILED "+date+" "+p.stderr)}
 git(["fetch","origin","main"]);
 for(const rel of paths){
  const local=JSON.parse(fs.readFileSync(path.join(ROOT,rel),"utf8")),remote=JSON.parse(git(["show","origin/main:"+rel]));
  if(local.researchRunId!==remote.researchRunId||local.date!==remote.date)throw new Error("STEP12_PREPARE_GITHUB_REREAD_MISMATCH "+rel);
  if(rel.startsWith("data/recovery-requests/")&&(remote.status!=="CHATGPT_RESEARCH_REQUIRED"||remote.expectedFixtureCount==null))throw new Error("STEP12_HANDOFF_GITHUB_REREAD_INVALID "+rel);
 }
}
const results=[];
for(const item of plan.dates){
 const {date,mode}=item;
 console.log("STEP12_DATE_BEGIN",date,mode);
 const step1=await acquire(date,mode);
 tsx("scripts/step12-prepare.ts","--date",date,"--mode",mode);
 const q=JSON.parse(fs.readFileSync(path.join(ROOT,"data/research-queue",date+".json"),"utf8"));
 commitPreparation(date);
 results.push({date,mode,step1Commit:step1.commit,fixtureCount:step1.fixtureCount,researchRunId:q.researchRunId,researchCount:q.count,status:"STEP2_CHATGPT_QUEUE_READY"});
 console.log("STEP12_CHATGPT_HANDOFF_REQUIRED",date,mode,q.researchRunId,q.count);
}
console.log(JSON.stringify({ok:true,command,start:plan.start,end:plan.end,dates:results,status:"STEP1_COMPLETE_STEP2_CHATGPT_HANDOFF_REQUIRED"},null,2));
