import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const TODAY=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const dateArgIndex=process.argv.indexOf("--date");
const CLI_DATE=dateArgIndex>=0?process.argv[dateArgIndex+1]:"";
const DATE=CLI_DATE||process.env.FIH_DATE||TODAY;
if(!/^\d{4}-\d{2}-\d{2}$/.test(DATE)||Number.isNaN(Date.parse(DATE+"T00:00:00Z"))) throw new Error(`INVALID_FIH_DATE ${DATE}`);
const MODE=DATE<TODAY?"BACKTEST":"PREDICTION";
if(MODE==="BACKTEST") throw new Error(`DATE_MODE_MISMATCH ${DATE} is historical; use the backtest pipeline`);
const root=process.cwd();
const quarantineDir=path.join(root,"data","quarantine",DATE);
function read(p:string){
 const full=path.join(root,p);
 const raw=fs.readFileSync(full,"utf8");
 try{return JSON.parse(raw);}
 catch(error){
  fs.mkdirSync(quarantineDir,{recursive:true});
  const safe=p.replace(/[\\/]/g,"__");
  const q=path.join(quarantineDir,`${Date.now()}__${safe}`);
  fs.writeFileSync(q,raw);
  console.error(`ARTIFACT_QUARANTINED ${p} -> ${path.relative(root,q)} ${String(error)}`);
  return null;
 }
}
function readRequired(p:string){const v=read(p);if(v===null)throw new Error(`REQUIRED_JSON_INVALID ${p}`);return v;}
const exists=(p:string)=>fs.existsSync(path.join(root,p));
function researchUsable(p:string){
 if(!exists(p)) return false;
 const r=read(p);
 if(!r||r.schema!=="fih-research-v1"||r.date!==DATE) return false;
 const overall=r.verifiedInputs?.overallMatchSeries;
 return Array.isArray(overall?.home)&&Array.isArray(overall?.away);
}
const tsx=(...args:string[])=>execFileSync(process.execPath,["node_modules/tsx/dist/cli.mjs",...args],{stdio:"inherit",env:process.env});
const ledgerPath=`data/run-state/${DATE}.json`;
const queuePath=`data/research-queue/${DATE}.json`;

function show(){const l=readRequired(ledgerPath);console.log(JSON.stringify({date:DATE,status:l.runStatus,counts:l.counts,next:l.next},null,2));return l;}

console.log(`FIH prediction controller: ${DATE} mode=${MODE}`);
const boardPath=`data/prediction-fixtures/${DATE}.json`;
const board=readRequired(boardPath);
if(board.date!==DATE||board.mode!=="PREDICTION") throw new Error(`Prediction-board gate failed: expected PREDICTION ${DATE}, got ${board.mode} ${board.date}`);
if(!board.fixtureCount) throw new Error("Prediction-board gate failed: empty board");

tsx("scripts/daily-run-ledger.ts","reconcile",DATE);
let ledger=show();
const researchQueue:any[]=[];

for(const f of ledger.fixtures.filter((x:any)=>x.eligible)){
 const research=`data/research/${DATE}/${f.id}.json`;
 const model=`data/model/${DATE}/${f.id}.json`;
 const decision=`data/decisions/${DATE}/${f.id}.json`;
 if(!researchUsable(research)){
  researchQueue.push({fixtureId:String(f.id),home:f.home,away:f.away,competition:f.competition,kickoff:f.kickoff,query:`${f.home} ${f.away} ${DATE} recent form last 5 H2H standings injuries odds`});
  console.log(`RESEARCH_REQUIRED ${f.id} ${f.home} vs ${f.away}`);
  continue;
 }
 if(!exists(model)){console.log(`MODEL_REQUIRED ${f.id}`);continue;}
 if(!exists(decision)){
  const m=read(model);
  if(!m){ console.error(`MODEL_INVALID ${f.id}; quarantined, continuing`); continue; }
  if(m.status==="INSUFFICIENT_DATA"){
   fs.mkdirSync(path.dirname(path.join(root,decision)),{recursive:true});
   fs.writeFileSync(path.join(root,decision),JSON.stringify({schema:"fih-decision-v1",date:DATE,fixtureId:String(f.id),decision:"NO_MODEL",publishable:false,reason:"INSUFFICIENT_VERIFIED_MODEL_INPUT",decidedAt:new Date().toISOString()},null,2)+"\n");
   console.log(`DECISION_WRITTEN ${f.id} NO_MODEL`);
  } else console.log(`DECISION_REQUIRED ${f.id} market/value verification needed`);
 }
}

fs.mkdirSync(path.dirname(path.join(root,queuePath)),{recursive:true});
fs.writeFileSync(path.join(root,queuePath),JSON.stringify({schema:"fih-research-queue-v1",date:DATE,generatedAt:new Date().toISOString(),count:researchQueue.length,fixtures:researchQueue},null,2)+"\n");
console.log(`RESEARCH_QUEUE_WRITTEN ${researchQueue.length}`);

if(researchQueue.length){
 console.log(`DIRECT_RESEARCH_START ${researchQueue.length}`);
 try{
  tsx("scripts/direct-public-research.ts");
  tsx("scripts/research-worker.ts");
  console.log("DIRECT_RESEARCH_PERSISTED");
 }catch(e){
  console.error("DIRECT_RESEARCH_DEGRADED: public evidence unavailable or incomplete; continuing reconciliation.");
 }
}

