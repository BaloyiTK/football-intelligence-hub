export type Match={home:string;away:string;homeGoals:number;awayGoals:number;opponentStrength?:number};
export type TeamEvidence={
 team:string;
 overall:Match[];
 venue?:Match[];
 ppg?:number;
 goalDifferencePerGame?:number;
 scoringRate?:number;
 concedingRate?:number;
 bttsRate?:number;
 over25Rate?:number;
 restDays?:number;
 availabilityAttack?:number;
 availabilityDefence?:number;
 motivation?:number;
};
export type FihV2Input={home:TeamEvidence;away:TeamEvidence;h2h?:Match[]};
export type ResultProfile={matches:number;wins:number;draws:number;losses:number;points:number;ppg:number;winRate:number;drawRate:number;lossRate:number};

export const FIH_FIVE_FACTOR_WEIGHTS=Object.freeze({
 overallForm:0.30,
 venueForm:0.30,
 leaguePosition:0.15,
 headToHead:0.15,
 motivation:0.10
});

const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:NaN;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const fact=[1,1,2,6,24,120,720,5040,40320,362880,3628800];
const pois=(k:number,l:number)=>Math.exp(-l)*Math.pow(l,k)/fact[k];
const rates=(team:string,ms:Match[])=>{
 const rows=ms.slice(0,5).map(m=>({gf:m.home===team?m.homeGoals:m.awayGoals,ga:m.home===team?m.awayGoals:m.homeGoals,w:clamp(m.opponentStrength??1,.65,1.35)}));
 const den=rows.reduce((s,r)=>s+r.w,0);
 return rows.length?{gf:rows.reduce((s,r)=>s+r.gf*r.w,0)/den,ga:rows.reduce((s,r)=>s+r.ga*r.w,0)/den,n:rows.length}:null;
};
const resultProfile=(team:string,ms:Match[]):ResultProfile|null=>{
 const rows=ms.slice(0,5);if(!rows.length)return null;
 let wins=0,draws=0,losses=0;
 for(const m of rows){const gf=m.home===team?m.homeGoals:m.awayGoals,ga=m.home===team?m.awayGoals:m.homeGoals;if(gf>ga)wins++;else if(gf===ga)draws++;else losses++;}
 const matches=rows.length,points=wins*3+draws;
 return{matches,wins,draws,losses,points,ppg:points/matches,winRate:wins/matches,drawRate:draws/matches,lossRate:losses/matches};
};
const blend=(parts:{v:number;w:number}[])=>{const ok=parts.filter(x=>Number.isFinite(x.v)&&x.w>0),w=ok.reduce((s,x)=>s+x.w,0);return w?ok.reduce((s,x)=>s+x.v*x.w,0)/w:NaN};
const matrix=(lh:number,la:number)=>{let H=0,D=0,A=0,O=0,B=0,t=0;for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const p=pois(i,lh)*pois(j,la);t+=p;if(i>j)H+=p;else if(i===j)D+=p;else A+=p;if(i+j>=3)O+=p;if(i>0&&j>0)B+=p}return{home:H/t,draw:D/t,away:A/t,over25:O/t,bttsYes:B/t}};
const reliability=(e:TeamEvidence)=>{let s=0,w=0;const add=(ok:boolean,x:number)=>{w+=x;if(ok)s+=x};add(e.overall.length>=5,30);add((e.venue?.length??0)===5,20);add(Number.isFinite(e.ppg),10);add(Number.isFinite(e.goalDifferencePerGame),10);add(Number.isFinite(e.scoringRate)&&Number.isFinite(e.concedingRate),10);add(Number.isFinite(e.restDays),5);return s/w};

