import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root=process.cwd(), backDir=path.join(root,"data","backtests"), predDir=path.join(root,"data","predictions"), canonicalFile=path.join(root,"data","training","model-training-data.jsonl");
const dryRun=process.argv.includes("--check");
const logDir=path.join(root,"data","training"), logFile=path.join(logDir,"training-log.jsonl"), candidateFile=path.join(logDir,"candidate-v2.4.json");
fs.mkdirSync(logDir,{recursive:true});
const readJson=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
const completedBacktests=fs.existsSync(backDir)?fs.readdirSync(backDir).filter(f=>f.endsWith(".json")).map(f=>({file:f,data:readJson(path.join(backDir,f))})).filter(x=>x.data.status==="complete"):[];
const archives=fs.existsSync(predDir)?fs.readdirSync(predDir).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(f=>({file:f,data:readJson(path.join(predDir,f))})):[];
const backRows=completedBacktests.flatMap(x=>(x.data.fixtures??[]).filter((f:any)=>f.recommendedBet&&["WIN","LOSS"].includes(f.outcome)).map((f:any)=>({...f,source:"backtest:"+x.file})));
const archiveRows=archives.flatMap(x=>(x.data.fixtures??[]).filter((f:any)=>f.model?.recommendedBet&&["WIN","LOSS"].includes(f.result?.outcome)).map((f:any)=>({date:x.data.date,leagueId:f.leagueId??f.league??"",homeTeam:f.homeTeam,awayTeam:f.awayTeam,recommendedBet:f.model.recommendedBet,outcome:f.result.outcome,modelLevel:f.model.modelLevel,source:"archive:"+x.file})));
const canonicalLines=fs.existsSync(canonicalFile)?fs.readFileSync(canonicalFile,"utf8").trim().split("\n").slice(1).filter(Boolean):[];
const canonicalRows=canonicalLines.map(line=>JSON.parse(line));
const unique=new Map<string,any>();
for(const r of [...canonicalRows,...backRows,...archiveRows]){const k=[r.date,r.leagueId??"",r.homeTeam??"",r.awayTeam??"",r.recommendedBet.market,r.recommendedBet.pick].join("|");if(!unique.has(k))unique.set(k,r)}
const rows=[...unique.values()].filter((x:any)=>x.recommendedBet?.market==="1X2").sort((a,b)=>String(a.date).localeCompare(String(b.date)));
const split=Math.max(0,Math.floor(rows.length*.8)), train=rows.slice(0,split), holdout=rows.slice(split);
const metrics=(xs:any[])=>{const wins=xs.filter(x=>x.outcome==="WIN").length;const n=xs.length;const brier=n?xs.reduce((s,x)=>{const p=Number(x.recommendedBet.probability)/100,y=x.outcome==="WIN"?1:0;return s+(p-y)**2},0)/n:null;return{bets:n,wins,losses:n-wins,hitRate:n?+(100*wins/n).toFixed(1):null,brier:brier==null?null:+brier.toFixed(4)}};
const by=(xs:any[],key:(x:any)=>string)=>Object.values(xs.reduce((a:any,x:any)=>{const k=key(x);(a[k]??=[]).push(x);return a},{})).map((g:any)=>({key:key(g[0]),...metrics(g)}));
const baseline={version:"v2.3-backtest-calibrated-selector",blend:{stable:.65,recent:.35},rho:-.08,adjustedFloor:68,calibrationTemperature:1};
const clampP=(p:number)=>Math.min(.999,Math.max(.501,p));
const calibrate=(p:number,t:number)=>{const q=clampP(p);const logit=Math.log(q/(1-q));return 1/(1+Math.exp(-logit/t));};
const scoreTemp=(xs:any[],t:number)=>xs.length?xs.reduce((s,x)=>{const p=calibrate(Number(x.recommendedBet.probability)/100,t),y=x.outcome==="WIN"?1:0;return s+(p-y)**2},0)/xs.length:Infinity;
const temperatures=Array.from({length:25},(_,k)=>+(0.70+k*.025).toFixed(3));
const optimizeTemperature=(xs:any[])=>temperatures.map(t=>({t,brier:scoreTemp(xs,t)})).sort((a,b)=>a.brier-b.brier)[0]??{t:1,brier:Infinity};
const optimized=optimizeTemperature(train);
const calibratedMetrics=(xs:any[],t:number)=>{const wins=xs.filter(x=>x.outcome==="WIN").length,n=xs.length;const brier=n?scoreTemp(xs,t):null;return{bets:n,wins,losses:n-wins,hitRate:n?+(100*wins/n).toFixed(1):null,brier:brier==null?null:+brier.toFixed(4)}};
const walkForward=(()=>{
 const start=Math.max(20,Math.floor(rows.length*.5));const folds:any[]=[];
 for(let end=start;end<rows.length;end++){const prior=rows.slice(0,end),test=rows[end];const opt=optimizeTemperature(prior);const p=calibrate(Number(test.recommendedBet.probability)/100,opt.t),y=test.outcome==="WIN"?1:0;folds.push({date:test.date,temperature:opt.t,baselineBrier:(Number(test.recommendedBet.probability)/100-y)**2,candidateBrier:(p-y)**2});}
 const n=folds.length;return{folds:n,baselineBrier:n?+(folds.reduce((s,x)=>s+x.baselineBrier,0)/n).toFixed(4):null,candidateBrier:n?+(folds.reduce((s,x)=>s+x.candidateBrier,0)/n).toFixed(4):null,passed:n>=20&&folds.reduce((s,x)=>s+x.candidateBrier,0)<folds.reduce((s,x)=>s+x.baselineBrier,0)};
})();
const baselineHoldout=metrics(holdout),candidateHoldout=calibratedMetrics(holdout,optimized.t);
const enough=rows.length>=100&&holdout.length>=20;
const lowerBrier=baselineHoldout.brier!=null&&candidateHoldout.brier!=null&&candidateHoldout.brier<baselineHoldout.brier;
const noRegression=(candidateHoldout.hitRate??0)>=(baselineHoldout.hitRate??0)-2;
const promotable=enough&&walkForward.passed&&lowerBrier&&noRegression;
const candidate={version:"v2.4-self-calibration-candidate",status:"candidate",generatedAt:new Date().toISOString(),baseline,optimization:{method:"chronological temperature calibration",searchGrid:{min:.70,max:1.30,step:.025},selectedTemperature:optimized.t,trainingBrier:+optimized.brier.toFixed(4)},training:{rows:train.length,baseline:metrics(train),candidate:calibratedMetrics(train,optimized.t)},holdout:{rows:holdout.length,baseline:baselineHoldout,candidate:candidateHoldout},walkForward,diagnostics:{byPick:by(rows,x=>x.recommendedBet.pick),byRating:by(rows,x=>x.recommendedBet.rating),byModelLevel:by(rows,x=>x.modelLevel??"unknown")},parameters:{blend:baseline.blend,rho:baseline.rho,adjustedFloor:baseline.adjustedFloor,calibrationTemperature:optimized.t},promotionGate:{minimumTotalBets:100,minimumHoldoutBets:20,requiresLowerBrier:true,requiresNoMaterialHitRateRegression:true,walkForwardRequired:true,checks:{enoughSample:enough,lowerHoldoutBrier:lowerBrier,noMaterialHitRateRegression:noRegression,walkForwardPassed:walkForward.passed}},decision:promotable?"READY_FOR_EXPLICIT_PROMOTION":"NOT_PROMOTED",reason:!enough?"Insufficient graded sample for promotion.":!walkForward.passed?"Walk-forward calibration has not beaten V2.3.":!lowerBrier?"Candidate did not improve holdout Brier score.":!noRegression?"Candidate hit rate regressed materially.":"All statistical gates passed; explicit versioned promotion is still required."};
if(!dryRun) fs.writeFileSync(candidateFile,JSON.stringify(candidate,null,2)+"\n");
const entry={id:crypto.randomUUID(),timestamp:new Date().toISOString(),event:"TRAINING_ATTEMPT",productionModel:baseline.version,candidateModel:candidate.version,sources:{completedBacktests:completedBacktests.map(x=>x.file),predictionArchives:archives.map(x=>x.file)},dataset:{total:rows.length,train:candidate.training,holdout:candidate.holdout},optimization:candidate.optimization,walkForward:candidate.walkForward,promotionGate:candidate.promotionGate,diagnostics:candidate.diagnostics,decision:candidate.decision,reason:candidate.reason,candidateFile:path.relative(root,candidateFile)};
if(!dryRun) fs.appendFileSync(logFile,JSON.stringify(entry)+"\n");
console.log(JSON.stringify({...entry,dryRun},null,2));