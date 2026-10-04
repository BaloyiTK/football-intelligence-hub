export type ModelInput={
  homeAttack:number; awayAttack:number; homeDefence:number; awayDefence:number;
  leagueHomeGoals:number; leagueAwayGoals:number;
  recentHomeAttack?:number; recentAwayAttack?:number;
  recentHomeDefence?:number; recentAwayDefence?:number;
  homeAdvantage?:number; rho?:number;
};
const fact=(n:number):number=>n<2?1:n*fact(n-1);
const pois=(k:number,l:number):number=>Math.exp(-l)*Math.pow(l,k)/fact(k);
const clamp=(v:number,lo=.2,hi=4)=>Math.min(hi,Math.max(lo,v));
const blend=(base:number,recent?:number)=>recent==null?base:0.65*base+0.35*recent;
const dcTau=(x:number,y:number,lh:number,la:number,rho:number)=>{
  if(x===0&&y===0)return 1-lh*la*rho;
  if(x===0&&y===1)return 1+lh*rho;
  if(x===1&&y===0)return 1+la*rho;
  if(x===1&&y===1)return 1-rho;
  return 1;
};
export function calculate(i:ModelInput){
  const hAtt=blend(i.homeAttack,i.recentHomeAttack), aAtt=blend(i.awayAttack,i.recentAwayAttack);
  const hDef=blend(i.homeDefence,i.recentHomeDefence), aDef=blend(i.awayDefence,i.recentAwayDefence);
  const homeAdv=i.homeAdvantage??1;
  const lh=clamp(i.leagueHomeGoals*hAtt*aDef*homeAdv), la=clamp(i.leagueAwayGoals*aAtt*hDef);
  const rho=Math.max(-.2,Math.min(.2,i.rho??-.08));
  let h=0,d=0,a=0,btts=0,o15=0,o25=0,o35=0,total=0;
  const scores:Array<{s:string;p:number}>=[];
  for(let x=0;x<=8;x++)for(let y=0;y<=8;y++){
    const p=Math.max(0,dcTau(x,y,lh,la,rho)*pois(x,lh)*pois(y,la));
    scores.push({s:`${x}-${y}`,p}); total+=p;
  }
  for(const row of scores){
    row.p/=total; const [x,y]=row.s.split("-").map(Number);
    if(x>y)h+=row.p;else if(x===y)d+=row.p;else a+=row.p;
    if(x>0&&y>0)btts+=row.p;if(x+y>1)o15+=row.p;if(x+y>2)o25+=row.p;if(x+y>3)o35+=row.p;
  }
  scores.sort((x,y)=>y.p-x.p); const pct=(v:number)=>Math.round(v*1000)/10;
  return {modelVersion:"v2-dixon-coles",lambdaHome:+lh.toFixed(2),lambdaAway:+la.toFixed(2),
    home:pct(h),draw:pct(d),away:pct(a),doubleChance:{homeOrDraw:pct(h+d),awayOrDraw:pct(a+d),homeOrAway:pct(h+a)},
    btts:pct(btts),over15:pct(o15),over25:pct(o25),over35:pct(o35),
    home2Plus:pct(1-pois(0,lh)-pois(1,lh)),away2Plus:pct(1-pois(0,la)-pois(1,la)),
    likelyScores:scores.slice(0,4).map(x=>({score:x.s,probability:pct(x.p)}))};
}