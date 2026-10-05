export type ModelInput={
  homeAttack:number; awayAttack:number; homeDefence:number; awayDefence:number;
  leagueHomeGoals:number; leagueAwayGoals:number;
  recentHomeAttack?:number; recentAwayAttack?:number;
  recentHomeDefence?:number; recentAwayDefence?:number;
  homeAdvantage?:number; rho?:number;
  sampleSize?:number; modelLevel?:"full"|"standard"|"basic";
};
export type BetRecommendation={market:"1X2";pick:"Home"|"Draw"|"Away";probability:number;rawProbability:number;reliability:number;rating:"Elite"|"Strong"|"Good";};
const fact=(n:number):number=>n<2?1:n*fact(n-1);
const pois=(k:number,l:number):number=>Math.exp(-l)*Math.pow(l,k)/fact(k);
const clamp=(v:number,lo=.2,hi=4)=>Math.min(hi,Math.max(lo,v));
const blend=(base:number,recent?:number)=>recent==null?base:0.65*base+0.35*recent;
const dcTau=(x:number,y:number,lh:number,la:number,rho:number)=>{if(x===0&&y===0)return 1-lh*la*rho;if(x===0&&y===1)return 1+lh*rho;if(x===1&&y===0)return 1+la*rho;if(x===1&&y===1)return 1-rho;return 1;};
const evidenceFactor=(i:ModelInput)=>{const level=i.modelLevel==="full"?1:i.modelLevel==="standard"?.96:.90;const n=i.sampleSize??5;const sample=n>=8?1:n>=5?.97:n>=3?.92:.84;return level*sample;};
const rating=(p:number):BetRecommendation["rating"]=>p>=85?"Elite":p>=75?"Strong":"Good";
const recommend=(m:{home:number;draw:number;away:number},i:ModelInput):BetRecommendation|null=>{
 const ef=evidenceFactor(i);
 const rows=[
  ["Home",m.home,62,.92],
  ["Draw",m.draw,62,.88],
  ["Away",m.away,62,.90]
 ] as Array<["Home"|"Draw"|"Away",number,number,number]>;
 const candidates=rows.map(([pick,raw,min,mr])=>({pick,raw,min,reliability:ef*mr,adjusted:raw*ef*mr}))
  .filter(x=>x.raw>=x.min&&x.adjusted>=68).sort((a,b)=>b.adjusted-a.adjusted);
 const x=candidates[0];
 return x?{market:"1X2",pick:x.pick,probability:+x.adjusted.toFixed(1),rawProbability:+x.raw.toFixed(1),reliability:+x.reliability.toFixed(3),rating:rating(x.adjusted)}:null;
};
export function calculate(i:ModelInput){
 const hAtt=blend(i.homeAttack,i.recentHomeAttack),aAtt=blend(i.awayAttack,i.recentAwayAttack),hDef=blend(i.homeDefence,i.recentHomeDefence),aDef=blend(i.awayDefence,i.recentAwayDefence);
 const ef=evidenceFactor(i);const rawH=i.leagueHomeGoals*hAtt*aDef*(i.homeAdvantage??1),rawA=i.leagueAwayGoals*aAtt*hDef;
 const lh=clamp(i.leagueHomeGoals+(rawH-i.leagueHomeGoals)*ef),la=clamp(i.leagueAwayGoals+(rawA-i.leagueAwayGoals)*ef);
 const rho=Math.max(-.2,Math.min(.2,i.rho??-.08));let h=0,d=0,a=0,total=0;
 const cells:Array<{x:number;y:number;p:number}>=[];
 for(let x=0;x<=8;x++)for(let y=0;y<=8;y++){const p=Math.max(0,dcTau(x,y,lh,la,rho)*pois(x,lh)*pois(y,la));cells.push({x,y,p});total+=p;}
 for(const row of cells){const p=row.p/total;if(row.x>row.y)h+=p;else if(row.x===row.y)d+=p;else a+=p;}
 const pct=(v:number)=>Math.round(v*1000)/10;
 const markets={home:pct(h),draw:pct(d),away:pct(a)};
 return {modelVersion:"v2.3-backtest-calibrated-selector",lambdaHome:+lh.toFixed(2),lambdaAway:+la.toFixed(2),home:markets.home,draw:markets.draw,away:markets.away,recommendedBet:recommend(markets,i)};
}
