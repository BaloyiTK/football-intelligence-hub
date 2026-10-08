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
const reliability=(e:TeamEvidence)=>{let s=0,w=0;const add=(ok:boolean,x:number)=>{w+=x;if(ok)s+=x};add(e.overall.length>=5,30);add((e.venue?.length??0)>=3,20);add(Number.isFinite(e.ppg),10);add(Number.isFinite(e.goalDifferencePerGame),10);add(Number.isFinite(e.scoringRate)&&Number.isFinite(e.concedingRate),10);add(Number.isFinite(e.restDays),5);return s/w};
export function fihV2(i:FihV2Input){
 const ho=rates(i.home.team,i.home.overall),ao=rates(i.away.team,i.away.overall),hv=rates(i.home.team,i.home.venue??[]),av=rates(i.away.team,i.away.venue??[]);
 const rh=resultProfile(i.home.team,i.home.overall),ra=resultProfile(i.away.team,i.away.overall),rvh=(i.home.venue?.length===5?resultProfile(i.home.team,i.home.venue):null),rva=(i.away.venue?.length===5?resultProfile(i.away.team,i.away.venue):null);
 if(!ho||!ao||ho.n<3||ao.n<3)return{version:"FIH-V2-RESEARCH",status:"INSUFFICIENT_DATA",reason:"Need at least 3 verified overall matches for each team."};
 // FIH expected goals (lambdaHome/lambdaAway) are created here from verified factual evidence only.
 // Overall scoring/conceding form is the anchor; home/away venue form refines the base when available.
 // blend() renormalizes over only the factual components that actually exist.
 let lh=blend([{v:(ho.gf+ao.ga)/2,w:.50},{v:hv?hv.gf:NaN,w:.15},{v:av?av.ga:NaN,w:.15}]);
 let la=blend([{v:(ao.gf+ho.ga)/2,w:.50},{v:av?av.gf:NaN,w:.15},{v:hv?hv.ga:NaN,w:.15}]);
 // Conservative contextual adjustments; deliberately small until a larger backtest can calibrate them.
 const strength=Number.isFinite(i.home.ppg)&&Number.isFinite(i.away.ppg)?clamp((i.home.ppg!-i.away.ppg!)/3,-.20,.20):0;
 const gd=Number.isFinite(i.home.goalDifferencePerGame)&&Number.isFinite(i.away.goalDifferencePerGame)?clamp((i.home.goalDifferencePerGame!-i.away.goalDifferencePerGame!)/6,-.12,.12):0;
 // Missing optional evidence is not imputed. Squad/motivation context remains non-numeric until calibrated.
 lh*=1+strength+gd;la*=1-strength-gd;
 lh=clamp(lh,.20,4.50);la=clamp(la,.20,4.50);
 const p=matrix(lh,la);
 // Market-specific evidence: do not force all markets through the same confidence.
 const rHome=reliability(i.home),rAway=reliability(i.away),baseR=(rHome+rAway)/2;
 const resultReliability=clamp(baseR+(Number.isFinite(i.home.ppg)&&Number.isFinite(i.away.ppg)?.08:0),0,1);
 const goalsReliability=clamp(baseR+(Number.isFinite(i.home.over25Rate)&&Number.isFinite(i.away.over25Rate)?.06:0),0,1);
 const bttsReliability=clamp(baseR+(Number.isFinite(i.home.bttsRate)&&Number.isFinite(i.away.bttsRate)?.06:0),0,1);
 return{version:"FIH-V2-RESEARCH",status:"CALCULATED",resultProfile:{home:{overall:rh,venue:rvh,seasonPpg:Number.isFinite(i.home.ppg)?i.home.ppg:null},away:{overall:ra,venue:rva,seasonPpg:Number.isFinite(i.away.ppg)?i.away.ppg:null},edges:{recentPpg:rh&&ra?rh.ppg-ra.ppg:null,venuePpg:rvh&&rva?rvh.ppg-rva.ppg:null,seasonPpg:Number.isFinite(i.home.ppg)&&Number.isFinite(i.away.ppg)?i.home.ppg!-i.away.ppg!:null}},expectedGoals:{home:lh,away:la,total:lh+la},probabilities:{oneXTwo:{home:p.home,draw:p.draw,away:p.away},overUnder25:{over:p.over25,under:1-p.over25},btts:{yes:p.bttsYes,no:1-p.bttsYes}},fairOdds:{home:1/p.home,draw:1/p.draw,away:1/p.away,over25:1/p.over25,bttsYes:1/p.bttsYes},reliability:{homeAway:resultReliability,over25:goalsReliability,btts:bttsReliability,overall:baseR},evidenceCoverage:{home:rHome,away:rAway},notes:["W/D/L result profiles are derived by Step 3 from verified scorelines and exposed separately from goal probabilities.","FIH expected goals are calculated internally from verified factual form/venue/standings evidence; no external xG/xGA is consumed.","Missing optional evidence is not imputed; paired strength adjustments apply only when both teams have verified inputs.","Squad/motivation/H2H context is not numerically scored until calibrated.","No qualification threshold is hard-coded; calibrate from larger backtests."]};
}