tsx("scripts/daily-run-ledger.ts","reconcile",DATE);
ledger=show();

console.log("DAILY_MODEL_START");
try{tsx("scripts/daily-model-runner.ts");}catch(e){console.error("DAILY_MODEL_DEGRADED: invalid research/model artifact encountered; continuing reconciliation.");}

for(const f of ledger.fixtures.filter((x:any)=>x.eligible)){
 const model=`data/model/${DATE}/${f.id}.json`;
 const decision=`data/decisions/${DATE}/${f.id}.json`;
 if(!exists(model)) continue;
 if(!exists(decision)){
  const m=read(model);
  if(!m){ console.error(`MODEL_INVALID ${f.id}; quarantined, continuing`); continue; }
  if(m.status==="INSUFFICIENT_DATA"){
   fs.mkdirSync(path.dirname(path.join(root,decision)),{recursive:true});
   fs.writeFileSync(path.join(root,decision),JSON.stringify({schema:"fih-decision-v1",date:DATE,fixtureId:String(f.id),decision:"NO_MODEL",publishable:false,reason:"INSUFFICIENT_VERIFIED_MODEL_INPUT",decidedAt:new Date().toISOString()},null,2)+"\\n");
   const verify=read(decision);
   if(!verify){ console.error(`DECISION_INVALID ${f.id}; quarantined, continuing`); continue; }
   if(verify.fixtureId!==String(f.id)||verify.decision!=="NO_MODEL") throw new Error(`DECISION_PERSIST_VERIFY_FAILED ${f.id}`);
   console.log(`DECISION_WRITTEN ${f.id} NO_MODEL`);
  } else console.log(`DECISION_REQUIRED ${f.id} market/value verification needed`);
 }
}

console.log("DAILY_MARKET_START");
try{tsx("scripts/daily-market-runner.ts");}catch(e){console.error("DAILY_MARKET_DEGRADED: verified current market evidence unavailable; continuing to NO_BET decisions.");}

console.log("DAILY_DECISION_START");
try{tsx("scripts/daily-decision-runner.ts");}catch(e){console.error("DAILY_DECISION_DEGRADED: invalid model/decision artifact encountered; continuing reconciliation.");}

tsx("scripts/daily-run-ledger.ts","reconcile",DATE);
ledger=show();
const unfinished=ledger.fixtures.filter((x:any)=>x.eligible&&x.state!=="COMPLETE");
if(unfinished.length){
 console.log("DAILY_CYCLE_RECOVERING");
 for(const f of unfinished) console.log(`${f.id} ${f.state} ${f.home} vs ${f.away}`);
 tsx("scripts/contract-gate.ts","--verdict","RECOVERING","--date",DATE,"--rules","REC-001,REC-005,RESUME-001,RESP-001","--evidence",`ledger:${ledgerPath},unfinished:${unfinished.length}`);
 throw new Error(`FIH_RUN_UNFINISHED_RESUME_REQUIRED ${unfinished.length} eligible fixtures remain; this is RECOVERING, not a terminal state`);
}

console.log("DAILY_FIXTURE_CHAIN_COMPLETE");
const eligible=ledger.fixtures.filter((x:any)=>x.eligible);
const publishable:any[]=[];
for(const f of eligible){
 const rp=`data/research/${DATE}/${f.id}.json`, mp=`data/model/${DATE}/${f.id}.json`, dp=`data/decisions/${DATE}/${f.id}.json`;
 for(const p of [rp,mp,dp]) if(!exists(p)||read(p)===null) throw new Error(`CANONICAL_ARTIFACT_INVALID ${p}`);
 const d=readRequired(dp);
 if(d.publishable===true) publishable.push({fixtureId:String(f.id),home:f.home,away:f.away,competition:f.competition,kickoff:f.kickoff,decision:d.decision,market:d.market??null,modelVersion:d.modelVersion??null,reason:d.reason??null});
}
const predictionPath=`data/predictions/${DATE}.json`;
fs.mkdirSync(path.dirname(path.join(root,predictionPath)),{recursive:true});
const prediction={schema:"fih-daily-predictions-v1",date:DATE,status:"COMPLETE",generatedAt:new Date().toISOString(),eligibleFixtures:eligible.length,publishableCount:publishable.length,predictions:publishable};
fs.writeFileSync(path.join(root,predictionPath),JSON.stringify(prediction,null,2)+"\n");
const predictionVerify=readRequired(predictionPath);
if(predictionVerify.schema!=="fih-daily-predictions-v1"||predictionVerify.date!==DATE||!Array.isArray(predictionVerify.predictions)||predictionVerify.publishableCount!==predictionVerify.predictions.length) throw new Error("PREDICTION_ARTIFACT_VERIFY_FAILED");
if(ledger.counts?.eligible!==eligible.length||ledger.counts?.COMPLETE!==eligible.length||ledger.next!==null) throw new Error("AGGREGATE_RECONCILIATION_FAILED");
console.log(`DAILY_AGGREGATE_VERIFIED eligible=${eligible.length} publishable=${publishable.length}`);
console.log("DAILY_FINALIZATION_READY");
