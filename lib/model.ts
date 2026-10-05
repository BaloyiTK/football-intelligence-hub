export type ModelInput={
  homeAttack:number; awayAttack:number; homeDefence:number; awayDefence:number;
  leagueHomeGoals:number; leagueAwayGoals:number;
  recentHomeAttack?:number; recentAwayAttack?:number;
  recentHomeDefence?:number; recentAwayDefence?:number;
  homeAdvantage?:number; rho?:number;
  sampleSize?:number; modelLevel?:"full"|"standard"|"basic";
  homeScoringRate?:number; awayScoringRate?:number;
  recentOver35Rate?:number;
};
export type BetRecommendation={market:string;pick:string;probability:number;rawProbability:number;reliability:number;rating:"Elite"|"Strong"|"Good";};
const fact=(n:number):number=>n<2?1:n*fact(n-1);
const pois=(k:number,l:number):number=>Math.exp(-l)*Math.pow(l,k)/fact(k);
const clamp=(v:number,lo=.2,hi=4)=>Math.min(hi,Math.max(lo,v));
const blend=(base:number,recent?:number)=>recent==null?base:0.65*base+0.35*recent;
const dcTau=(x:number,y:number,lh:number,la:number,rho:number)=>{if(x===0&&y===0)return 1-lh*la*rho;if(x===0&&y===1)return 1+lh*rho;if(x===1&&y===0)return 1+la*rho;if(x===1&&y===1)return 1-rho;return 1;};
const evidenceFactor=(i:ModelInput)=>{const level=i.modelLevel==="full"?1:i.modelLevel==="standard"?.96:.90;const n=i.sampleSize??5;const sample=n>=8?1:n>=5?.97:n>=3?.92:.84;return level*sample;};
// Missing volatility is uncertainty, not evidence of a quiet game. Basic/Standard Under 3.5 selections
// therefore receive a conservative reliability haircut unless recent O3.5 history is actually supplied.
const under35Reliability=(i:ModelInput,ef:number)=>{const known=i.recentOver35Rate!=null;const over35=known?Math.max(0,Math.min(1,i.recentOver35Rate!)):null;const volatility=over35==null?.90:Math.max(.72,.98-over35*.22);return ef*volatility;};
const rating=(p:number):BetRecommendation["rating"]=>p>=85?"Elite":p>=75?"Strong":"Good";
const recommend=(m:{home:number;draw:number;away:number;dc:{homeOrDraw:number;awayOrDraw:number;homeOrAway:number};btts:number;o15:number;o25:number;o35:number;lh:number;la:number},i:ModelInput):BetRecommendation|null=>{
 const ef=evidenceFactor(i);
 const rows=[
  ["Double Chance","1X",m.dc.homeOrDraw,72,1],["Double Chance","X2",m.dc.awayOrDraw,72,1],
  ["Total Goals","Over 1.5",m.o15,72,.98],["Total Goals","Over 2.5",m.o25,68,.94],
  ["Total Goals","Under 3.5",100-m.o35,72,under35Reliability(i,1)],
  ["BTTS","Yes",m.btts,68,.93],["BTTS","No",100-m.btts,68,.93],
  ["Team Goals","Home 1+",100-Math.exp(-m.lh),74,(i.homeScoringRate??.75)>=.6?.94:.82],
  ["Team Goals","Away 1+",100-Math.exp(-m.la),78,(i.awayScoringRate??.70)>=.65?.88:.76],
  ["1X2","Home",m.home,62,.92],["1X2","Away",m.away,62,.90]
 ] as Array<[string,string,number,number,number]>;
 const candidates=rows.map(([market,pick,raw,min,mr])=>({market,pick,raw,min,reliability:ef*mr,adjusted:raw*ef*mr}))
  .filter(x=>x.raw>=x.min&&x.adjusted>=68).sort((a,b)=>b.adjusted-a.adjusted);
 const x=candidates[0];return x?{market:x.market,pick:x.pick,probability:+x.adjusted.toFixed(1),rawProbability:+x.raw.toFixed(1),reliability:+x.reliability.toFixed(3),rating:rating(x.adjusted)}:null;
};
export function calculate(i:ModelInput){
 const hAtt=blend(i.homeAttack,i.recentHomeAttack),aAtt=blend(i.awayAttack,i.recentAwayAttack),hDef=blend(i.homeDefence,i.recentHomeDefence),aDef=blend(i.awayDefence,i.recentAwayDefence);
 const ef=evidenceFactor(i);const rawH=i.leagueHomeGoals*hAtt*aDef*(i.homeAdvantage??1),rawA=i.leagueAwayGoals*aAtt*hDef;
 const lh=clamp(i.leagueHomeGoals+(rawH-i.leagueHomeGoals)*ef),la=clamp(i.leagueAwayGoals+(rawA-i.leagueAwayGoals)*ef);
 const rho=Math.max(-.2,Math.min(.2,i.rho??-.08));let h=0,d=0,a=0,btts=0,o15=0,o25=0,o35=0,total=0;const scores:Array<{s:string;p:number}>=[];
 for(let x=0;x<=8;x++)for(let y=0;y<=8;y++){const p=Math.max(0,dcTau(x,y,lh,la,rho)*pois(x,lh)*pois(y,la));scores.push({s:`${x}-${y}`,p});total+=p;}
 for(const row of scores){row.p/=total;const[x,y]=row.s.split("-").map(Number);if(x>y)h+=row.p;else if(x===y)d+=row.p;else a+=row.p;if(x>0&&y>0)btts+=row.p;if(x+y>1)o15+=row.p;if(x+y>2)o25+=row.p;if(x+y>3)o35+=row.p;}
 scores.sort((x,y)=>y.p-x.p);const pct=(v:number)=>Math.round(v*1000)/10;const dc={homeOrDraw:pct(h+d),awayOrDraw:pct(a+d),homeOrAway:pct(h+a)};
 const markets={home:pct(h),draw:pct(d),away:pct(a),dc,btts:pct(btts),o15:pct(o15),o25:pct(o25),o35:pct(o35),lh,la};
 return {modelVersion:"v2.3-backtest-calibrated-selector",lambdaHome:+lh.toFixed(2),lambdaAway:+la.toFixed(2),home:markets.home,draw:markets.draw,away:markets.away,doubleChance:{homeOrDraw:dc.homeOrDraw,awayOrDraw:dc.awayOrDraw},btts:markets.btts,bttsNo:pct(1-btts),over15:markets.o15,under15:pct(1-o15),over25:markets.o25,under25:pct(1-o25),over35:markets.o35,under35:pct(1-o35),home1Plus:pct(1-pois(0,lh)),away1Plus:pct(1-pois(0,la)),home2Plus:pct(1-pois(0,lh)-pois(1,lh)),away2Plus:pct(1-pois(0,la)-pois(1,la)),likelyScores:scores.slice(0,4).map(x=>({score:x.s,probability:pct(x.p)})),recommendedBet:recommend(markets,i)};
}