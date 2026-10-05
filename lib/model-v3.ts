import {calculate as calculateV29, type ModelInput} from "./model";

export const V3_MODEL_VERSION="v3.0-phase2-shadow-challenger";

export type V3Input=ModelInput & {
  homeRestDays?:number; awayRestDays?:number;
  homeAvailability?:number; awayAvailability?:number;
};

const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const logistic=(z:number)=>1/(1+Math.exp(-z));
const logit=(p:number)=>Math.log(clamp(p,.001,.999)/(1-clamp(p,.001,.999)));
const poisson=(k:number,l:number)=>Math.exp(-l)*Math.pow(l,k)/[1,1,2,6,24,120,720,5040,40320][k];

function modalScore(lambdaHome:number,lambdaAway:number){
  let best={home:0,away:0,p:-1};
  for(let h=0;h<=8;h++)for(let a=0;a<=8;a++){
    const p=poisson(h,lambdaHome)*poisson(a,lambdaAway);
    if(p>best.p)best={home:h,away:a,p};
  }
  return {home:best.home,away:best.away};
}

export function calculateV3(i:V3Input){
  const base=calculateV29(i);
  const hasRest=Number.isFinite(i.homeRestDays)&&Number.isFinite(i.awayRestDays);
  const hasAvailability=Number.isFinite(i.homeAvailability)&&Number.isFinite(i.awayAvailability);
  const restDelta=hasRest?clamp(i.homeRestDays!-i.awayRestDays!,-5,5):0;
  const availabilityDelta=hasAvailability?clamp(i.homeAvailability!-i.awayAvailability!,-.35,.35):0;
  const contextLogitShift=restDelta*.025+availabilityDelta*.45;

  const home=100*logistic(logit(base.home/100)+contextLogitShift);
  const away=100*logistic(logit(base.away/100)-contextLogitShift);
  const draw=Math.max(1,base.draw),norm=home+away+draw;
  const h=home/norm*100,d=draw/norm*100,a=away/norm*100;

  // Phase 2 uses the most probable Poisson score cell instead of rounding lambdas.
  // This makes the displayed score an actual model outcome and lets coherence checks
  // detect cases where a safe derivative bet conflicts with the likely score shape.
  const predictedScore=modalScore(base.lambdaHome,base.lambdaAway);
  const scoreTotal=predictedScore.home+predictedScore.away;
  const flags:string[]=[];
  if(base.over25>=68&&scoreTotal<2) flags.push("score-vs-over25-support");
  if(base.over25>=75&&scoreTotal<3) flags.push("score-vs-strong-over25");
  if(h>=62&&predictedScore.home<predictedScore.away) flags.push("score-vs-home-direction");
  if(a>=62&&predictedScore.away<predictedScore.home) flags.push("score-vs-away-direction");
  if(base.recommendedBet?.pick==="1X"&&predictedScore.home<predictedScore.away) flags.push("published-1x-vs-score");
  if(base.recommendedBet?.pick==="X2"&&predictedScore.away<predictedScore.home) flags.push("published-x2-vs-score");
  if(base.recommendedBet?.pick==="Over 1.5"&&scoreTotal<2) flags.push("published-over15-vs-score");

  return {
    modelVersion:V3_MODEL_VERSION,
    shadowOnly:true,
    productionBaseline:base.modelVersion,
    lambdaHome:base.lambdaHome,lambdaAway:base.lambdaAway,
    home:+h.toFixed(1),draw:+d.toFixed(1),away:+a.toFixed(1),
    over15:base.over15,over25:base.over25,
    predictedScore,
    context:{hasRest,hasAvailability,restDelta,availabilityDelta:+availabilityDelta.toFixed(3),logitShift:+contextLogitShift.toFixed(3)},
    coherence:{status:flags.length?"REVIEW":"COHERENT",flags},
    v29Reference:{recommendedBet:base.recommendedBet,reviewBet:base.reviewBet}
  };
}
