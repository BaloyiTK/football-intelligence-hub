import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const ROOT=process.env.FIH_ROOT||process.cwd(),TZ="Africa/Johannesburg";
const arg=(n:string)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:undefined};
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const DATE=arg("--date")||process.env.FIH_DATE||today();
if(!/^\d{4}-\d{2}-\d{2}$/.test(DATE))throw new Error("INVALID_FIH_DATE "+DATE);
const maxNoProgress=Number(process.env.FIH_MAX_NO_PROGRESS_PASSES||"3"),ledgerPath=path.join(ROOT,"data","run-state",DATE+".json");
const tsx=(...a:string[])=>spawnSync(process.execPath,["node_modules/tsx/dist/cli.mjs",...a],{stdio:"inherit",env:process.env});
const ledger=()=>fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath,"utf8")):null;
const signature=(l:any)=>l?JSON.stringify({status:l.runStatus,next:l.next,counts:l.counts,fixtures:(l.fixtures||[]).map((f:any)=>[f.id,f.state,f.eligible])}):"NO_LEDGER";
function gate(verdict:string,rules:string,evidence:string,extra:string[]=[]){const r=tsx("scripts/contract-gate.ts","--verdict",verdict,"--date",DATE,"--rules",rules,"--evidence",evidence,...extra);if(r.status!==0)throw new Error("CONTRACT_GATE_FAILED "+verdict)}
let noProgress=0,pass=0;
for(;;){
 pass++;const before=ledger(),beforeSig=signature(before);
 if(before?.runStatus==="COMPLETE"){gate("COMPLETE","TERM-002,EVID-001","aggregate-verified,canonical-artifacts-verified,commit-verified");console.log("CONTINUATION_COMPLETE "+DATE);process.exit(0)}
 console.log(`CONTINUATION_PASS ${pass} date=${DATE} noProgress=${noProgress}`);
 const run=tsx("scripts/daily-cycle.ts","--date",DATE),after=ledger(),afterSig=signature(after);
 if(run.status===0&&after?.runStatus==="COMPLETE"){gate("COMPLETE","TERM-002,EVID-001","aggregate-verified,canonical-artifacts-verified,commit-verified");console.log("CONTINUATION_COMPLETE "+DATE);process.exit(0)}
 if(afterSig!==beforeSig){noProgress=0;gate("RECOVERING","REC-001,REC-005,RESUME-001,EXEC-001","ledger:"+path.relative(ROOT,ledgerPath)+",progress-pass:"+pass);continue}
 noProgress++;gate("RECOVERING","REC-001,REC-002,REC-005,RESUME-001,EXEC-001","ledger:"+path.relative(ROOT,ledgerPath)+",no-progress-pass:"+noProgress);
 if(noProgress<maxNoProgress)continue;
 gate("BLOCKED","TERM-001,REC-003,EVID-001","ledger:"+path.relative(ROOT,ledgerPath)+",same-failure-passes:"+noProgress,["--hard-stop","SAME_FAILURE_AFTER_REASONABLE_BOUNDED_RECOVERY","--attempts","canonical-retry,investigate-repair,authorized-fallback,persist-reconcile,resume-check"]);
 throw new Error(`FIH_HARD_STOP SAME_FAILURE_AFTER_REASONABLE_BOUNDED_RECOVERY after ${noProgress} no-progress passes`);
}
