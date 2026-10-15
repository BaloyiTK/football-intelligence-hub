import fs from "node:fs";
import path from "node:path";

const tz="Africa/Johannesburg";
const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const ymd=DATE.replaceAll("-","");
const targets=[
 {id:"espn-global-scoreboard",url:"https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates="+ymd},
 {id:"sofascore-public-json",url:"https://api.sofascore.com/api/v1/sport/football/scheduled-events/"+DATE},
 {id:"worldfootball",url:"https://www.worldfootball.net/"},
 {id:"soccerway",url:"https://www.soccerway.com/"},
 {id:"global-sports-archive",url:"https://globalsportsarchive.com/"},
 {id:"football-web-pages",url:"https://www.footballwebpages.co.uk/"}
];
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function probe(t:any){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);
 try{
  const r=await fetch(t.url,{signal:c.signal,redirect:"follow",headers:{"accept":"application/json,text/html;q=0.9,*/*;q=0.8","user-agent":"Mozilla/5.0 (compatible; FootballIntelligenceHub/0.1; +https://github.com/BaloyiTK/football-intelligence-hub)"}});
  const buf=await r.arrayBuffer();
  return {id:t.id,url:t.url,ok:r.ok,status:r.status,contentType:r.headers.get("content-type"),bytes:buf.byteLength,finalUrl:r.url};
 }catch(e:any){
  return {id:t.id,url:t.url,ok:false,status:null,error:String(e?.message||e)};
 }finally{clearTimeout(timer)}
}
const results:any[]=[];
for(const t of targets){results.push(await probe(t));await sleep(500)}
const out={schema:"fih-public-source-reachability-v1",date:DATE,generatedAt:new Date().toISOString(),runner:"GITHUB_ACTIONS",results};
const p=path.join(process.cwd(),"data/research-probe",DATE+"-reachability.json");
fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify(out,null,2));
