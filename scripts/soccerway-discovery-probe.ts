import fs from "node:fs";
import path from "node:path";

const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const ROOT=process.cwd();
const board=JSON.parse(fs.readFileSync(path.join(ROOT,"data/prediction-fixtures",DATE+".json"),"utf8"));
const queue=JSON.parse(fs.readFileSync(path.join(ROOT,"data/research-queue",DATE+".json"),"utf8"));
const normalize=(s:string)=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/\b(fc|cf|afc|sc|club|calcio|fk|ac|cd|ud|deportivo)\b/g," ").replace(/[^a-z0-9]+/g," ").trim();
function similarity(a:string,b:string){const A=new Set(normalize(a).split(" ").filter(Boolean)),B=new Set(normalize(b).split(" ").filter(Boolean));if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return 2*hit/(A.size+B.size)}
const strip=(s:string)=>s.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&#39;/g,"'").replace(/\s+/g," ").trim();
const hrefRe=/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
function links(base:string,html:string){const out:any[]=[];let m;while((m=hrefRe.exec(html))){try{const url=new URL(m[1],base).toString();const label=strip(m[2]);if(label)out.push({url,label})}catch{}}return out}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function get(url:string){const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);try{const r=await fetch(url,{signal:c.signal,redirect:"follow",headers:{"user-agent":"Mozilla/5.0 (compatible; FootballIntelligenceHub/0.1)","accept":"text/html"}});const html=await r.text();return {url:r.url,status:r.status,ok:r.ok,html,links:links(r.url,html),text:strip(html)}}finally{clearTimeout(timer)}}
const meta=new Map<string,any>();
for(const s of board.payload?.Stages||[])for(const e of s.Events||[])meta.set(String(e.Eid??e.Id),{
 country:String(s.Cnm||s.Csnm||s.CompD||""),countrySlug:String(s.Ccd||""),competition:String(s.CompN||s.Snm||""),competitionSlug:String(s.CompUrlName||s.Scd||""),
 home:String(e.T1?.[0]?.Nm||""),away:String(e.T2?.[0]?.Nm||"")
});
const wanted=["1825659"].map(id=>queue.fixtures.find((f:any)=>String(f.fixtureId)===id)).filter(Boolean);
const world=await get("https://www.soccerway.com/world/");
console.log(JSON.stringify({world:{status:world.status,links:world.links.length}},null,2));
for(const f of wanted){
 const m=meta.get(String(f.fixtureId))||{};
 const countries=world.links.map((x:any)=>({...x,score:similarity(m.country,x.label)})).filter((x:any)=>x.score>=.72&&new URL(x.url).hostname.endsWith("soccerway.com")).sort((a:any,b:any)=>b.score-a.score);
 const country=countries[0];
 const row:any={fixtureId:String(f.fixtureId),home:f.home,away:f.away,competition:f.competition,meta:m,countryCandidate:country?{url:country.url,label:country.label,score:country.score}:null};
 if(!country){console.log(JSON.stringify(row,null,2));continue}
 await sleep(6500);
 const cp=await get(country.url);
 const countryPath=new URL(country.url).pathname;
 const comps=cp.links.map((x:any)=>({...x,score:Math.max(similarity(f.competition,x.label),similarity(m.competition,x.label))}))
  .filter((x:any)=>x.score>=.6&&new URL(x.url).hostname.endsWith("soccerway.com")&&new URL(x.url).pathname.startsWith(countryPath)&&new URL(x.url).pathname!==countryPath)
  .sort((a:any,b:any)=>b.score-a.score);
 const comp=comps[0];
 row.countryPage={status:cp.status,links:cp.links.length};
 row.competitionCandidate=comp?{url:comp.url,label:comp.label,score:comp.score}:null;
 if(!comp){console.log(JSON.stringify(row,null,2));continue}
 await sleep(6500);
 const lp=await get(comp.url);
 const teamHits=lp.links.filter((x:any)=>similarity(f.home,x.label)>=.55||similarity(f.away,x.label)>=.55).slice(0,30);
 const pairHits=lp.links.filter((x:any)=>similarity(f.home,x.label)>=.45&&similarity(f.away,x.label)>=.45).slice(0,20);
 const routeLinks=lp.links.filter((x:any)=>/\/(results|fixtures|standings)\/?(?:$|\?)/i.test(new URL(x.url).pathname)).slice(0,20);
 row.competitionPage={status:lp.status,links:lp.links.length,teamHits:teamHits.slice(0,12),pairHits:pairHits.slice(0,8),routeLinks,textSample:lp.text.slice(0,800)};
 const resultLink=routeLinks.find((x:any)=>/\/results\/?(?:$|\?)/i.test(new URL(x.url).pathname));
 const standingsLink=routeLinks.find((x:any)=>/\/standings\/?(?:$|\?)/i.test(new URL(x.url).pathname));
 if(resultLink){
  await sleep(6500);
  const rp=await get(resultLink.url);
  const targetMatches=rp.links.filter((x:any)=>/\/match\//.test(new URL(x.url).pathname)&&(similarity(f.home,x.label)>=.45||similarity(f.away,x.label)>=.45)).slice(0,20);
  row.resultsPage={status:rp.status,links:rp.links.length,targetMatches,textAroundHome:(()=>{const i=normalize(rp.text).indexOf(normalize(f.home));return i>=0?rp.text.slice(Math.max(0,i-300),i+1200):rp.text.slice(0,1000)})()};
  const pair=targetMatches.map((x:any)=>({...x,pairScore:similarity(f.home,x.label)+similarity(f.away,x.label)})).sort((a:any,b:any)=>b.pairScore-a.pairScore)[0];
  if(pair){
   await sleep(6500);
   const mp=await get(pair.url);
   const scriptTags=[...mp.html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)].map((m:any)=>({attrs:m[1].slice(0,300),body:m[2].slice(0,500)}));
   const indicators:any={};
   for(const needle of ["__NEXT_DATA__","headToHead","head_to_head","h2h","standings","events","initialState","__NUXT__","application/ld+json"]){
    const i=mp.html.toLowerCase().indexOf(needle.toLowerCase());if(i>=0)indicators[needle]=mp.html.slice(Math.max(0,i-300),i+900);
   }
   row.matchPage={url:pair.url,status:mp.status,bytes:Buffer.byteLength(mp.html),links:mp.links.length,teamLinks:mp.links.filter((x:any)=>/\/team\//.test(new URL(x.url).pathname)).slice(0,20),textSample:mp.text.slice(0,1800),scriptTags:scriptTags.slice(0,20),indicators};
  }
 }
 if(standingsLink){
  await sleep(6500);
  const sp=await get(standingsLink.url);
  const i=Math.max(normalize(sp.text).indexOf(normalize(f.home)),normalize(sp.text).indexOf(normalize(f.away)));
  row.standingsPage={status:sp.status,links:sp.links.length,textAroundTeams:i>=0?sp.text.slice(Math.max(0,i-500),i+1800):sp.text.slice(0,1500),teamLinks:sp.links.filter((x:any)=>/\/team\//.test(new URL(x.url).pathname)&&(similarity(f.home,x.label)>=.45||similarity(f.away,x.label)>=.45)).slice(0,20)};
 }
 console.log(JSON.stringify(row,null,2));
}
