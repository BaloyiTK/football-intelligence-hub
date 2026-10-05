import fs from "node:fs";
import path from "node:path";

type Bet={
  date:string; leagueId:string; outcome:"WIN"|"LOSS";
  lambdaHome?:number; lambdaAway?:number;
  recommendedBet:{
    pick:string; probability:number; selectionProbability?:number; rawProbability:number;
    support?:{rawProbability:number;minimum:number}; rating:string;
  };
};

const r=JSON.parse(fs.readFileSync(path.join(process.cwd(),"data/backtests/2026-04-08_to_2026-10-04.json"),"utf8"));
const bets:Bet[]=r.fixtures;
const trainEnd="2026-08-05",holdStart="2026-08-06";
const train=bets.filter(x=>x.date<=trainEnd),hold=bets.filter(x=>x.date>=holdStart);

const weakTrainLeagues=new Set<string>();
{
  const m=new Map<string,Bet[]>();
  for(const x of train){if(!m.has(x.leagueId))m.set(x.leagueId,[]);m.get(x.leagueId)!.push(x)}
  for(const [league,rows] of m){
    const wins=rows.filter(x=>x.outcome==="WIN").length;
    const hr=rows.length?wins/rows.length:0;
    if(rows.length>=20 && hr<0.73) weakTrainLeagues.add(league);
  }
}

function summary(xs:Bet[]){
  const wins=xs.filter(x=>x.outcome==="WIN").length;
  return {bets:xs.length,wins,losses:xs.length-wins,hitRate:xs.length?+(100*wins/xs.length).toFixed(1):null};
}
const supportMargin=(x:Bet)=>{
  const s=x.recommendedBet.support;
  return s?s.rawProbability-s.minimum:99;
};
const anomalousExtreme=(x:Bet)=>{
  const p=x.recommendedBet.probability;
  const raw=x.recommendedBet.rawProbability;
  return p>=86 && p<88 && raw>=90 && raw<92;
};

const variants:Record<string,(x:Bet)=>boolean>={
 baseline:()=>true,
 support2:x=>supportMargin(x)>=2,
 support5:x=>supportMargin(x)>=5,
 removeAnomaly:x=>!anomalousExtreme(x),
 weakLeagueP82:x=>!weakTrainLeagues.has(x.leagueId)||x.recommendedBet.probability>=82,
 weakLeagueP84:x=>!weakTrainLeagues.has(x.leagueId)||x.recommendedBet.probability>=84,
 candidateA:x=>supportMargin(x)>=2 && !anomalousExtreme(x),
 candidateB:x=>supportMargin(x)>=2 && !anomalousExtreme(x) && (!weakTrainLeagues.has(x.leagueId)||x.recommendedBet.probability>=82),
 candidateC:x=>supportMargin(x)>=5 && !anomalousExtreme(x) && (!weakTrainLeagues.has(x.leagueId)||x.recommendedBet.probability>=82)
};

const out:any={
 split:{train:{start:"2026-04-08",end:trainEnd},holdout:{start:holdStart,end:"2026-10-04"}},
 weakTrainLeagues:[...weakTrainLeagues],
 variants:{}
};
for(const [name,fn] of Object.entries(variants)){
  const tr=train.filter(fn),ho=hold.filter(fn);
  out.variants[name]={train:summary(tr),holdout:summary(ho),removed:{train:train.length-tr.length,holdout:hold.length-ho.length}};
}
console.log(JSON.stringify(out,null,2));