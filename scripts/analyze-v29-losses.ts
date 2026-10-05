import fs from "node:fs";
import path from "node:path";

type Row={
  date:string; leagueId:string; outcome:"WIN"|"LOSS";
  lambdaHome?:number; lambdaAway?:number;
  homeTeam?:string; awayTeam?:string;
  actualScore?:{home:number;away:number};
  score?:{home:number;away:number}|string;
  recommendedBet:{
    pick:string; probability:number; selectionProbability?:number; rawProbability:number;
    support?:{rawProbability:number;minimum:number}; rating:string;
  };
};

const r=JSON.parse(fs.readFileSync(path.join(process.cwd(),"data/backtests/2026-04-08_to_2026-10-04.json"),"utf8"));
const rows:Row[]=r.fixtures;
const getScore=(x:Row)=>{
  const a:any=x.actualScore??x.score;
  if(a&&typeof a==="object"&&Number.isFinite(a.home)&&Number.isFinite(a.away)) return {h:+a.home,a:+a.away};
  if(typeof a==="string"){const m=a.match(/(\d+)\D+(\d+)/);if(m)return{h:+m[1],a:+m[2]}}
  return null;
};
const band=(p:number,step=2)=>`${Math.floor(p/step)*step}-${Math.floor(p/step)*step+step-0.1}`;
const lambdaBand=(x:number)=>x<.8?"<0.8":x<1.2?"0.8-1.19":x<1.6?"1.2-1.59":x<2?"1.6-1.99":x<2.5?"2.0-2.49":">=2.5";
function summary(xs:Row[]){
 const wins=xs.filter(x=>x.outcome==="WIN").length;
 return {bets:xs.length,wins,losses:xs.length-wins,hitRate:xs.length?+(100*wins/xs.length).toFixed(1):null};
}
function group(xs:Row[],key:(x:Row)=>string){
 const m=new Map<string,Row[]>();
 for(const x of xs){const k=key(x);if(!m.has(k))m.set(k,[]);m.get(k)!.push(x)}
 return [...m.entries()].map(([key,v])=>({key,...summary(v)})).sort((a,b)=>b.bets-a.bets);
}
const supportMargin=(x:Row)=>x.recommendedBet.support?x.recommendedBet.support.rawProbability-x.recommendedBet.support.minimum:99;

const markets=["1X","Over 1.5"];
const out:any={overall:summary(rows),markets:{}};
for(const pick of markets){
 const xs=rows.filter(x=>x.recommendedBet.pick===pick);
 const losses=xs.filter(x=>x.outcome==="LOSS");
 out.markets[pick]={
  overall:summary(xs),
  lossCount:losses.length,
  byProbabilityBand:group(xs,x=>band(x.recommendedBet.probability)),
  byRawBand:group(xs,x=>band(x.recommendedBet.rawProbability)),
  bySupportMargin:group(xs,x=>{
    const m=supportMargin(x);return m<7?"5-6.9":m<10?"7-9.9":m<15?"10-14.9":">=15";
  }),
  byLambdaHome:group(xs,x=>lambdaBand(x.lambdaHome??0)),
  byLambdaAway:group(xs,x=>lambdaBand(x.lambdaAway??0)),
  byLambdaTotal:group(xs,x=>lambdaBand((x.lambdaHome??0)+(x.lambdaAway??0))),
  byLeague:group(xs,x=>x.leagueId),
  lossScorePatterns:group(losses,x=>{
    const s=getScore(x); if(!s)return "unknown";
    if(pick==="Over 1.5") return `${s.h}-${s.a}`;
    if(s.h<s.a)return "home-lost";
    if(s.h===s.a)return "draw";
    return "home-won";
  }),
  lossesByProbabilityBand:group(losses,x=>band(x.recommendedBet.probability)),
  lossesBySupportMargin:group(losses,x=>{
    const m=supportMargin(x);return m<7?"5-6.9":m<10?"7-9.9":m<15?"10-14.9":">=15";
  }),
  lossesByLeague:group(losses,x=>x.leagueId),
  lossesByLambdaTotal:group(losses,x=>lambdaBand((x.lambdaHome??0)+(x.lambdaAway??0)))
 };
}
console.log(JSON.stringify(out,null,2));