type Match={home:string;away:string;homeGoals:number;awayGoals:number};
type Odds={home:number;draw:number;away:number};
const avg=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const pois=(k:number,l:number)=>Math.exp(-l)*Math.pow(l,k)/[1,1,2,6,24,120,720,5040,40320,362880,3628800][k];
export function fihV1(home:string,away:string,home5:Match[],away5:Match[],market:Odds){
 const teamRates=(team:string,ms:Match[])=>({gf:avg(ms.map(m=>m.home===team?m.homeGoals:m.awayGoals)),ga:avg(ms.map(m=>m.home===team?m.awayGoals:m.homeGoals))});
 const h=teamRates(home,home5),a=teamRates(away,away5);
 // V1: symmetric recent-goals estimator. Clamp limits tiny-sample explosions.
 const lh=clamp((h.gf+a.ga)/2,0.20,4.50),la=clamp((a.gf+h.ga)/2,0.20,4.50);
 let H=0,D=0,A=0,O=0,B=0,total=0;
 for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const p=pois(i,lh)*pois(j,la);total+=p;if(i>j)H+=p;else if(i===j)D+=p;else A+=p;if(i+j>=3)O+=p;if(i>0&&j>0)B+=p}
 H/=total;D/=total;A/=total;O/=total;B/=total;
 const inv=[1/market.home,1/market.draw,1/market.away],s=inv.reduce((x,y)=>x+y,0),fair=inv.map(x=>x/s);
 return {version:"FIH-Poisson-V1",inputs:{homeGF:h.gf,homeGA:h.ga,awayGF:a.gf,awayGA:a.ga},expectedGoals:{home:lh,away:la},probabilities:{oneXTwo:{home:H,draw:D,away:A},overUnder25:{over:O,under:1-O},btts:{yes:B,no:1-B}},fairOdds:{oneXTwo:{home:1/H,draw:1/D,away:1/A},overUnder25:{over:1/O,under:1/(1-O)},btts:{yes:1/B,no:1/(1-B)}},marketFairProbability:{oneXTwo:{home:fair[0],draw:fair[1],away:fair[2]}}};
}
