import fs from "node:fs";import path from "node:path";
const arg=process.argv.find(x=>x.startsWith("--dates="));
const dates=(arg?arg.slice("--dates=".length).split(","):["2026-09-29","2026-09-30","2026-10-01","2026-10-02","2026-10-03","2026-10-04","2026-10-05"]).filter(Boolean);
type M={date:string;fixtureId:string;competition:string;country:string;homeId:string;home:string;awayId:string;away:string;homeGoals:number;awayGoals:number};
const prior:M[]=[];
const requestedStart=[...dates].sort()[0];
const historyDir="data/backtest/history";
if(fs.existsSync(historyDir)){
 for(const file of fs.readdirSync(historyDir).filter(x=>x.endsWith(".json")).sort()){
  const h=JSON.parse(fs.readFileSync(path.join(historyDir,file),"utf8"));
  for(const m of (h.matches||[])){
   if(String(m.date||"")>=requestedStart) continue;
   const hg=Number(m.homeGoals),ag=Number(m.awayGoals);
   if(!m.homeId||!m.awayId||!Number.isFinite(hg)||!Number.isFinite(ag)) continue;
   prior.push({...m,homeGoals:hg,awayGoals:ag});
  }
 }
}
prior.sort((a,b)=>a.date.localeCompare(b.date));
function result(m:M,id:string){const gf=m.homeId===id?m.homeGoals:m.awayGoals,ga=m.homeId===id?m.awayGoals:m.homeGoals;return gf>ga?"W":gf<ga?"L":"D"}
function poisson(k:number,l:number){let f=1;for(let i=2;i<=k;i++)f*=i;return Math.exp(-l)*Math.pow(l,k)/f}
for(const date of dates){const raw=JSON.parse(fs.readFileSync("data/backtest/fixtures/"+date+".json","utf8"));const rows:any[]=[];
 for(const s of raw.payload?.Stages||[])for(const e of s.Events||[]){const h=e.T1?.[0],a=e.T2?.[0];if(!h||!a)continue;const hid=String(h.ID||""),aid=String(a.ID||"");
  const hist=(id:string)=>prior.filter(m=>m.homeId===id||m.awayId===id).slice(-5).reverse();
  const hh=hist(hid),ah=hist(aid),h2h=prior.filter(m=>(m.homeId===hid&&m.awayId===aid)||(m.homeId===aid&&m.awayId===hid)).slice(-5).reverse();
  const pack=(ms:M[],id:string)=>ms.map(m=>({date:m.date,competition:m.competition,home:m.home,away:m.away,homeGoals:m.homeGoals,awayGoals:m.awayGoals,resultForTeam:result(m,id)}));
  let model:any={status:"INSUFFICIENT_DATA",reason:"Need at least 3 verified prior matches for each team in leak-free history window."};
  if(hh.length>=3&&ah.length>=3){const avg=(ms:M[],id:string,forGoals:boolean)=>ms.reduce((z,m)=>{const gf=m.homeId===id?m.homeGoals:m.awayGoals,ga=m.homeId===id?m.awayGoals:m.homeGoals;return z+(forGoals?gf:ga)},0)/ms.length;
   const lh=Math.max(.2,Math.min(4.5,(avg(hh,hid,true)+avg(ah,aid,false))/2)),la=Math.max(.2,Math.min(4.5,(avg(ah,aid,true)+avg(hh,hid,false))/2));let H=0,D=0,A=0,O=0,B=0;
   for(let x=0;x<=10;x++)for(let y=0;y<=10;y++){const p=poisson(x,lh)*poisson(y,la);if(x>y)H+=p;else if(x===y)D+=p;else A+=p;if(x+y>2)O+=p;if(x>0&&y>0)B+=p}const sum=H+D+A;H/=sum;D/=sum;A/=sum;
   model={status:"CALCULATED",engine:"FIH_POISSON_V1_UNVALIDATED",expectedGoals:{home:+lh.toFixed(3),away:+la.toFixed(3)},probabilities:{home:+H.toFixed(4),draw:+D.toFixed(4),away:+A.toFixed(4),over25:+O.toFixed(4),under25:+(1-O).toFixed(4),bttsYes:+B.toFixed(4),bttsNo:+(1-B).toFixed(4)},fairOdds:{home:+(1/H).toFixed(2),draw:+(1/D).toFixed(2),away:+(1/A).toFixed(2),over25:+(1/O).toFixed(2),bttsYes:+(1/B).toFixed(2)}}}
  rows.push({fixtureId:String(e.Eid||""),country:s.CompCnmt||s.CompD||"",competition:s.Cnm||s.CompN||"",kickoff:String(e.Esd||""),home:h.Nm,away:a.Nm,evidence:{homeLast5Overall:pack(hh,hid),awayLast5Overall:pack(ah,aid),h2h:pack(h2h,hid),venueForm:"UNAVAILABLE",xg:"UNAVAILABLE",standings:"UNAVAILABLE",squadAvailability:"UNAVAILABLE",motivation:"UNAVAILABLE",opponentStrength:"UNAVAILABLE",restSchedule:"UNAVAILABLE"},model,marketOdds:{status:"UNAVAILABLE"},decision:{status:model.status==="CALCULATED"?"NO_BET":"INSUFFICIENT_DATA",reason:model.status==="CALCULATED"?"No calibrated qualification threshold and no verified historical pre-match market odds; do not invent a bet.":model.reason},actualResult:{homeGoals:Number(e.Tr1),awayGoals:Number(e.Tr2),status:e.Eps||""}});
 }
 const out={schema:"fih-backtest-predictions-v1",date,generatedAt:new Date().toISOString(),integrity:{lookahead:"Only persisted matches strictly earlier than the evaluated date are eligible model evidence; historical corpus is seeded before the requested window.",model:"UNVALIDATED_BASELINE",historicalMarketOdds:"UNAVAILABLE unless separately verified"},fixtureCount:rows.length,fixtures:rows};fs.mkdirSync("data/backtest/predictions",{recursive:true});fs.writeFileSync("data/backtest/predictions/"+date+".json",JSON.stringify(out)+"\n");
 for(const s of raw.payload?.Stages||[])for(const e of s.Events||[]){const h=e.T1?.[0],a=e.T2?.[0],hg=Number(e.Tr1),ag=Number(e.Tr2);if(!h||!a||!Number.isFinite(hg)||!Number.isFinite(ag))continue;prior.push({date,fixtureId:String(e.Eid||""),competition:s.Cnm||s.CompN||"",country:s.CompCnmt||s.CompD||"",homeId:String(h.ID||""),home:h.Nm,awayId:String(a.ID||""),away:a.Nm,homeGoals:hg,awayGoals:ag})}
}

// execution trigger 2026-10-06
