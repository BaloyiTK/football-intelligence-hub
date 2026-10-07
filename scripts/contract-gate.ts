import fs from "node:fs";
type Verdict="PASS"|"RECOVERING"|"WAITING"|"BLOCKED"|"COMPLETE";
const ROOT=process.cwd();
const arg=(n:string)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:undefined};
const rules=JSON.parse(fs.readFileSync(ROOT+"/config/fih-execution-rules.json","utf8"));
const ledgerPath=(d:string)=>ROOT+"/data/run-state/"+d+".json";
function fail(m:string):never{throw new Error("CONTRACT_GATE_REFUSED: "+m)}
function csv(v?:string){return (v||"").split(",").map(x=>x.trim()).filter(Boolean)}
const verdict=(arg("--verdict")||"PASS") as Verdict,date=arg("--date"),ruleIds=csv(arg("--rules")),evidence=csv(arg("--evidence")),attempts=csv(arg("--attempts")),hardStop=arg("--hard-stop");
if(!["PASS","RECOVERING","WAITING","BLOCKED","COMPLETE"].includes(verdict))fail("invalid verdict");
if(!ruleIds.length)fail("every verdict requires --rules");
for(const id of ruleIds)if(!rules.rules[id])fail("unknown rule "+id);
if(!evidence.length)fail("every verdict requires verifiable --evidence");
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
 const eligible=l.fixtures.filter((x:any)=>x.eligible!==false);
 const unfinished=eligible.filter((x:any)=>x.state!=="COMPLETE");
 if(unfinished.length)fail("eligible fixtures unfinished: "+unfinished.length);
 if(l.counts?.eligible!==eligible.length||l.counts?.COMPLETE!==eligible.length)fail("ledger completion counts do not reconcile");
 const required=["aggregate-verified","commit-verified","production-deployment-verified"];
 for(const x of required)if(!evidence.includes(x))fail("COMPLETE missing evidence "+x);
}
console.log(JSON.stringify({ok:true,contractGate:"PASS",verdict,date:date||null,rules:ruleIds,evidence,hardStop:hardStop||null},null,2));
