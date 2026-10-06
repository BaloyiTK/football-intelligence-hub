type Row={fixtureId:string;home:string;away:string;gfH:number;gaH:number;gfA:number;gaA:number;actual:[number,number]};
const rows:Row[]=[
{fixtureId:"1738391",home:"Montenegro",away:"Armenia",gfH:2,gaH:1.2,gfA:1.2,gaA:1.4,actual:[0,0]},
{fixtureId:"1506214",home:"Montenegro U21",away:"Armenia U21",gfH:1.6,gaH:2,gfA:.6,gaA:2.6,actual:[1,1]},
{fixtureId:"1893787",home:"Beasat Kermanshah",away:"Naft Bandar Abbas",gfH:.8,gaH:1.2,gfA:1,gaA:.4,actual:[2,1]},
{fixtureId:"1726093",home:"Odds Ballklubb 2",away:"Viking 2",gfH:2,gaH:2,gfA:2.2,gaA:1.6,actual:[3,1]},
{fixtureId:"1876576",home:"Sportivo Trinidense",away:"Luqueno",gfH:1.8,gaH:1,gfA:.6,gaA:1.4,actual:[3,2]},
{fixtureId:"1715668",home:"Sportivo Barracas",away:"Leones de Rosario",gfH:.6,gaH:1,gfA:.6,gaA:.4,actual:[0,2]}];
const fact=[1,1,2,6,24,120,720,5040,40320,362880,3628800];
const pois=(k:number,l:number)=>Math.exp(-l)*Math.pow(l,k)/fact[k];
const probs=(lh:number,la:number)=>{let H=0,D=0,A=0,O=0,B=0,t=0;for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const p=pois(i,lh)*pois(j,la);t+=p;if(i>j)H+=p;else if(i===j)D+=p;else A+=p;if(i+j>=3)O+=p;if(i>0&&j>0)B+=p}return{home:H/t,draw:D/t,away:A/t,over25:O/t,bttsYes:B/t}};
const strongest=(p:any)=>{const xs=[["HOME",p.home],["AWAY",p.away],["OVER 2.5",p.over25],["BTTS YES",p.bttsYes]] as [string,number][];if(p.draw>p.home&&p.draw>p.away)xs.splice(0,2);return xs.sort((a,b)=>b[1]-a[1])[0]};
const hit=(m:string,a:[number,number])=>m==="HOME"?a[0]>a[1]:m==="AWAY"?a[1]>a[0]:m==="OVER 2.5"?a[0]+a[1]>=3:a[0]>0&&a[1]>0;
const out=rows.map(r=>{const lh=(r.gfH+r.gaA)/2,la=(r.gfA+r.gaH)/2;const p=probs(lh,la),s=strongest(p);return{...r,expectedGoals:{home:lh,away:la},v2Probabilities:p,v2Strongest:s[0],v2Strength:s[1],reliability:{overall:.30,homeAway:.30,over25:.30,btts:.30},hit:hit(s[0],r.actual)}});
console.log(JSON.stringify(out));
