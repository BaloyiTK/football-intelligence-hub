import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root=process.cwd(), backDir=path.join(root,"data","backtests"), predDir=path.join(root,"data","predictions");
const logDir=path.join(root,"data","training"), logFile=path.join(logDir,"training-log.jsonl"), candidateFile=path.join(logDir,"candidate-v2.4.json");
fs.mkdirSync(logDir,{recursive:true});
const readJson=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
const completedBacktests=fs.existsSync(backDir)?fs.readdirSync(backDir).filter(f=>f.endsWith(".json")).map(f=>({file:f,data:readJson(path.join(backDir,f))})).filter(x=>x.data.status==="complete"):[];
const archives=fs.existsSync(predDir)?fs.readdirSync(predDir).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(f=>({file:f,data:readJson(path.join(predDir,f))})):[];
const backRows=completedBacktests.flatMap(x=>(x.data.fixtures??[]).filter((f:any)=>f.recommendedBet&&["WIN","LOSS"].includes(f.outcome)).map((f:any)=>({...f,source:"backtest:"+x.file})));
const archiveRows=archives.flatMap(x=>(x.data.fixtures??[]).filter((f:any)=>f.model?.recommendedBet&&["WIN","LOSS"].includes(f.result?.outcome)).map((f:any)=>({date:x.data.date,recommendedBet:f.model.recommendedBet,outcome:f.result.outcome,modelLevel:f.model.modelLevel,source:"archive:"+x.file})));
const unique=new Map<string,any>();
for(const r of [...backRows,...archiveRows]){const k=[r.date,r.leagueId??"",r.homeTeam??"",r.awayTeam??"",r.recommendedBet.market,r.recommendedBet.pick].join("|");if(!unique.has(k))unique.set(k,r)}
const rows=[...unique.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
const split=Math.max(0,Math.floor(rows.length*.8)), train=rows.slice(0,split), holdout=rows.slice(split);
const metrics=(xs:any[])=>{const wins=xs.filter(x=>x.outcome==="WIN").length;const n=xs.length;const brier=n?xs.reduce((s,x)=>{const p=Number(x.recommendedBet.probability)/100,y=x.outcome==="WIN"?1:0;return s+(p-y)**2},0)/n:null;return{bets:n,wins,losses:n-wins,hitRate:n?+(100*wins/n).toFixed(1):null,brier:brier==null?null:+brier.toFixed(4)}};
const by=(xs:any[],key:(x:any)=>string)=>Object.values(xs.reduce((a:any,x:any)=>{const k=key(x);(a[k]??=[]).push(x);return a},{})).map((g:any)=>({key:key(g[0]),...metrics(g)}));
const baseline={version:"v2.3-backtest-calibrated-selector",blend:{stable:.65,recent:.35},rho:-.08,adjustedFloor:68};
const candidate={version:"v2.4-self-calibration-candidate",status:"candidate",generatedAt:new Date().toISOString(),baseline,training:{rows:train.length,metrics:metrics(train)},holdout:{rows:holdout.length,metrics:metrics(holdout)},diagnostics:{byMarket:by(rows,x=>x.recommendedBet.market),byPick:by(rows,x=>x.recommendedBet.market+" | "+x.recommendedBet.pick),byRating:by(rows,x=>x.recommendedBet.rating),byModelLevel:by(rows,x=>x.modelLevel??"unknown")},parameters:{...baseline,version:undefined},promotionGate:{minimumTotalBets:100,minimumHoldoutBets:20,requiresLowerBrier:true,requiresNoMaterialHitRateRegression:true,walkForwardRequired:true},decision:"NOT_PROMOTED",reason:rows.length<100?"Insufficient graded sample for automatic promotion.":"Candidate parameters require explicit walk-forward optimization before promotion."};
fs.writeFileSync(candidateFile,JSON.stringify(candidate,null,2)+"\n");
const entry={id:crypto.randomUUID(),timestamp:new Date().toISOString(),event:"TRAINING_ATTEMPT",productionModel:baseline.version,candidateModel:candidate.version,sources:{completedBacktests:completedBacktests.map(x=>x.file),predictionArchives:archives.map(x=>x.file)},dataset:{total:rows.length,train:metrics(train),holdout:metrics(holdout)},diagnostics:candidate.diagnostics,decision:candidate.decision,reason:candidate.reason,candidateFile:path.relative(root,candidateFile)};
fs.appendFileSync(logFile,JSON.stringify(entry)+"\n");
console.log(JSON.stringify(entry,null,2));