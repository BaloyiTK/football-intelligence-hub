import {spawnSync} from "node:child_process";
const args=process.argv.slice(2), val=(n:string)=>{const i=args.indexOf(n);return i<0?undefined:args[i+1]};
const from=val("--from"),to=val("--to"),source=val("--source");
if(!from||!to||!source){console.error("Usage: npm run backtest:run -- --from YYYY-MM-DD --to YYYY-MM-DD --source data/backtest-evidence/raw.json");process.exit(1)}
const collect=spawnSync(process.execPath,["--import","tsx","scripts/collect-backtest-evidence.ts","--from",from,"--to",to,"--source",source],{stdio:"inherit"});
if(collect.status!==0)process.exit(collect.status??1);
const evidence=`data/backtest-evidence/${from}_to_${to}.json`;
const run=spawnSync(process.execPath,["--import","tsx","scripts/backtest.ts","--from",from,"--to",to,"--evidence",evidence],{stdio:"inherit"});
process.exit(run.status??1);
