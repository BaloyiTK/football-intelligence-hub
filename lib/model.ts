export type ModelInput={
  homeAttack:number; awayAttack:number; homeDefence:number; awayDefence:number;
  leagueHomeGoals:number; leagueAwayGoals:number;
  recentHomeAttack?:number; recentAwayAttack?:number;
  recentHomeDefence?:number; recentAwayDefence?:number;
  homeAdvantage?:number; rho?:number;
};
export type BetRecommendation={market:string;pick:string;probability:number;rating:"Elite"|"Strong"|"Good";};
const fact=(n:number):number=>n<2?1:n*fact(n-1);
const pois=(k:number,l:number):number=>Math.exp(-l)*Math.pow(l,k)/fact(k);
const clamp=(v:number,lo=.2,hi=4)=>Math.min(hi,Math.max(lo,v));
const blend=(base:number,recent?:number)=>recent==null?base:0.65*base+0.35*recent;
const dcTau=(x:number,y:number,lh:number,la:number,rho:number)=>{
 if(x===0&&y===0)return 1-lh*la*rho;if(x===0&&y===1)return 1+lh*rho;
 if(x===1&&y===0)return 1+la*rho;if(x===1&&y===1)return 1-rho;return 1;
};
const rating=(p:number):BetRecommendation["rating"]=>p>=85?"Elite":p>=75?"Strong":"Good";
const recommend=(m:{home:number;draw:number;away:number;dc:{homeOrDraw:number;awayOrDraw:number;homeOrAway:number};btts:number;o15:number;o25:number;o35:number;lh:number;la:number}):BetRecommendation|null=>{
 const candidates=[
  {market:"Double Chance",pick:"1X",probability:m.dc.homeOrDraw,min:72},
  {market:"Double Chance",pick:"X2",probability:m.dc.awayOrDraw,min:72},
  {market:"Double Chance",pick:"12",probability:m.dc.homeOrAway,min:75},
  {market:"Total Goals",pick:"Over 1.5",probability:m.o15,min:72},
  {market:"Total Goals",pick:"Over 2.5",probability:m.o25,min:68},
  {market:"Total Goals",pick:"Under 3.5",probability:100-m.o35,min:72},
  {market:"BTTS",pick:"Yes",probability:m.btts,min:68},
  {market:"BTTS",pick:"No",probability:100-m.btts,min:68},
  {market:"Team Goals",pick:"Home 1+",probability:100-Math.exp(-m.lh),min:72},
  {market:"Team Goals",pick:"Away 1+",probability:100-Math.exp(-m.la),min:72},
  {market:"1X2",pick:"Home",probability:m.home,min:62},
  {market:"1X2",pick:"Away",probability:m.away,min:62}
 ].filter(x=>x.probability>=x.min).sort((a,b)=>b.probability-a.probability);
 const x=candidates[0];return x?{market:x.market,pick:x.pick,probability:+x.probability.toFixed(1),rating:rating(x.probability)}:null;
};
export function calculate(i:ModelInput){
 const hAtt=blend(i.homeAttack,i.recentHomeAttack),aAtt=blend(i.awayAttack,i.recentAwayAttack);
 const hDef=blend(i.homeDefence,i.recentHomeDefence),aDef=blend(i.awayDefence,i.recentAwayDefence);
 const lh=clamp(i.leagueHomeGoals*hAtt*aDef*(i.homeAdvantage??1)),la=clamp(i.leagueAwayGoals*aAtt*hDef);
 const rho=Math.max(-.2,Math.min(.2,i.rho??-.08));let h=0,d=0,a=0,btts=0,o15=0,o25=0,o35=0,total=0;
 const scores:Array<{s:string;p:number}>=[];for(let x=0;x<=8;x++)for(let y=0;y<=8;y++){const p=Math.max(0,dcTau(x,y,lh,la,rho)*pois(x,lh)*pois(y,la));scores.push({s:`${x}-${y}`,p});total+=p;}
 for(const row of scores){row.p/=total;const[x,y]=row.s.split("-").map(Number);if(x>y)h+=row.p;else if(x===y)d+=row.p;else a+=row.p;if(x>0&&y>0)btts+=row.p;if(x+y>1)o15+=row.p;if(x+y>2)o25+=row.p;if(x+y>3)o35+=row.p;}
 scores.sort((x,y)=>y.p-x.p);const pct=(v:number)=>Math.round(v*1000)/10;
 const dc={homeOrDraw:pct(h+d),awayOrDraw:pct(a+d),homeOrAway:pct(h+a)};
 const markets={home:pct(h),draw:pct(d),away:pct(a),dc,btts:pct(btts),o15:pct(o15),o25:pct(o25),o35:pct(o35),lh,la};
 return {modelVersion:"v2.1-dixon-coles-market-selector",lambdaHome:+lh.toFixed(2),lambdaAway:+la.toFixed(2),
  home:markets.home,draw:markets.draw,away:markets.away,doubleChance:dc,btts:markets.btts,over15:markets.o15,over25:markets.o25,over35:markets.o35,
  home2Plus:pct(1-pois(0,lh)-pois(1,lh)),away2Plus:pct(1-pois(0,la)-pois(1,la)),
  likelyScores:scores.slice(0,4).map(x=>({score:x.s,probability:pct(x.p)})),recommendedBet:recommend(markets)};
}