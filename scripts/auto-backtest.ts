import {spawnSync} from "node:child_process";
const args=process.argv.slice(2),v=(n:string)=>{const i=args.indexOf(n);return i<0?undefined:args[i+1]},from=v("--from"),to=v("--to");
if(!from||!to)throw new Error("Usage: npm run backtest:auto -- --from YYYY-MM-DD --to YYYY-MM-DD");
const call=(script:string,extra:string[]=[])=>{const r=spawnSync(process.execPath,["--import","tsx",script,"--from",from,"--to",to,...extra],{stdio:"inherit",env:process.env});if(r.status!==0)process.exit(r.status??1)};
call("scripts/research-backtest.ts");
const source=`data/backtest-evidence/${from}_to_${to}.source.json`;call("scripts/collect-backtest-evidence.ts",["--source",source]);
const evidence=`data/backtest-evidence/${from}_to_${to}.json`;call("scripts/backtest.ts",["--evidence",evidence]);