type FiveFactorRow={factor:string;weightPercent:number;status:"USED"|"UNAVAILABLE";metric:string;homeRaw:number|null;awayRaw:number|null;homeShare:number|null;awayShare:number|null;homeContribution:number;awayContribution:number;detail:string};
const pairShare=(h:number,a:number)=>{
 if(!Number.isFinite(h)||!Number.isFinite(a)||h<0||a<0)return null;
 const t=h+a;
 return t>0?{home:h/t,away:a/t}:{home:.5,away:.5};
};
const strengthRow=(factor:string,weight:number,metric:string,h:number|undefined,a:number|undefined,detail:string):FiveFactorRow=>{
 const s=h===undefined||a===undefined?null:pairShare(h,a),wp=weight*100;
 return s?{factor,weightPercent:wp,status:"USED",metric,homeRaw:h!,awayRaw:a!,homeShare:s.home*100,awayShare:s.away*100,homeContribution:wp*s.home,awayContribution:wp*s.away,detail}
 :{factor,weightPercent:wp,status:"UNAVAILABLE",metric,homeRaw:h??null,awayRaw:a??null,homeShare:null,awayShare:null,homeContribution:0,awayContribution:0,detail};
};
const fiveFactorStrength=(i:FihV2Input,rh:ResultProfile|null,ra:ResultProfile|null,rvh:ResultProfile|null,rva:ResultProfile|null)=>{
 const h2hUsable=(i.h2h?.length??0)===5;
 const h2hHome=h2hUsable?resultProfile(i.home.team,i.h2h!):null;
 const h2hAway=h2hUsable?resultProfile(i.away.team,i.h2h!):null;
 const rows:FiveFactorRow[]=[
  strengthRow("overallForm",FIH_FIVE_FACTOR_WEIGHTS.overallForm,"last-5 W/D/L points (3/1/0)",rh?.points,ra?.points,"Overall recent form."),
  strengthRow("venueForm",FIH_FIVE_FACTOR_WEIGHTS.venueForm,"exact last-5 HOME/AWAY W/D/L points (3/1/0)",rvh?.points,rva?.points,"Home team HOME form versus away team AWAY form; requires exactly five each."),
  strengthRow("leaguePosition",FIH_FIVE_FACTOR_WEIGHTS.leaguePosition,"season PPG derived from standings",i.home.ppg,i.away.ppg,"League-position strength is operationalized by season points per game so league size/round count do not distort the comparison."),
  strengthRow("headToHead",FIH_FIVE_FACTOR_WEIGHTS.headToHead,"exact last-5 H2H W/D/L points (3/1/0)",h2hHome?.points,h2hAway?.points,"Requires five source-backed H2H meetings."),
  strengthRow("motivation",FIH_FIVE_FACTOR_WEIGHTS.motivation,"locked Step-3 motivation index",i.home.motivation,i.away.motivation,"Competitive-fixture baseline plus source-backed context-tag overrides.")
 ];
 const used=rows.filter(r=>r.status==="USED"),availableWeightPercent=used.reduce((s,r)=>s+r.weightPercent,0);
 const hc=used.reduce((s,r)=>s+r.homeContribution,0),ac=used.reduce((s,r)=>s+r.awayContribution,0);
 return {
  model:"FIH-5F-V1",
  scoring:"W=3,D=1,L=0 for overall/venue/H2H; league factor uses season PPG; motivation uses locked Step-3 index.",
  weightsPercent:{overallForm:30,venueForm:30,leaguePosition:15,headToHead:15,motivation:10},
  missingEvidencePolicy:"RENORMALIZE_AVAILABLE_LOCKED_WEIGHTS_NO_IMPUTATION",
  availableWeightPercent,
  coverage:availableWeightPercent/100,
  home:availableWeightPercent?hc/availableWeightPercent*100:null,
  away:availableWeightPercent?ac/availableWeightPercent*100:null,
  factors:rows,
  interpretation:"Strength score only; not a win probability."
 };
};

