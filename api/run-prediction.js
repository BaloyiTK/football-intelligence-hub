import {requireFihGitHubOidc} from "./_fih-auth.js";
const OWNER=process.env.FIH_GITHUB_OWNER||process.env.VERCEL_GIT_REPO_OWNER,REPO=process.env.FIH_GITHUB_REPO||process.env.VERCEL_GIT_REPO_SLUG;
function sastDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
export default async function handler(req,res){
 if(!await requireFihGitHubOidc(req,res))return;
 if(!["GET","POST"].includes(req.method)) return res.status(405).json({error:"GET or POST required"});
 const today=sastDate(),date=String(req.query.date||req.body?.date||"").trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+"T00:00:00Z"))) return res.status(400).json({error:"date must be valid YYYY-MM-DD",today});
 if(date<today) return res.status(400).json({error:"historical dates require BACKTEST",date,today});
 if(!OWNER||!REPO)return res.status(500).json({error:"GitHub repository identity missing"});
 const token=process.env.FIH_GITHUB_TOKEN;
 if(!token) return res.status(500).json({error:"FIH_GITHUB_TOKEN missing"});
 const r=await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/dispatches`,{method:"POST",headers:{"Authorization":"Bearer "+token,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"},body:JSON.stringify({event_type:"fih_prediction",client_payload:{date}})});
 if(!r.ok) return res.status(502).json({error:"GitHub repository dispatch failed",status:r.status,detail:await r.text()});
 return res.status(202).json({ok:true,dispatched:true,date,eventType:"fih_prediction"});
}
