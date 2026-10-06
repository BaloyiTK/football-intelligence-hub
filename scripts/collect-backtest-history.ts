import fs from "node:fs/promises";import path from "node:path";
const key=process.env.RAPIDAPI_KEY;if(!key)throw new Error("RAPIDAPI_KEY missing");
const host="livescore6.p.rapidapi.com",endpoint="https://"+host+"/matches/v2/list-by-date";
const months=["2026-03","2026-04","2026-05","2026-06","2026-07","2026-08","2026-09"];
for(const month of months){const [Y,M]=month.split("-").map(Number),last=new Date(Date.UTC(Y,M,0)).getUTCDate(),matches=[];
 for(let d=1;d<=last;d++){const date=month+"-"+String(d).padStart(2,"0"),u=new URL(endpoint);u.searchParams.set("Category","soccer");u.searchParams.set("Date",date.replace(/-/g,""));u.searchParams.set("Timezone","2");
  const r=await fetch(u,{headers:{"X-RapidAPI-Key":key,"X-RapidAPI-Host":host}});if(!r.ok)throw new Error(date+" LiveScore HTTP "+r.status);const p=await r.json();
  for(const s of (p?.Stages||[]))for(const e of (s?.Events||[])){const h=e?.T1?.[0],a=e?.T2?.[0],hg=Number(e.Tr1),ag=Number(e.Tr2);if(!h||!a||!Number.isFinite(hg)||!Number.isFinite(ag))continue;matches.push({date,fixtureId:String(e.Eid||""),competition:s.Cnm||s.CompN||"",stage:s.Snm||"",country:s.CompCnmt||s.CompD||"",kickoff:String(e.Esd||""),homeId:String(h.ID||""),home:h.Nm||"",awayId:String(a.ID||""),away:a.Nm||"",homeGoals:hg,awayGoals:ag,status:e.Eps||""});}
  await new Promise(r=>setTimeout(r,100));
 }
 const out={schema:"fih-backtest-history-v1",month,timezone:"Africa/Johannesburg",fetchedAt:new Date().toISOString(),matchCount:matches.length,matches};await fs.mkdir("data/backtest/history",{recursive:true});await fs.writeFile(path.join("data/backtest/history",month+".json"),JSON.stringify(out)+"\n");console.log(month,matches.length);
}