import {execFileSync} from "node:child_process";
import {resolveCommand} from "./fih-command-router.mjs";

const command=process.argv.slice(2).join(" ").trim()||process.env.FIH_COMMAND||"run today";
const plan=resolveCommand(command);
if(plan.action!=="RUN")throw new Error("STEP1_COMMAND_MUST_BE_RUN");

const base=String(process.env.FIH_INGEST_BASE_URL||"").replace(/\/$/,"");
if(!base)throw new Error("FIH_INGEST_BASE_URL_NOT_CONFIGURED");

async function oidcToken(){
  const u=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const t=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(u&&t){
    const sep=u.includes("?")?"&":"?";
    const r=await fetch(u+sep+"audience=fih-step2",{headers:{Authorization:"Bearer "+t}});
    if(!r.ok)throw new Error("GITHUB_OIDC_REQUEST_FAILED "+r.status);
    const j=await r.json();
    if(!j.value)throw new Error("GITHUB_OIDC_TOKEN_MISSING");
    return j.value;
  }
  if(process.env.FIH_TRUSTED_OIDC_TOKEN)return process.env.FIH_TRUSTED_OIDC_TOKEN;
  throw new Error("GITHUB_OIDC_ENV_MISSING");
}

const git=args=>execFileSync("git",args,{encoding:"utf8",maxBuffer:64*1024*1024}).trim();

async function acquire(date,mode){
  const oidc=await oidcToken();
  const r=await fetch(base+"/api/backtest-ingest?date="+encodeURIComponent(date),{
    headers:{"x-fih-github-oidc":oidc}
  });
  const txt=await r.text();
  if(!r.ok)throw new Error("STEP1_HTTP_"+r.status+" "+txt.slice(0,1000));

  const j=JSON.parse(txt);
  if(j.ok!==true||j.verified!==true||j.date!==date||j.mode!==mode||!j.commit||!j.path||!Number.isInteger(j.fixtureCount)||j.fixtureCount<1){
    throw new Error("STEP1_RESPONSE_INVALID "+date);
  }

  git(["fetch","origin","main"]);
  const raw=git(["show",j.commit+":"+j.path]);
  const x=JSON.parse(raw);
  const stages=Array.isArray(x?.payload?.Stages)?x.payload.Stages:[];
  const count=stages.reduce((n,s)=>n+(Array.isArray(s?.Events)?s.Events.length:0),0);
  const expectedSchema=mode==="BACKTEST"?"fih-backtest-fixture-v1":"fih-prediction-fixture-v1";

  if(
    x.date!==date||
    x.mode!==mode||
    x.schema!==expectedSchema||
    x.fixtureCount!==j.fixtureCount||
    count!==j.fixtureCount||
    !x.fetchedAt
  )throw new Error("STEP1_GITHUB_REREAD_INVALID "+date);

  return {date,mode,path:j.path,commit:j.commit,fixtureCount:j.fixtureCount,fetchedAt:x.fetchedAt};
}

const results=[];
for(const {date,mode} of plan.dates){
  console.log("STEP1_DATE_BEGIN",date,mode);
  results.push(await acquire(date,mode));
  console.log("STEP1_DATE_VERIFIED",date,mode);
}

console.log(JSON.stringify({
  ok:true,
  command,
  start:plan.start,
  end:plan.end,
  status:"STEP1_COMPLETE",
  dates:results
},null,2));
