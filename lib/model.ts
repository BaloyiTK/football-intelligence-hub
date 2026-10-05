export type ModelInput={
  homeAttack:number; awayAttack:number; homeDefence:number; awayDefence:number;
  leagueHomeGoals:number; leagueAwayGoals:number;
  recentHomeAttack?:number; recentAwayAttack?:number;
  recentHomeDefence?:number; recentAwayDefence?:number;
  homeAdvantage?:number; rho?:number;
  sampleSize?:number; modelLevel?:"full"|"standard"|"basic";
  confidence?:"high"|"medium"|"low";
  competitionType?:"club"|"international"|"friendly";
  dataQuality?:"good"|"usable"|"poor";
  marketProbabilityByPick?:Record<string,number>;
};
export type SupportSignal={market:"1X2"|"Total Goals";pick:"Home"|"Away"|"Over 2.5";rawProbability:number;minimum:number;};
export type SelectionStatus="PUBLISH"|"WATCH"|"REVIEW"|"NO_BET";
export type BetRecommendation={
  market:"1X2"|"Total Goals"|"Double Chance";
  pick:"Home"|"Draw"|"Away"|"Over 1.5"|"1X"|"X2";
  probability:number;selectionProbability:number;rawProbability:number;reliability:number;rating:"Elite"|"Strong"|"Good";
  selectionStatus:SelectionStatus; publishable:boolean;
  marketProbability?:number; marketDivergence?:number;
  riskFlags:string[];
  support?:SupportSignal;
};

export const MODEL_VERSION="v2.6-market-calibrated-selector";
export const V24=Object.freeze({
  marketDivergenceWatch:20,
  marketDivergenceReview:30,
  lambdaHigh:3.00,
  lambdaLow:0.25,
  lambdaTotalHigh:4.80,
  confidenceShrink:{high:1.00,medium:.95,low:.90},
  competitionShrink:{club:1.00,international:.96,friendly:.92},
  divergenceShrink:{watch:.90,review:.80}
});
export const V25=Object.freeze({
  ...V24,
  x2RawMin:76,
  x2AwaySupportMin:66,
  x2CalibratedMin:72
});
export const V26=Object.freeze({
  ...V25,
  marketTemperature:{
    "1X":1.025,
    "X2":1.55,
    "Over 1.5":1.025
  }
});

const fact=(n:number):number=>n<2?1:n*fact(n-1);
const pois=(k:number,l:number):number=>Math.exp(-l)*Math.pow(l,k)/fact(k);
const clamp=(v:number,lo=.2,hi=4)=>Math.min(hi,Math.max(lo,v));
const blend=(base:number,recent?:number)=>recent==null?base:0.65*base+0.35*recent;
const dcTau=(x:number,y:number,lh:number,la:number,rho:number)=>{if(x===0&&y===0)return 1-lh*la*rho;if(x===0&&y===1)return 1+lh*rho;if(x===1&&y===0)return 1+la*rho;if(x===1&&y===1)return 1-rho;return 1;};
const evidenceFactor=(i:ModelInput)=>{const level=i.modelLevel==="full"?1:i.modelLevel==="standard"?.96:.90;const n=i.sampleSize??5;const sample=n>=8?1:n>=5?.97:n>=3?.92:.84;return level*sample;};
const rating=(p:number):BetRecommendation["rating"]=>p>=88?"Elite":p>=78?"Strong":"Good";
const shrink=(p:number,f:number)=>50+(p-50)*f;
const keyFor=(market:string,pick:string)=>market+"|"+pick;
const temperatureCalibrate=(pct:number,t:number)=>{
  const p=Math.max(.001,Math.min(.999,pct/100));
  const z=Math.log(p/(1-p));
  return 100/(1+Math.exp(-z/t));
};

function calibrate(raw:number,reliability:number,i:ModelInput,market:string,pick:string,lh:number,la:number){
  const confidence=i.confidence??(i.modelLevel==="full"?"high":i.modelLevel==="standard"?"medium":"low");
  const competition=i.competitionType??"club";
  const conf=(V24.confidenceShrink as Record<string,number>)[confidence]??.95;
  const comp=(V24.competitionShrink as Record<string,number>)[competition]??1;
  const mpRaw=i.marketProbabilityByPick?.[keyFor(market,pick)];
  const marketProbability=Number.isFinite(mpRaw)?Number(mpRaw):undefined;
  const marketDivergence=marketProbability===undefined?undefined:Math.abs(raw-marketProbability);
  const flags:string[]=[];
  let status:SelectionStatus="PUBLISH";
  let divergenceFactor=1;

  if(lh>=V24.lambdaHigh||la>=V24.lambdaHigh) flags.push("high-lambda");
  if(lh<=V24.lambdaLow||la<=V24.lambdaLow) flags.push("low-lambda");
  if(lh+la>=V24.lambdaTotalHigh) flags.push("high-total-lambda");
  if(flags.length) status="REVIEW";

  if(i.dataQuality==="poor"){
    flags.push("poor-data-quality");
    status="NO_BET";
  }

  if(marketDivergence!==undefined&&marketDivergence>=V24.marketDivergenceReview){
    flags.push("extreme-market-divergence");
    divergenceFactor=V24.divergenceShrink.review;
    if(status!=="NO_BET") status="REVIEW";
  }else if(marketDivergence!==undefined&&marketDivergence>=V24.marketDivergenceWatch){
    flags.push("market-divergence");
    divergenceFactor=V24.divergenceShrink.watch;
    if(status==="PUBLISH") status="WATCH";
  }

  let probability=shrink(raw,reliability);
  probability=shrink(probability,conf);
  probability=shrink(probability,comp);
  probability=shrink(probability,divergenceFactor);
  probability=Math.max(1,Math.min(99,probability));

  return {probability,selectionStatus:status,publishable:status==="PUBLISH"||status==="WATCH",marketProbability,marketDivergence,riskFlags:flags};
}

