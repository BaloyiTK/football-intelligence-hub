import fs from "node:fs";
import path from "node:path";

type Row={
  date:string; leagueId:string; outcome:"WIN"|"LOSS";
  lambdaHome?:number; lambdaAway?:number;
  score?:string; actualScore?:{home:number;away:number};
  recommendedBet:{
    pick:string; market:string; probability:number; selectionProbability?:number;
    rawProbability:number; reliability?:number; rating:string;
    support?:{rawProbability:number;minimum:number};
    riskFlags?:string[];
  };
};

const r=JSON.parse(fs.readFileSync(path.join(process.cwd(),"data/backtests/2026-04-08_to_2026-10-04.json"),"utf8"));
const rows:Row[]=r.fixtures;
const losses=rows.filter(x=>x.outcome==="LOSS"),wins=rows.filter(x=>x.outcome==="WIN");

function summary(xs:Row[]){
 const w=xs.filter(x=>x.outcome==="WIN").length;
 return {bets:xs.length,wins:w,losses:xs.length-w,hitRate:xs.length?+(100*w/xs.length).toFixed(1):null};
}
function group(xs:Row[],key:(x:Row)=>string){
 const m=new Map<string,Row[]>();
 for(const x of xs){const k=key(x);if(!m.has(k))m.set(k,[]);m.get(k)!.push(x)}
 return [...m.entries()].map(([key,v])=>({key,...summary(v)})).sort((a,b)=>b.bets-a.bets);
}
const band=(p:number,step=2)=>`${Math.floor(p/step)*step}-${Math.floor(p/step)*step+step-0.1}`;
const lambdaBand=(x:number)=>x<.8?"<0.8":x<1.2?"0.8-1.19":x<1.6?"1.2-1.59":x<2?"1.6-1.99":x<2.5?"2.0-2.49":">=2.5";

const out={
 overall:summary(rows),
 losses:losses.length,
 byPick:group(rows,x=>x.recommendedBet.pick),
 byLeague:group(rows,x=>x.leagueId),
 byProbabilityBand:group(rows,x=>band(x.recommendedBet.probability)),
 bySelectionProbabilityBand:group(rows,x=>band(x.recommendedBet.selectionProbability??x.recommendedBet.probability)),
 byRawBand:group(rows,x=>band(x.recommendedBet.rawProbability)),
 byRating:group(rows,x=>x.recommendedBet.rating),
 bySupportMargin:group(rows,x=>{
   const s=x.recommendedBet.support;
   if(!s)return "none";
   const m=s.rawProbability-s.minimum;
   return m<2?"0-1.9":m<5?"2-4.9":m<10?"5-9.9":">=10";
 }),
 byLambdaHome:group(rows,x=>lambdaBand(x.lambdaHome??0)),
 byLambdaAway:group(rows,x=>lambdaBand(x.lambdaAway??0)),
 byLambdaTotal:group(rows,x=>lambdaBand((x.lambdaHome??0)+(x.lambdaAway??0))),
 lossLeagueCounts:group(losses,x=>x.leagueId),
 lossPickCounts:group(losses,x=>x.recommendedBet.pick),
 lossProbBands:group(losses,x=>band(x.recommendedBet.probability)),
 lossSupportMargins:group(losses,x=>{
   const s=x.recommendedBet.support;
   if(!s)return "none";
   const m=s.rawProbability-s.minimum;
   return m<2?"0-1.9":m<5?"2-4.9":m<10?"5-9.9":">=10";
 }),
 lossLambdaTotal:group(losses,x=>lambdaBand((x.lambdaHome??0)+(x.lambdaAway??0)))
};
console.log(JSON.stringify(out,null,2));