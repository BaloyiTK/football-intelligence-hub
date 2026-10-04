import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root=process.cwd();
const args=process.argv.slice(2);
const val=(n:string)=>{const i=args.indexOf(n);return i<0?undefined:args[i+1]};
const explicit=val("--resume");
const maxRetries=Number(val("--max-retries")??"3");
const evidenceArg=val("--evidence");

const candidates=explicit?[explicit]:fs.readdirSync(path.join(root,"data/backtests"))
  .filter(n=>n.endsWith(".json"))
  .map(n=>"data/backtests/"+n)
  .filter(p=>{try{const r=JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));return r.status==="blocked"||r.status==="in-progress"}catch{return false}});

if(!candidates.length){console.log("No blocked/in-progress backtests to resume.");process.exit(0)}

let failed=false;
for(const file of candidates){
 const full=path.join(root,file), report=JSON.parse(fs.readFileSync(full,"utf8"));
 const from=report.range?.start??report.from, to=report.range?.end??report.to;
 if(!from||!to){console.error("Skipping "+file+": missing date range");failed=true;continue}
 const evidence=evidenceArg??report.evidenceFile??`data/backtest-evidence/${from}_to_${to}.json`;
 if(!fs.existsSync(path.join(root,evidence))){console.error("Skipping "+file+": missing evidence "+evidence);failed=true;continue}
 let ok=false;
 for(let attempt=1;attempt<=maxRetries;attempt++){
   console.log(`Resume ${file} attempt ${attempt}/${maxRetries}`);
   const run=spawnSync(process.execPath,["--import","tsx","scripts/backtest.ts","--from",from,"--to",to,"--resume",file,"--evidence",evidence],{stdio:"inherit",env:process.env});
   if(run.status===0){ok=true;break}
   if(attempt<maxRetries){
     const delay=Math.min(30000,1000*Math.pow(2,attempt-1));
     console.log(`Transient failure; retrying in ${delay/1000}s`);
     Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,delay);
   }
 }
 if(!ok)failed=true;
}
process.exit(failed?2:0);
