import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const root=process.cwd();
const read=(p:string)=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const exists=(p:string)=>fs.existsSync(path.join(root,p));
const tsx=(...args:string[])=>execFileSync(process.execPath,["node_modules/tsx/dist/cli.mjs",...args],{stdio:"inherit",env:process.env});
const ledgerPath=`data/run-state/${DATE}.json`;
const queuePath=`data/research-queue/${DATE}.json`;

function show(){const l=read(ledgerPath);console.log(JSON.stringify({date:DATE,status:l.runStatus,counts:l.counts,next:l.next},null,2));return l;}

console.log(`FIH daily controller: ${DATE}`);
const board=read("data/today_fixture.json");
if(board.date!==DATE) throw new Error(`Fresh-board gate failed: expected ${DATE}, got ${board.date}`);
if(!board.fixtureCount) throw new Error("Fresh-board gate failed: empty board");

tsx("scripts/daily-run-ledger.ts","reconcile",DATE);
let ledger=show();
const researchQueue:any[]=[];

for(const f of ledger.fixtures.filter((x:any)=>x.eligible)){
 const research=`data/research/${DATE}/${f.id}.json`;
 const model=`data/model/${DATE}/${f.id}.json`;
 const decision=`data/decisions/${DATE}/${f.id}.json`;
 if(!exists(research)){
  researchQueue.push({fixtureId:String(f.id),home:f.home,away:f.away,competition:f.competition,kickoff:f.kickoff,query:`${f.home} ${f.away} ${DATE} recent form last 5 H2H standings injuries odds`});
  console.log(`RESEARCH_REQUIRED ${f.id} ${f.home} vs ${f.away}`);
  continue;
 }
 if(!exists(model)){console.log(`MODEL_REQUIRED ${f.id}`);continue;}
 if(!exists(decision)){
  const m=read(model);
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
  if(m.status==="INSUFFICIENT_DATA"){
   fs.mkdirSync(path.dirname(path.join(root,decision)),{recursive:true});
   fs.writeFileSync(path.join(root,decision),JSON.stringify({schema:"fih-decision-v1",date:DATE,fixtureId:String(f.id),decision:"NO_MODEL",publishable:false,reason:"INSUFFICIENT_VERIFIED_MODEL_INPUT",decidedAt:new Date().toISOString()},null,2)+"\\n");
   const verify=read(decision);
   if(verify.fixtureId!==String(f.id)||verify.decision!=="NO_MODEL") throw new Error(`DECISION_PERSIST_VERIFY_FAILED ${f.id}`);
   console.log(`DECISION_WRITTEN ${f.id} NO_MODEL`);
  } else console.log(`DECISION_REQUIRED ${f.id} market/value verification needed`);
 }
}

tsx("scripts/daily-run-ledger.ts","reconcile",DATE);
ledger=show();
const unfinished=ledger.fixtures.filter((x:any)=>x.eligible&&x.state!=="COMPLETE");
if(unfinished.length){
 console.log("DAILY_CYCLE_INCOMPLETE");
 for(const f of unfinished) console.log(`${f.id} ${f.state} ${f.home} vs ${f.away}`);
 process.exitCode=2;
} else console.log("DAILY_FIXTURE_CHAIN_COMPLETE");
