import fs from "node:fs";
import path from "node:path";
const root=process.cwd(),queuePath=path.join(root,"data/backtest/market-queue.json"),sourcesPath=path.join(root,"config/historical-market-sources.json"),out=path.join(root,"data/backtest/market-research-plan.json");
if(!fs.existsSync(queuePath))throw new Error("HISTORICAL_MARKET_QUEUE_MISSING");
const q=JSON.parse(fs.readFileSync(queuePath,"utf8")),sources=JSON.parse(fs.readFileSync(sourcesPath,"utf8"));
const tasks=(q.fixtures||[]).map((f:any)=>({...f,query:`${f.home} vs ${f.away} ${f.date} historical pre-match odds`,acceptance:{mustBeBeforeKickoff:true,mustHaveSourceUrl:true,mustHaveExplicitPrice:true,mustNotUsePostMatchResultToInferPrice:true}}));
fs.writeFileSync(out,JSON.stringify({schema:"fih-historical-market-research-plan-v1",generatedAt:new Date().toISOString(),count:tasks.length,sources:sources.sources,tasks},null,2)+"\n");
console.log(JSON.stringify({count:tasks.length,out},null,2));
