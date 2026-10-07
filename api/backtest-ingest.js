const DATES=new Set(["2026-09-29","2026-09-30","2026-10-01","2026-10-02","2026-10-03","2026-10-04","2026-10-05","2026-10-07"]);
const OWNER="BaloyiTK",REPO="football-intelligence-hub",BRANCH="main";
async function github(path,init={}){const r=await fetch("https://api.github.com/repos/"+OWNER+"/"+REPO+"/contents/"+path,{...init,headers:{"Authorization":"Bearer "+process.env.FIH_GITHUB_TOKEN,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json",...(init.headers||{})}});return r}
export default async function handler(req,res){
 if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"GET or POST required"});
 const date=String(req.query.date||""); if(!DATES.has(date))return res.status(400).json({error:"date must be one of the configured 7-day backtest dates"});
 const key=process.env.ls_api_key,url=process.env.ls_api_url; if(!key||!url||!process.env.FIH_GITHUB_TOKEN)return res.status(500).json({error:"required production env vars missing"});
 const dp=date.replace(/-/g,""); const base=/^https?:\/\//i.test(url)?url:"https://"+url; const u=new URL(base); if(u.pathname==="/"||u.pathname==="")u.pathname="/matches/v2/list-by-date"; u.searchParams.set("Category","soccer");u.searchParams.set("Date",dp);u.searchParams.set("Timezone","2");
 const lr=await fetch(u,{headers:{"X-RapidAPI-Key":key,"X-RapidAPI-Host":u.hostname}}); if(!lr.ok)return res.status(502).json({error:"LiveScore HTTP "+lr.status});
 const payload=await lr.json(); const stages=Array.isArray(payload?.Stages)?payload.Stages:[],fixtureCount=stages.reduce((n,s)=>n+(Array.isArray(s?.Events)?s.Events.length:0),0); if(!fixtureCount)return res.status(502).json({error:"LiveScore returned no fixtures"});
 const isDaily=date===new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const snapshot={schema:isDaily?"fih-today-fixture-v1":"fih-backtest-fixture-v1",date,timezone:"Africa/Johannesburg",provider:"LiveScore via RapidAPI",fetchedAt:new Date().toISOString(),stageCount:stages.length,fixtureCount,payload};
 const path=isDaily?"data/today_fixture.json":"data/backtest/fixtures/"+date+".json"; const existing=await github(path+"?ref="+BRANCH); let sha; if(existing.ok)sha=(await existing.json()).sha;
 const body={message:"backtest: ingest LiveScore fixtures "+date,content:Buffer.from(JSON.stringify(snapshot,null,2)+"\n").toString("base64"),branch:BRANCH,...(sha?{sha}:{})};
 const wr=await github(path,{method:"PUT",body:JSON.stringify(body)}); if(!wr.ok)return res.status(502).json({error:"GitHub write failed",status:wr.status,detail:await wr.text()});
 const saved=await wr.json(); return res.status(200).json({ok:true,date,fixtureCount,path,commit:saved.commit?.sha});
}