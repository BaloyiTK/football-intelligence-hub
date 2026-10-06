export type Match={home:string;away:string;homeGoals:number;awayGoals:number;opponentStrength?:number};
export type TeamEvidence={
 team:string;
 overall:Match[];
 venue?:Match[];
 ppg?:number;
 goalDifferencePerGame?:number;
 xgFor?:number;
 xgAgainst?:number;
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

const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:NaN;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const fact=[1,1,2,6,24,120,720,5040,40320,362880,3628800];
const pois=(k:number,l:number)=>Math.exp(-l)*Math.pow(l,k)/fact[k];
const rates=(team:string,ms:Match[])=>{
 const rows=ms.slice(0,5).map(m=>({gf:m.home===team?m.homeGoals:m.awayGoals,ga:m.home===team?m.awayGoals:m.homeGoals,w:clamp(m.opponentStrength??1,.65,1.35)}));
 const den=rows.reduce((s,r)=>s+r.w,0);
 return rows.length?{gf:rows.reduce((s,r)=>s+r.gf*r.w,0)/den,ga:rows.reduce((s,r)=>s+r.ga*r.w,0)/den,n:rows.length}:null;
};
const blend=(parts:{v:number;w:number}[])=>{const ok=parts.filter(x=>Number.isFinite(x.v)&&x.w>0),w=ok.reduce((s,x)=>s+x.w,0);return w?ok.reduce((s,x)=>s+x.v*x.w,0)/w:NaN};
const matrix=(lh:number,la:number)=>{let H=0,D=0,A=0,O=0,B=0,t=0;for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const p=pois(i,lh)*pois(j,la);t+=p;if(i>j)H+=p;else if(i===j)D+=p;else A+=p;if(i+j>=3)O+=p;if(i>0&&j>0)B+=p}return{home:H/t,draw:D/t,away:A/t,over25:O/t,bttsYes:B/t}};
const reliability=(e:TeamEvidence)=>{let s=0,w=0;const add=(ok:boolean,x:number)=>{w+=x;if(ok)s+=x};add(e.overall.length>=5,30);add((e.venue?.length??0)>=3,20);add(Number.isFinite(e.ppg),10);add(Number.isFinite(e.goalDifferencePerGame),10);add(Number.isFinite(e.xgFor)&&Number.isFinite(e.xgAgainst),15);add(Number.isFinite(e.scoringRate)&&Number.isFinite(e.concedingRate),10);add(Number.isFinite(e.restDays),5);return s/w};
export function fihV2(i:FihV2Input){
 const ho=rates(i.home.team,i.home.overall),ao=rates(i.away.team,i.away.overall),hv=rates(i.home.team,i.home.venue??[]),av=rates(i.away.team,i.away.venue??[]);
 if(!ho||!ao||ho.n<3||ao.n<3)return{version:"FIH-V2-RESEARCH",status:"INSUFFICIENT_DATA",reason:"Need at least 3 verified overall matches for each team."};
 // Expected-goal base: overall form is the anchor; venue, xG and scoring profiles refine it when independently verified.
 let lh=blend([{v:(ho.gf+ao.ga)/2,w:.50},{v:hv?hv.gf:NaN,w:.15},{v:av?av.ga:NaN,w:.15},{v:Number.isFinite(i.home.xgFor)?i.home.xgFor!:NaN,w:.10},{v:Number.isFinite(i.away.xgAgainst)?i.away.xgAgainst!:NaN,w:.10}]);
 let la=blend([{v:(ao.gf+ho.ga)/2,w:.50},{v:av?av.gf:NaN,w:.15},{v:hv?hv.ga:NaN,w:.15},{v:Number.isFinite(i.away.xgFor)?i.away.xgFor!:NaN,w:.10},{v:Number.isFinite(i.home.xgAgainst)?i.home.xgAgainst!:NaN,w:.10}]);
 // Conservative contextual adjustments; deliberately small until a larger backtest can calibrate them.
 const strength=clamp(((i.home.ppg??1.5)-(i.away.ppg??1.5))/3,-.20,.20);
 const gd=clamp(((i.home.goalDifferencePerGame??0)-(i.away.goalDifferencePerGame??0))/6,-.12,.12);
 const avail=clamp(((i.home.availabilityAttack??0)-(i.away.availabilityDefence??0))/20,-.08,.08);
 lh*=1+strength+gd+avail;la*=1-strength-gd;
 lh=clamp(lh,.20,4.50);la=clamp(la,.20,4.50);
 const p=matrix(lh,la);
 // Market-specific evidence: do not force all markets through the same confidence.
 const rHome=reliability(i.home),rAway=reliability(i.away),baseR=(rHome+rAway)/2;
 const resultReliability=clamp(baseR+(Number.isFinite(i.home.ppg)&&Number.isFinite(i.away.ppg)?.08:0),0,1);
 const goalsReliability=clamp(baseR+(Number.isFinite(i.home.over25Rate)&&Number.isFinite(i.away.over25Rate)?.06:0),0,1);
 const bttsReliability=clamp(baseR+(Number.isFinite(i.home.bttsRate)&&Number.isFinite(i.away.bttsRate)?.06:0),0,1);
 return{version:"FIH-V2-RESEARCH",status:"CALCULATED",expectedGoals:{home:lh,away:la,total:lh+la},probabilities:{oneXTwo:{home:p.home,draw:p.draw,away:p.away},overUnder25:{over:p.over25,under:1-p.over25},btts:{yes:p.bttsYes,no:1-p.bttsYes}},fairOdds:{home:1/p.home,draw:1/p.draw,away:1/p.away,over25:1/p.over25,bttsYes:1/p.bttsYes},reliability:{homeAway:resultReliability,over25:goalsReliability,btts:bttsReliability,overall:baseR},evidenceCoverage:{home:rHome,away:rAway},notes:["Separate market reliability from probability.","Venue/xG/standings refine rather than replace recent form.","No qualification threshold is hard-coded; calibrate from larger backtests."]};
}
