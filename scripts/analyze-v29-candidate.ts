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

const supportMargin=(x:Bet)=>x.recommendedBet.support?x.recommendedBet.support.rawProbability-x.recommendedBet.support.minimum:99;
function summary(xs:Bet[]){
  const wins=xs.filter(x=>x.outcome==="WIN").length;
  return {bets:xs.length,wins,losses:xs.length-wins,hitRate:xs.length?+(100*wins/xs.length).toFixed(1):null};
}
const p=(x:Bet)=>x.recommendedBet.probability;
const raw=(x:Bet)=>x.recommendedBet.rawProbability;
const lh=(x:Bet)=>x.lambdaHome??0;

const rules={
 baseline:(x:Bet)=>true,

 oneX82:(x:Bet)=>x.recommendedBet.pick!=="1X"||p(x)>=82,
 oneXRawAnomaly:(x:Bet)=>x.recommendedBet.pick!=="1X"||!(raw(x)>=90&&raw(x)<92),
 oneXLambdaSupport:(x:Bet)=>{
   if(x.recommendedBet.pick!=="1X") return true;
   if(lh(x)>=2.0&&lh(x)<2.5) return supportMargin(x)>=10;
   return true;
 },
 oneXCombined:(x:Bet)=>{
   if(x.recommendedBet.pick!=="1X") return true;
   if(p(x)<82) return false;
   if(raw(x)>=90&&raw(x)<92) return false;
   if(lh(x)>=2.0&&lh(x)<2.5&&supportMargin(x)<10) return false;
   return true;
 },

 over15Support7:(x:Bet)=>x.recommendedBet.pick!=="Over 1.5"||supportMargin(x)>=7,
 over15Lambda:(x:Bet)=>x.recommendedBet.pick!=="Over 1.5"||!(lh(x)>=1.6&&lh(x)<2.0),
 over15Combined:(x:Bet)=>{
   if(x.recommendedBet.pick!=="Over 1.5") return true;
   if(supportMargin(x)<7) return false;
   if(lh(x)>=1.6&&lh(x)<2.0) return false;
   return true;
 },
 conservativeCandidate:(x:Bet)=>{
   if(x.recommendedBet.pick==="1X"&&p(x)<82) return false;
   if(x.recommendedBet.pick==="Over 1.5"&&supportMargin(x)<7) return false;
   return true;
 },
 oneX82PlusLambdaSupport:(x:Bet)=>{
   if(x.recommendedBet.pick!=="1X") return true;
   if(p(x)<82) return false;
   if(lh(x)>=2.0&&lh(x)<2.5&&supportMargin(x)<10) return false;
   return true;
 },

 marketCombined:(x:Bet)=>{
   if(x.recommendedBet.pick==="1X"){
     if(p(x)<82) return false;
     if(raw(x)>=90&&raw(x)<92) return false;
     if(lh(x)>=2.0&&lh(x)<2.5&&supportMargin(x)<10) return false;
   }
   if(x.recommendedBet.pick==="Over 1.5"){
     if(supportMargin(x)<7) return false;
     if(lh(x)>=1.6&&lh(x)<2.0) return false;
   }
   return true;
 },

 nations1XReview:(x:Bet)=>!(x.leagueId==="uefa-nations-league"&&x.recommendedBet.pick==="1X"),
 chinaO15Review:(x:Bet)=>!(x.leagueId==="chn-super-league"&&x.recommendedBet.pick==="Over 1.5"),
 leagueRiskCombined:(x:Bet)=>!(
   (x.leagueId==="uefa-nations-league"&&x.recommendedBet.pick==="1X")||
   (x.leagueId==="chn-super-league"&&x.recommendedBet.pick==="Over 1.5")
 ),
 fullCandidate:(x:Bet)=>{
   if(!rules.marketCombined(x)) return false;
   return rules.leagueRiskCombined(x);
 }
};

const out:any={
 split:{train:{start:"2026-04-08",end:trainEnd},holdout:{start:holdStart,end:"2026-10-04"}},
 variants:{}
};
for(const [name,fn] of Object.entries(rules)){
  const tr=train.filter(fn),ho=hold.filter(fn);
  out.variants[name]={train:summary(tr),holdout:summary(ho),removed:{train:train.length-tr.length,holdout:hold.length-ho.length}};
}
console.log(JSON.stringify(out,null,2));