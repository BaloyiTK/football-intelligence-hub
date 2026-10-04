import {spawnSync} from "node:child_process";
import fs from "node:fs";

const args=process.argv.slice(2);
const from=args[args.indexOf("--from")+1],to=args[args.indexOf("--to")+1],evidence=args[args.indexOf("--evidence")+1],resume=args.includes("--resume")?args[args.indexOf("--resume")+1]:undefined;
if(!from||!to||!evidence)throw new Error("Usage: npm run backtest:controller -- --from YYYY-MM-DD --to YYYY-MM-DD --evidence <file> [--resume <run>]");
const runArgs=["--from",from,"--to",to,"--evidence",evidence,...(resume?["--resume",resume]:[])];
const run=spawnSync(process.execPath,["--import","tsx","scripts/backtest.ts",...runArgs],{stdio:"inherit"});
if(run.status!==0)process.exit(run.status??1);
if(!resume)throw new Error("Controller requires --resume so it can verify the exact persisted run file.");
const audit=spawnSync(process.execPath,["--import","tsx","scripts/audit-backtest-grading.ts",resume],{stdio:"inherit"});
if(audit.status!==0)process.exit(audit.status??1);
const fin=spawnSync(process.execPath,["--import","tsx","scripts/finalize-run.ts",resume],{stdio:"inherit"});
if(fin.status!==0){
 const r=JSON.parse(fs.readFileSync(resume,"utf8"));
 r.status="blocked";r.blocker="Execution controller reached end of runner but strict finalization failed.";r.current=r.current??{stage:"finalization"};
 fs.writeFileSync(resume,JSON.stringify(r,null,2)+"\n");process.exit(fin.status??2);
}