const recommend=(m:{home:number;draw:number;away:number;homeOrDraw:number;awayOrDraw:number;o15:number;o25:number},i:ModelInput,lh:number,la:number)=>{
 const ef=evidenceFactor(i);
 const rows:Array<{market:BetRecommendation["market"];pick:BetRecommendation["pick"];raw:number;min:number;mr:number;support?:SupportSignal}>=[
  {market:"1X2",pick:"Home",raw:m.home,min:62,mr:.92},
  {market:"1X2",pick:"Draw",raw:m.draw,min:62,mr:.88},
  {market:"1X2",pick:"Away",raw:m.away,min:62,mr:.90},
  {market:"Total Goals",pick:"Over 1.5",raw:m.o15,min:72,mr:.98,support:{market:"Total Goals",pick:"Over 2.5",rawProbability:m.o25,minimum:68}},
  {market:"Double Chance",pick:"1X",raw:m.homeOrDraw,min:72,mr:1,support:{market:"1X2",pick:"Home",rawProbability:m.home,minimum:62}},
  {market:"Double Chance",pick:"X2",raw:m.awayOrDraw,min:V25.x2RawMin,mr:1,support:{market:"1X2",pick:"Away",rawProbability:m.away,minimum:V25.x2AwaySupportMin}}
 ];
 const candidates=rows.map(x=>{
   const reliability=ef*x.mr;
   const c=calibrate(x.raw,reliability,i,x.market,x.pick,lh,la);
   return {...x,reliability,...c};
  })
  .filter(x=>x.raw>=x.min&&x.probability>=(x.pick==="X2"?V25.x2CalibratedMin:68)&&(!x.support||x.support.rawProbability>=x.support.minimum))
  .sort((a,b)=>b.probability-a.probability);
 const publishable=candidates.find(x=>x.publishable);
 const review=candidates.find(x=>!x.publishable&&x.selectionStatus==="REVIEW");
 const shape=(x:typeof candidates[number]):BetRecommendation=>{
  const t=(V26.marketTemperature as Record<string,number>)[x.pick]??1;
  const publicProbability=temperatureCalibrate(x.probability,t);
  return {
  market:x.market,pick:x.pick,probability:+publicProbability.toFixed(1),selectionProbability:+x.probability.toFixed(1),rawProbability:+x.raw.toFixed(1),
  reliability:+x.reliability.toFixed(3),rating:rating(publicProbability),
  selectionStatus:x.selectionStatus,publishable:x.publishable,
  ...(x.marketProbability!==undefined?{marketProbability:+x.marketProbability.toFixed(1)}:{}),
  ...(x.marketDivergence!==undefined?{marketDivergence:+x.marketDivergence.toFixed(1)}:{}),
  riskFlags:x.riskFlags,
  ...(x.support?{support:{...x.support,rawProbability:+x.support.rawProbability.toFixed(1)}}:{})
 };};
 return {recommendedBet:publishable?shape(publishable):null,reviewBet:review?shape(review):null};
};

export function calculate(i:ModelInput){
 const hAtt=blend(i.homeAttack,i.recentHomeAttack),aAtt=blend(i.awayAttack,i.recentAwayAttack),hDef=blend(i.homeDefence,i.recentHomeDefence),aDef=blend(i.awayDefence,i.recentAwayDefence);
 const ef=evidenceFactor(i);const rawH=i.leagueHomeGoals*hAtt*aDef*(i.homeAdvantage??1),rawA=i.leagueAwayGoals*aAtt*hDef;
 const lh=clamp(i.leagueHomeGoals+(rawH-i.leagueHomeGoals)*ef),la=clamp(i.leagueAwayGoals+(rawA-i.leagueAwayGoals)*ef);
 const rho=Math.max(-.2,Math.min(.2,i.rho??-.08));let h=0,d=0,a=0,o15=0,o25=0,total=0;
 const cells:Array<{x:number;y:number;p:number}>=[];
 for(let x=0;x<=8;x++)for(let y=0;y<=8;y++){const p=Math.max(0,dcTau(x,y,lh,la,rho)*pois(x,lh)*pois(y,la));cells.push({x,y,p});total+=p;}
 for(const row of cells){const p=row.p/total;if(row.x>row.y)h+=p;else if(row.x===row.y)d+=p;else a+=p;if(row.x+row.y>1)o15+=p;if(row.x+row.y>2)o25+=p;}
 const pct=(v:number)=>Math.round(v*1000)/10;
 const markets={home:pct(h),draw:pct(d),away:pct(a),homeOrDraw:pct(h+d),awayOrDraw:pct(a+d),o15:pct(o15),o25:pct(o25)};
 const selection=recommend(markets,i,lh,la);
 return {
  modelVersion:MODEL_VERSION,
  lambdaHome:+lh.toFixed(2),lambdaAway:+la.toFixed(2),
  home:markets.home,draw:markets.draw,away:markets.away,
  doubleChance:{homeOrDraw:markets.homeOrDraw,awayOrDraw:markets.awayOrDraw},
  over15:markets.o15,over25:markets.o25,
  recommendedBet:selection.recommendedBet,
  reviewBet:selection.reviewBet
 };
}
