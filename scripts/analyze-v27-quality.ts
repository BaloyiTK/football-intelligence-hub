import fs from "node:fs";
import path from "node:path";

type Bet={
  date:string; leagueId:string; modelLevel?:string; outcome:"WIN"|"LOSS";
  recommendedBet:{
    pick:string; probability:number; selectionProbability?:number; rawProbability:number;
    rating:string; support?:{rawProbability:number;minimum:number};
  };
  competitionType?:string;
};

const r=JSON.parse(fs.readFileSync(path.join(process.cwd(),"data/backtests/2026-04-08_to_2026-10-04.json"),"utf8"));
const bets:Bet[]=r.fixtures;
const trainEnd="2026-08-05",holdStart="2026-08-06";
const train=bets.filter(x=>x.date<=trainEnd),hold=bets.filter(x=>x.date>=holdStart);

function summary(xs:Bet[]){
 const wins=xs.filter(x=>x.outcome==="WIN").length;
 return {bets:xs.length,wins,losses:xs.length-wins,hitRate:xs.length?+(100*wins/xs.length).toFixed(1):null};
}
function group(xs:Bet[],key:(x:Bet)=>string){
 const m=new Map<string,Bet[]>();
 for(const x of xs){const k=key(x);if(!m.has(k))m.set(k,[]);m.get(k)!.push(x)}
 return [...m.entries()].map(([key,rows])=>({key,...summary(rows)})).sort((a,b)=>b.bets-a.bets);
}

const variants:Record<string,(x:Bet)=>boolean>={
 baseline:()=>true,
 noFriendlies:x=>x.competitionType!=="friendly",
 stricterInternational:x=>x.competitionType!=="international" || (x.recommendedBet.selectionProbability??x.recommendedBet.probability)>=80,
 eliteStrongOnly:x=>x.recommendedBet.rating!=="Good",
 x2PlusInternational:x=>{
   const p=x.recommendedBet;
   if(p.pick==="X2" && (p.selectionProbability??p.probability)<76) return false;
   if(x.competitionType==="international" && (p.selectionProbability??p.probability)<80) return false;
   if(x.competitionType==="friendly" && (p.selectionProbability??p.probability)<82) return false;
   return true;
 },
 qualityGate:x=>{
   const p=x.recommendedBet;
   const sp=p.selectionProbability??p.probability;
   if(p.rating==="Good" && sp<74) return false;
   if(p.pick==="X2" && sp<76) return false;
   if(x.competitionType==="international" && sp<80) return false;
   if(x.competitionType==="friendly" && sp<82) return false;
   if(x.modelLevel==="basic" && sp<74) return false;
   return true;
 }
};

const out:any={
 split:{train:{start:"2026-04-08",end:trainEnd},holdout:{start:holdStart,end:"2026-10-04"}},
 diagnostics:{
  train:{overall:summary(train),byPick:group(train,x=>x.recommendedBet.pick),byRating:group(train,x=>x.recommendedBet.rating),byCompetitionType:group(train,x=>x.competitionType??"unknown"),byModelLevel:group(train,x=>x.modelLevel??"unknown")},
  holdout:{overall:summary(hold),byPick:group(hold,x=>x.recommendedBet.pick),byRating:group(hold,x=>x.recommendedBet.rating),byCompetitionType:group(hold,x=>x.competitionType??"unknown"),byModelLevel:group(hold,x=>x.modelLevel??"unknown")}
 },
 variants:{}
};
for(const [name,fn] of Object.entries(variants)){
 const tr=train.filter(fn),ho=hold.filter(fn);
 out.variants[name]={train:summary(tr),holdout:summary(ho),removed:{train:train.length-tr.length,holdout:hold.length-ho.length}};
}
console.log(JSON.stringify(out,null,2));