export function fihV2(i:FihV2Input){
 const ho=rates(i.home.team,i.home.overall),ao=rates(i.away.team,i.away.overall),hv=rates(i.home.team,i.home.venue??[]),av=rates(i.away.team,i.away.venue??[]);
 const rh=resultProfile(i.home.team,i.home.overall),ra=resultProfile(i.away.team,i.away.overall),rvh=(i.home.venue?.length===5?resultProfile(i.home.team,i.home.venue):null),rva=(i.away.venue?.length===5?resultProfile(i.away.team,i.away.venue):null);
 if(!ho||!ao||ho.n<3||ao.n<3)return{version:"FIH-V2-RESEARCH",status:"INSUFFICIENT_DATA",reason:"Need at least 3 verified overall matches for each team."};
 const resultStrength=fiveFactorStrength(i,rh,ra,rvh,rva);
 // FIH expected goals (lambdaHome/lambdaAway) are created here from verified factual evidence only.
 // Overall scoring/conceding form is the anchor; home/away venue form refines the base when available.
 // blend() renormalizes over only the factual components that actually exist.
 let lh=blend([{v:(ho.gf+ao.ga)/2,w:.50},{v:hv?hv.gf:NaN,w:.15},{v:av?av.ga:NaN,w:.15}]);
 let la=blend([{v:(ao.gf+ho.ga)/2,w:.50},{v:av?av.gf:NaN,w:.15},{v:hv?hv.ga:NaN,w:.15}]);
 const strength=Number.isFinite(i.home.ppg)&&Number.isFinite(i.away.ppg)?clamp((i.home.ppg!-i.away.ppg!)/3,-.20,.20):0;
 const gd=Number.isFinite(i.home.goalDifferencePerGame)&&Number.isFinite(i.away.goalDifferencePerGame)?clamp((i.home.goalDifferencePerGame!-i.away.goalDifferencePerGame!)/6,-.12,.12):0;
 // Missing optional evidence is not imputed. Result-strength missing factors are omitted and the remaining locked weights are renormalized.
 lh*=1+strength+gd;la*=1-strength-gd;
 lh=clamp(lh,.20,4.50);la=clamp(la,.20,4.50);
 const p=matrix(lh,la);
 const rHome=reliability(i.home),rAway=reliability(i.away),baseR=(rHome+rAway)/2;
 const resultReliability=clamp((baseR+resultStrength.coverage)/2,0,1);
 const goalsReliability=clamp(baseR+(Number.isFinite(i.home.over25Rate)&&Number.isFinite(i.away.over25Rate)?.06:0),0,1);
 const bttsReliability=clamp(baseR+(Number.isFinite(i.home.bttsRate)&&Number.isFinite(i.away.bttsRate)?.06:0),0,1);
 return{version:"FIH-V2-RESEARCH",status:"CALCULATED",resultStrength,resultProfile:{home:{overall:rh,venue:rvh,seasonPpg:Number.isFinite(i.home.ppg)?i.home.ppg:null},away:{overall:ra,venue:rva,seasonPpg:Number.isFinite(i.away.ppg)?i.away.ppg:null},edges:{recentPpg:rh&&ra?rh.ppg-ra.ppg:null,venuePpg:rvh&&rva?rvh.ppg-rva.ppg:null,seasonPpg:Number.isFinite(i.home.ppg)&&Number.isFinite(i.away.ppg)?i.home.ppg!-i.away.ppg!:null}},expectedGoals:{home:lh,away:la,total:lh+la},probabilities:{oneXTwo:{home:p.home,draw:p.draw,away:p.away},overUnder25:{over:p.over25,under:1-p.over25},btts:{yes:p.bttsYes,no:1-p.bttsYes}},fairOdds:{home:1/p.home,draw:1/p.draw,away:1/p.away,over25:1/p.over25,bttsYes:1/p.bttsYes},reliability:{homeAway:resultReliability,over25:goalsReliability,btts:bttsReliability,overall:baseR,fiveFactorCoverage:resultStrength.coverage},evidenceCoverage:{home:rHome,away:rAway},notes:["FIH-5F-V1 result strength is locked at Overall 30%, Venue 30%, League 15%, H2H 15%, Motivation 10%.","The five-factor strength score is not a win probability and remains separate from Poisson probabilities/fair odds.","W/D/L result profiles are derived by Step 3 from verified scorelines and exposed separately from goal probabilities.","FIH expected goals are calculated internally from verified factual form/venue/standings evidence; no external xG/xGA is consumed.","Missing optional evidence is not imputed; unavailable five-factor inputs cause transparent locked-weight renormalization.","No qualification threshold is hard-coded; publication thresholds require calibration."]};
}
