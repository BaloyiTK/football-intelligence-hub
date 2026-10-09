import {requireFihGitHubOidc} from "./_fih-auth.js";
const OWNER=process.env.FIH_GITHUB_OWNER||process.env.VERCEL_GIT_REPO_OWNER;
const REPO=process.env.FIH_GITHUB_REPO||process.env.VERCEL_GIT_REPO_SLUG;
const BRANCH=process.env.FIH_GITHUB_BRANCH||"main";
async function gh(path,init={}){return fetch("https://api.github.com/repos/"+OWNER+"/"+REPO+"/contents/"+path,{...init,headers:{"Authorization":"Bearer "+process.env.FIH_GITHUB_TOKEN,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json",...(init.headers||{})}})}
const ymd=d=>d.toISOString().slice(0,10);
export default async function handler(req,res){
 if(!await requireFihGitHubOidc(req,res))return;
 if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"GET or POST required"});
 const month=String(req.query.month||""); if(!/^\\d{4}-(0[1-9]|1[0-2])$/.test(month))return res.status(400).json({error:"month must be YYYY-MM"});
 if(!OWNER||!REPO)return res.status(500).json({error:"GitHub repository identity missing"});
 const key=process.env.ls_api_key,raw=process.env.ls_api_url; if(!key||!raw||!process.env.FIH_GITHUB_TOKEN)return res.status(500).json({error:"required env missing"});
 const base=/^https?:\/\//i.test(raw)?raw:"https://"+raw; const root=new URL(base); if(root.pathname==="/"||root.pathname==="")root.pathname="/matches/v2/list-by-date";
 const [Y,M]=month.split("-").map(Number), last=new Date(Date.UTC(Y,M,0)).getUTCDate(); const dates=Array.from({length:last},(_,i)=>month+"-"+String(i+1).padStart(2,"0"));
 const results=await Promise.all(dates.map(async date=>{const u=new URL(root);u.searchParams.set("Category","soccer");u.searchParams.set("Date",date.replace(/-/g,""));u.searchParams.set("Timezone","2");const r=await fetch(u,{headers:{"X-RapidAPI-Key":key,"X-RapidAPI-Host":u.hostname}});if(!r.ok)return {date,error:"HTTP "+r.status,matches:[]};const p=await r.json();const matches=[];for(const s of (p?.Stages||[]))for(const e of (s?.Events||[])){const h=e?.T1?.[0],a=e?.T2?.[0];if(!h||!a)continue;const hg=Number(e.Tr1),ag=Number(e.Tr2);if(!Number.isFinite(hg)||!Number.isFinite(ag))continue;matches.push({date,fixtureId:String(e.Eid||""),competition:s.Cnm||s.CompN||"",stage:s.Snm||"",country:s.CompCnmt||s.CompD||"",kickoff:String(e.Esd||""),homeId:String(h.ID||""),home:h.Nm||"",awayId:String(a.ID||""),away:a.Nm||"",homeGoals:hg,awayGoals:ag,status:e.Eps||""})}return {date,matches}}));
 const errors=results.filter(x=>x.error).map(x=>({date:x.date,error:x.error})); if(errors.length)return res.status(502).json({error:"LiveScore history fetch incomplete",errors});
 const matches=results.flatMap(x=>x.matches); const snap={schema:"fih-backtest-history-v1",month,timezone:"Africa/Johannesburg",fetchedAt:new Date().toISOString(),matchCount:matches.length,matches};
 const path="data/backtest/history/"+month+".json";const ex=await gh(path+"?ref="+BRANCH);let sha;if(ex.ok)sha=(await ex.json()).sha;
 const body={message:"backtest: ingest pre-match history "+month,content:Buffer.from(JSON.stringify(snap)+"\n").toString("base64"),branch:BRANCH,...(sha?{sha}:{})};const wr=await gh(path,{method:"PUT",body:JSON.stringify(body)});if(!wr.ok)return res.status(502).json({error:"GitHub write failed",status:wr.status,detail:await wr.text()});const saved=await wr.json();return res.status(200).json({ok:true,month,matchCount:matches.length,path,commit:saved.commit?.sha});
}