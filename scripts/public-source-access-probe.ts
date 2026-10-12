import fs from "node:fs";
import path from "node:path";

const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const targets=[
 {id:"worldfootball",url:"https://www.worldfootball.net/"},
 {id:"soccerway",url:"https://www.soccerway.com/"},
 {id:"global-sports-archive",url:"https://globalsportsarchive.com/"},
 {id:"football-web-pages",url:"https://www.footballwebpages.co.uk/"},
 {id:"espn-scoreboard",url:"https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates="+DATE.replaceAll("-","")},
 {id:"thesportsdb-demo",url:"https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=Arsenal"}
];
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function check(t:any){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const r=await fetch(t.url,{signal:controller.signal,redirect:"follow",headers:{"accept":"application/json,text/html;q=0.9,*/*;q=0.8","user-agent":"FootballIntelligenceHub/0.1 public-source-access-probe"}});
  const body=await r.text();
  return {id:t.id,url:t.url,status:r.status,ok:r.ok,contentType:r.headers.get("content-type"),bytes:Buffer.byteLength(body),sample:body.slice(0,160).replace(/\s+/g," ")};
 }catch(e:any){return {id:t.id,url:t.url,status:null,ok:false,error:String(e?.message||e)}}
 finally{clearTimeout(timer)}
}
const results:any[]=[];
for(const t of targets){results.push(await check(t));await sleep(300)}
const out={schema:"fih-public-source-access-probe-v1",date:DATE,generatedAt:new Date().toISOString(),nonCanonical:true,results};
const p=path.join("data","research-probe",DATE+"-sources.json");
fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({date:DATE,results:results.map(r=>({id:r.id,status:r.status,ok:r.ok,contentType:r.contentType,bytes:r.bytes,error:r.error}))},null,2));
