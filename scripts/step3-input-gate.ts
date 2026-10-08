import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {execFileSync} from "node:child_process";
import {validateDailyResearch} from "./research-canonical";

const CODE_ROOT=process.cwd();
const DATA_ROOT=process.env.FIH_ROOT||CODE_ROOT;
const arg=(n:string)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:undefined};
const DATE=arg("--date")||process.env.FIH_DATE||"";
if(!/^\d{4}-\d{2}-\d{2}$/.test(DATE))throw new Error("STEP3_GATE_INVALID_DATE");

const read=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
const ledgerPath=path.join(DATA_ROOT,"data/run-state",DATE+".json");
const boardPath=path.join(DATA_ROOT,"data/prediction-fixtures",DATE+".json");
const researchRel="data/research/"+DATE+".json";
const researchPath=path.join(DATA_ROOT,researchRel);
if(!fs.existsSync(ledgerPath))throw new Error("STEP3_GATE_LEDGER_MISSING");
if(!fs.existsSync(boardPath))throw new Error("STEP3_GATE_FROZEN_BOARD_MISSING");
if(!fs.existsSync(researchPath))throw new Error("STEP3_GATE_CANONICAL_RESEARCH_MISSING");

const ledger=read(ledgerPath);
if(ledger.schema!=="fih-daily-run-ledger-v1"||ledger.date!==DATE||ledger.timezone!=="Africa/Johannesburg")throw new Error("STEP3_GATE_LEDGER_IDENTITY_INVALID");
if(typeof ledger.researchRunId!=="string"||!ledger.researchRunId.trim())throw new Error("STEP3_GATE_RESEARCH_RUN_ID_MISSING");

const board=read(boardPath);
if(board.schema!=="fih-prediction-fixture-v1"||board.mode!=="PREDICTION"||board.date!==DATE||board.timezone!=="Africa/Johannesburg")throw new Error("STEP3_GATE_BOARD_IDENTITY_INVALID");
const stages=Array.isArray(board.payload?.Stages)?board.payload.Stages:[];
const events=stages.flatMap((s:any)=>(Array.isArray(s.Events)?s.Events:[]).map((e:any)=>({e,s})));
if(!events.length||events.length!==board.fixtureCount)throw new Error("STEP3_GATE_BOARD_COUNT_INVALID");
const eventId=(e:any,s:any)=>String(e?.Eid??e?.Id??[s?.CompId,e?.T1?.[0]?.Nm,e?.T2?.[0]?.Nm,e?.Esd].filter(Boolean).join(":"));
const boardIds=events.map(({e,s}:any)=>eventId(e,s)).sort();
const ledgerIds=(ledger.fixtures||[]).map((f:any)=>String(f.id)).sort();
if(boardIds.length!==ledgerIds.length||JSON.stringify(boardIds)!==JSON.stringify(ledgerIds))throw new Error("STEP3_GATE_FROZEN_BOARD_DRIFT");

const eligibleIds=(ledger.fixtures||[]).filter((f:any)=>f.eligible).map((f:any)=>String(f.id));
if(!eligibleIds.length)throw new Error("STEP3_GATE_NO_ELIGIBLE_FIXTURES");
const validation=validateDailyResearch(DATA_ROOT,DATE,eligibleIds,"PREDICTION",ledger.researchRunId);
if(validation.count!==eligibleIds.length)throw new Error("STEP3_GATE_RESEARCH_COUNT_MISMATCH");

if(path.resolve(DATA_ROOT)!==path.resolve(CODE_ROOT))throw new Error("STEP3_GATE_GIT_ROOT_MISMATCH");
const git=(args:string[])=>execFileSync("git",args,{cwd:CODE_ROOT,encoding:"utf8"}).trim();
git(["ls-files","--error-unmatch",researchRel]);
const dirty=git(["status","--porcelain","--",researchRel]);
if(dirty)throw new Error("STEP3_GATE_RESEARCH_UNCOMMITTED");

const commits=git(["log","--format=%H","--",researchRel]).split(/\r?\n/).filter(Boolean);
const matching:string[]=[];
for(const sha of commits){
  try{
    const raw=git(["show",sha+":"+researchRel]);
    const x=JSON.parse(raw);
    if(x?.researchRunId===ledger.researchRunId)matching.push(sha);
  }catch{}
}
if(matching.length!==1)throw new Error("STEP3_GATE_CANONICAL_COMMIT_COUNT_"+matching.length);

const currentRaw=fs.readFileSync(researchPath,"utf8");
const headRaw=git(["show","HEAD:"+researchRel]);
if(currentRaw.trimEnd()!==headRaw.trimEnd())throw new Error("STEP3_GATE_HEAD_RESEARCH_MISMATCH");
const inputResearchHash=crypto.createHash("sha256").update(currentRaw).digest("hex");
const head=git(["rev-parse","HEAD"]);

console.log(JSON.stringify({
  ok:true,
  gate:"STEP3_INPUT_VERIFIED",
  date:DATE,
  researchRunId:ledger.researchRunId,
  eligibleFixtures:eligibleIds.length,
  researchCommit:matching[0],
  head,
  inputResearchHash
},null,2));
