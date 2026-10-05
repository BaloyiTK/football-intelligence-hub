import {calculate as calculateV29, type ModelInput} from "./model";

export const V3_MODEL_VERSION="v3.0-shadow-coherence-challenger";

export type V3Input=ModelInput & {
  homeRestDays?:number; awayRestDays?:number;
  homeAvailability?:number; awayAvailability?:number;
};

const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const logistic=(z:number)=>1/(1+Math.exp(-z));
const logit=(p:number)=>Math.log(clamp(p,.001,.999)/(1-clamp(p,.001,.999)));

export function calculateV3(i:V3Input){
  // V2.9 remains untouched. V3 starts from the same football engine, then applies
  // explicitly auditable challenger-only context/coherence diagnostics.
  const base=calculateV29(i);
  const restDelta=clamp((i.homeRestDays??0)-(i.awayRestDays??0),-5,5);
  const availabilityDelta=clamp((i.homeAvailability??1)-(i.awayAvailability??1),-.35,.35);
  const contextLogitShift=restDelta*.025+availabilityDelta*.45;

  const home=100*logistic(logit(base.home/100)+contextLogitShift);
  const away=100*logistic(logit(base.away/100)-contextLogitShift);
  const draw=Math.max(1,base.draw);
  const norm=home+away+draw;
  const h=home/norm*100,d=draw/norm*100,a=away/norm*100;

  const expectedTotal=base.lambdaHome+base.lambdaAway;
  const scoreHome=Math.max(0,Math.round(base.lambdaHome));
  const scoreAway=Math.max(0,Math.round(base.lambdaAway));
  const scoreTotal=scoreHome+scoreAway;
  const flags:string[]=[];
  if(base.over25>=75&&scoreTotal<3) flags.push("score-vs-over25");
  if(h>=70&&scoreHome<=scoreAway) flags.push("score-vs-home-direction");
  if(a>=70&&scoreAway<=scoreHome) flags.push("score-vs-away-direction");
  if(Math.abs(scoreTotal-expectedTotal)>=1.5) flags.push("score-vs-lambda-total");

  return {
    modelVersion:V3_MODEL_VERSION,
    shadowOnly:true,
    productionBaseline:base.modelVersion,
    lambdaHome:base.lambdaHome,lambdaAway:base.lambdaAway,
    home:+h.toFixed(1),draw:+d.toFixed(1),away:+a.toFixed(1),
    over15:base.over15,over25:base.over25,
    predictedScore:{home:scoreHome,away:scoreAway},
    context:{restDelta,availabilityDelta:+availabilityDelta.toFixed(3),logitShift:+contextLogitShift.toFixed(3)},
    coherence:{status:flags.length?"REVIEW":"COHERENT",flags},
    v29Reference:{recommendedBet:base.recommendedBet,reviewBet:base.reviewBet}
  };
}
