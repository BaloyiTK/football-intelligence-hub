import fs from "node:fs";
const TZ="Africa/Johannesburg",ROOT=process.env.FIH_ROOT||process.cwd();
const date=process.argv.includes("--date")?process.argv[process.argv.indexOf("--date")+1]:new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const p=ROOT+"/data/run-state/"+date+".json";
const maxStale=Number(process.env.FIH_STALE_MINUTES||"20");
if(!Number.isFinite(maxStale)||maxStale<=0)throw new Error("FIH_STALE_MINUTES must be a finite positive number");
const now=Date.now();
let action="START_OR_RESUME",reason="NO_LEDGER",ledger:any=null;
if(fs.existsSync(p)){try{ledger=JSON.parse(fs.readFileSync(p,"utf8"));}catch{reason="MALFORMED_LEDGER"}}
if(ledger){
 const age=(now-Date.parse(ledger.heartbeatAt||ledger.updatedAt||0))/60000;
 const eligible=(ledger.fixtures||[]).filter((x:any)=>x.eligible!==false);
 const unfinished=eligible.filter((x:any)=>x.state!=="COMPLETE");
 if(ledger.runStatus==="COMPLETE"&&!unfinished.length){action="NOOP";reason="ALREADY_COMPLETE"}
 else if(age>maxStale){action="RECOVER";reason="STALE_HEARTBEAT"}
 else if(ledger.runStatus==="RUNNING"||ledger.runStatus==="RECOVERING"){action="NOOP";reason="ACTIVE_HEARTBEAT"}
 else {action="RECOVER";reason="INCOMPLETE_STATE"}
}
console.log(JSON.stringify({schema:"fih-watchdog-v1",date,action,reason,runId:ledger?.runId||("daily:"+date),next:ledger?.next||null},null,2));
if(action==="RECOVER"||action==="START_OR_RESUME")process.exitCode=10;