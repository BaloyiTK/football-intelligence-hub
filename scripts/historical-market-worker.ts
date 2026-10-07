import fs from "node:fs";
import path from "node:path";
const root=process.cwd(),queuePath=path.join(root,"data/backtest/market-queue.json"),inboxPath=path.join(root,"data/backtest/market-inbox.json"),outDir=path.join(root,"data/backtest/market");
if(!fs.existsSync(queuePath))throw new Error("HISTORICAL_MARKET_QUEUE_MISSING");
const q=JSON.parse(fs.readFileSync(queuePath,"utf8")),allowed=new Map((q.fixtures||[]).map((x:any)=>[`${x.date}:${x.fixtureId}`,x]));
if(!fs.existsSync(inboxPath)){console.log("HISTORICAL_MARKET_PROVIDER_REQUIRED");process.exit(2);}
const inbox=JSON.parse(fs.readFileSync(inboxPath,"utf8"));if(inbox.schema!=="fih-historical-market-inbox-v1"||!Array.isArray(inbox.results))throw new Error("INVALID_HISTORICAL_MARKET_INBOX");
let written=0,rejected=0;
for(const r of inbox.results){
 const key=`${r.date}:${r.fixtureId}`,f:any=allowed.get(key);if(!f){rejected++;continue;}
 const urls=Array.isArray(r.sourceUrls)?r.sourceUrls.filter((u:any)=>typeof u==="string"&&/^https?:\/\//.test(u)):[];
 const captured=Date.parse(r.priceTimestamp),kick=Date.parse(r.kickoffTimestamp||"");
 const preKickoff=Number.isFinite(captured)&&Number.isFinite(kick)&&captured<kick;
 if(!preKickoff||!urls.length||r.verified!==true){rejected++;continue;}
 const o=r.oneXTwo||{},vals=[Number(o.home),Number(o.draw),Number(o.away)];
 if(!vals.every(x=>Number.isFinite(x)&&x>1)){rejected++;continue;}
 const inv=vals.map(x=>1/x),sum=inv.reduce((a,b)=>a+b,0);
 const a={schema:"fih-historical-market-v1",date:r.date,fixtureId:String(r.fixtureId),verified:true,priceTimestamp:r.priceTimestamp,kickoffTimestamp:r.kickoffTimestamp,sourceUrls:urls,oneXTwo:{home:vals[0],draw:vals[1],away:vals[2]},margin:sum-1,fairProbability:{home:inv[0]/sum,draw:inv[1]/sum,away:inv[2]/sum}};
 const d=path.join(outDir,r.date);fs.mkdirSync(d,{recursive:true});const p=path.join(d,`${r.fixtureId}.json`);fs.writeFileSync(p,JSON.stringify(a,null,2)+"\n");written++;
}
console.log(JSON.stringify({received:inbox.results.length,written,rejected},null,2));if(rejected)process.exitCode=2;
