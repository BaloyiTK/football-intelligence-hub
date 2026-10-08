import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {validateDailyResearch} from "./research-canonical";
type Verdict="PASS"|"RECOVERING"|"WAITING"|"BLOCKED"|"COMPLETE";
const CODE_ROOT=process.cwd();
const DATA_ROOT=process.env.FIH_ROOT||CODE_ROOT;
const arg=(n:string)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:undefined};
const rules=JSON.parse(fs.readFileSync(CODE_ROOT+"/config/fih-execution-rules.json","utf8"));
const ledgerPath=(d:string)=>DATA_ROOT+"/data/run-state/"+d+".json";
function fail(m:string):never{throw new Error("CONTRACT_GATE_REFUSED: "+m)}
function csv(v?:string){return (v||"").split(",").map(x=>x.trim()).filter(Boolean)}
const verdict=(arg("--verdict")||"PASS") as Verdict,date=arg("--date"),ruleIds=csv(arg("--rules")),evidence=csv(arg("--evidence")),attempts=csv(arg("--attempts")),hardStop=arg("--hard-stop"),terminal=process.argv.includes("--terminal");
if(!["PASS","RECOVERING","WAITING","BLOCKED","COMPLETE"].includes(verdict))fail("invalid verdict");
if(!ruleIds.length)fail("every verdict requires --rules");
for(const id of ruleIds)if(!rules.rules[id])fail("unknown rule "+id);
if(!evidence.length)fail("every verdict requires verifiable --evidence");
if(terminal&&date&&fs.existsSync(ledgerPath(date))){
 const l=JSON.parse(fs.readFileSync(ledgerPath(date),"utf8"));
 const unfinished=(l.fixtures||[]).filter((x:any)=>x.eligible!==false&&x.state!=="COMPLETE");
 if(unfinished.length&&verdict!=="BLOCKED"&&verdict!=="WAITING")fail("RESP-001 terminal response refused: authorized run remains "+l.runStatus+" with "+unfinished.length+" unfinished eligible fixtures");
}
if(verdict==="BLOCKED"){
 if(!hardStop||!rules.hardStops.includes(hardStop))fail("BLOCKED requires a defined --hard-stop");
 if(!ruleIds.includes("TERM-001")||!ruleIds.includes("REC-003"))fail("BLOCKED requires TERM-001 and REC-003");
 const required=["canonical-retry","investigate-repair","authorized-fallback","persist-reconcile","resume-check"];
 for(const x of required)if(!attempts.includes(x))fail("BLOCKED recovery not exhausted: missing "+x);
}
if(verdict==="WAITING"&&!ruleIds.includes("TERM-003"))fail("WAITING requires TERM-003");
if(verdict==="COMPLETE"){
 if(!date)fail("COMPLETE requires --date");
 if(!ruleIds.includes("TERM-002"))fail("COMPLETE requires TERM-002");
 if(!fs.existsSync(ledgerPath(date)))fail("COMPLETE requires persisted run ledger");
 const l=JSON.parse(fs.readFileSync(ledgerPath(date),"utf8"));
 if(l.date!==date)fail("ledger date mismatch");
 if(l.runStatus!=="COMPLETE")fail("ledger runStatus is not COMPLETE");
 const pp=DATA_ROOT+"/data/predictions/"+date+".json";
 if(!fs.existsSync(pp))fail("dated prediction artifact missing");
 const pred=JSON.parse(fs.readFileSync(pp,"utf8"));
 if(pred.schema!=="fih-daily-predictions-v1"||pred.date!==date||!Array.isArray(pred.predictions)||pred.publishableCount!==pred.predictions.length)fail("dated prediction artifact invalid");
 const eligible=l.fixtures.filter((x:any)=>x.eligible!==false);
 const unfinished=eligible.filter((x:any)=>x.state!=="COMPLETE");
 if(unfinished.length)fail("eligible fixtures unfinished: "+unfinished.length);
 if(l.counts?.eligible!==eligible.length||l.counts?.COMPLETE!==eligible.length)fail("ledger completion counts do not reconcile");
 const researchValidation=validateDailyResearch(DATA_ROOT,date,eligible.map((x:any)=>String(x.id)),"PREDICTION");
 if(!researchValidation.researchRunId)fail("canonical research generation identity missing");
 if(!l.researchRunId||l.researchRunId!==researchValidation.researchRunId)fail("ledger completion is not bound to current canonical research generation");
 const canonical=[["research","fih-daily-research-v3"],["model","fih-daily-model-v2"],["decisions","fih-daily-decisions-v2"]] as const;
 const ids=eligible.map((x:any)=>String(x.id)).sort();
 for(const [kind,schema] of canonical){const p=DATA_ROOT+"/data/"+kind+"/"+date+".json";if(!fs.existsSync(p))fail("canonical daily artifact missing "+p);const x=JSON.parse(fs.readFileSync(p,"utf8"));if(x.schema!==schema||x.date!==date||!Array.isArray(x.fixtures))fail("canonical daily artifact invalid "+kind);const raw=x.fixtures.map((r:any)=>String(r.fixtureId));if(raw.length!==new Set(raw).size)fail("canonical artifact duplicate fixture "+kind);const got=raw.sort();if(JSON.stringify(got)!==JSON.stringify(ids))fail("canonical artifact coverage mismatch "+kind);}
 if(pred.eligibleFixtures!==eligible.length)fail("prediction eligible count mismatch");
 try{const paths=["data/research/"+date+".json","data/model/"+date+".json","data/decisions/"+date+".json","data/predictions/"+date+".json","data/run-state/"+date+".json"];const dirty=execFileSync("git",["status","--porcelain","--",...paths],{cwd:DATA_ROOT,encoding:"utf8"});if(dirty.trim())fail("required completion artifacts have uncommitted changes");for(const p of paths)execFileSync("git",["ls-files","--error-unmatch",p],{cwd:DATA_ROOT,stdio:"ignore"});const head=execFileSync("git",["rev-parse","HEAD"],{cwd:DATA_ROOT,encoding:"utf8"}).trim();if(!/^[0-9a-f]{40}$/i.test(head))fail("repository HEAD invalid");const verified=process.env.FIH_VERIFIED_COMMIT_SHA;if(!verified||!/^[0-9a-f]{40}$/i.test(verified))fail("FIH_VERIFIED_COMMIT_SHA missing/invalid");if(verified!==head)fail("verified commit does not equal HEAD");const remote=execFileSync("git",["rev-parse","origin/main"],{cwd:DATA_ROOT,encoding:"utf8"}).trim();if(remote!==head)fail("HEAD is not verified origin/main")}catch(e){fail("independent commit verification failed: "+String(e))}
}
console.log(JSON.stringify({ok:true,contractGate:"PASS",verdict,date:date||null,rules:ruleIds,evidence,hardStop:hardStop||null},null,2));