import fs from "node:fs";
import path from "node:path";

type Bet={
  date:string; leagueId:string; outcome:"WIN"|"LOSS";
  recommendedBet:{pick:string;market:string;probability:number;rawProbability:number;support?:{rawProbability:number;minimum:number};rating:string};
};

const file=path.join(process.cwd(),"data/backtests/2026-04-08_to_2026-10-04.json");
const r=JSON.parse(fs.readFileSync(file,"utf8"));
const bets:Bet[]=r.fixtures;
const trainEnd="2026-08-05", holdStart="2026-08-06";

function summarize(xs:Bet[]){
  const wins=xs.filter(x=>x.outcome==="WIN").length;
  const by=(key:(x:Bet)=>string)=>Object.values(xs.reduce((a:any,x)=>{const k=key(x);a[k]??={key:k,bets:0,wins:0,losses:0};a[k].bets++;a[k][x.outcome==="WIN"?"wins":"losses"]++;return a;},{})).map((x:any)=>({...x,hitRate:+(100*x.wins/x.bets).toFixed(1)})).sort((a:any,b:any)=>b.bets-a.bets);
  return {bets:xs.length,wins,losses:xs.length-wins,hitRate:xs.length?+(100*wins/xs.length).toFixed(1):null,byPick:by(x=>x.recommendedBet.pick),byLeague:by(x=>x.leagueId)};
}

const train=bets.filter(x=>x.date<=trainEnd),hold=bets.filter(x=>x.date>=holdStart);

const weakTrainLeagues=new Set((summarize(train).byLeague as any[]).filter(x=>x.bets>=15&&x.hitRate<72).map(x=>x.key));

function v25Keep(x:Bet){
  const b=x.recommendedBet;
  if(b.pick==="X2"){
    if(b.rawProbability<76) return false;
    if((b.support?.rawProbability??0)<66) return false;
    if(b.probability<72) return false;
  }
  if(weakTrainLeagues.has(x.leagueId)){
    if(b.probability<78) return false;
    if(b.pick==="X2") return false;
  }
  return true;
}

const train25=train.filter(v25Keep),hold25=hold.filter(v25Keep);
console.log(JSON.stringify({
  split:{train:{start:"2026-04-08",end:trainEnd},holdout:{start:holdStart,end:"2026-10-04"}},
  weakTrainLeagues:[...weakTrainLeagues],
  v24:{train:summarize(train),holdout:summarize(hold)},
  v25Candidate:{train:summarize(train25),holdout:summarize(hold25)},
  removed:{train:train.length-train25.length,holdout:hold.length-hold25.length}
},null,2));
