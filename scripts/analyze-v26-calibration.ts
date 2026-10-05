import fs from "node:fs";
import path from "node:path";

type Bet={
  date:string;
  outcome:"WIN"|"LOSS";
  recommendedBet:{pick:string;probability:number;rating:string};
};

const file=path.join(process.cwd(),"data/backtests/2026-04-08_to_2026-10-04.json");
const r=JSON.parse(fs.readFileSync(file,"utf8"));
const bets:Bet[]=r.fixtures;
const trainEnd="2026-08-05", holdStart="2026-08-06";
const train=bets.filter(x=>x.date<=trainEnd);
const hold=bets.filter(x=>x.date>=holdStart);
const picks=["1X","X2","Over 1.5"];

const clamp=(x:number,lo=0.001,hi=0.999)=>Math.max(lo,Math.min(hi,x));
const logit=(p:number)=>Math.log(clamp(p)/(1-clamp(p)));
const sigmoid=(z:number)=>1/(1+Math.exp(-z));
const calibrate=(pct:number,t:number)=>100*sigmoid(logit(pct/100)/t);
const y=(b:Bet)=>b.outcome==="WIN"?1:0;
const brier=(xs:Bet[],temps:Record<string,number>|null)=>{
  if(!xs.length)return null;
  return xs.reduce((s,b)=>{
    const p=(temps?calibrate(b.recommendedBet.probability,temps[b.recommendedBet.pick]??1):b.recommendedBet.probability)/100;
    return s+(p-y(b))**2;
  },0)/xs.length;
};
const hit=(xs:Bet[])=>xs.length?xs.filter(x=>x.outcome==="WIN").length/xs.length:null;
const mae=(xs:Bet[],temps:Record<string,number>|null)=>{
  if(!xs.length)return null;
  return xs.reduce((s,b)=>{
    const p=(temps?calibrate(b.recommendedBet.probability,temps[b.recommendedBet.pick]??1):b.recommendedBet.probability)/100;
    return s+Math.abs(p-y(b));
  },0)/xs.length;
};

const temps:Record<string,number>={};
const perPick:any={};
for(const pick of picks){
  const tr=train.filter(x=>x.recommendedBet.pick===pick);
  let bestT=1,best=Infinity;
  for(let t=0.5;t<=3.0001;t+=0.025){
    const ts={[pick]:+t.toFixed(3)};
    const score=brier(tr,ts)!;
    if(score<best){best=score;bestT=+t.toFixed(3);}
  }
  temps[pick]=bestT;
  const ho=hold.filter(x=>x.recommendedBet.pick===pick);
  perPick[pick]={
    temperature:bestT,
    training:{bets:tr.length,hitRate:hit(tr),baselineBrier:brier(tr,null),calibratedBrier:brier(tr,{[pick]:bestT})},
    holdout:{bets:ho.length,hitRate:hit(ho),baselineBrier:brier(ho,null),calibratedBrier:brier(ho,{[pick]:bestT}),baselineMae:mae(ho,null),calibratedMae:mae(ho,{[pick]:bestT})}
  };
}

function ratingSummary(xs:Bet[], calibrated:boolean){
  const buckets={Elite:{bets:0,wins:0},Strong:{bets:0,wins:0},Good:{bets:0,wins:0}} as Record<string,{bets:number;wins:number}>;
  for(const b of xs){
    const p=calibrated?calibrate(b.recommendedBet.probability,temps[b.recommendedBet.pick]??1):b.recommendedBet.probability;
    const rating=p>=85?"Elite":p>=78?"Strong":"Good";
    buckets[rating].bets++;
    if(b.outcome==="WIN") buckets[rating].wins++;
  }
  return Object.fromEntries(Object.entries(buckets).map(([k,v])=>[k,{...v,hitRate:v.bets?+(100*v.wins/v.bets).toFixed(1):null}]));
}

const result={
  split:{train:{start:"2026-04-08",end:trainEnd},holdout:{start:holdStart,end:"2026-10-04"}},
  temperatures:temps,
  overall:{
    training:{bets:train.length,baselineBrier:brier(train,null),calibratedBrier:brier(train,temps)},
    holdout:{bets:hold.length,baselineBrier:brier(hold,null),calibratedBrier:brier(hold,temps),baselineMae:mae(hold,null),calibratedMae:mae(hold,temps)}
  },
  perPick,
  ratings:{baseline:ratingSummary(hold,false),calibrated:ratingSummary(hold,true)}
};
console.log(JSON.stringify(result,null,2));
