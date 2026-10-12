import fs from "node:fs";
import path from "node:path";

const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const roots=[
  "https://www.soccerway.com/sitemap_index.xml",
  "https://int.soccerway.com/sitemap_index.xml",
  "https://www.soccerway.com/sitemap.xml"
];
async function fetchText(url:string){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);
 try{
  const r=await fetch(url,{signal:c.signal,redirect:"follow",headers:{"accept":"application/xml,text/xml,text/html,*/*;q=0.8","user-agent":"Mozilla/5.0 (compatible; FootballIntelligenceHub/0.1)"}});
  return {url:r.url,status:r.status,ok:r.ok,type:r.headers.get("content-type")||"",text:await r.text()};
 }catch(e:any){return {url,status:null,ok:false,type:"",text:"",error:String(e?.message||e)}}
 finally{clearTimeout(timer)}
}
const locs=(s:string)=>[...s.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m=>m[1].replace(/&amp;/g,"&"));
const results:any[]=[];
for(const url of roots){
 const r=await fetchText(url);
 const all=locs(r.text);
 const likely=all.filter(x=>/team|club|soccer|competition|tournament|league/i.test(x)).slice(0,50);
 results.push({url,status:r.status,ok:r.ok,type:r.type,bytes:Buffer.byteLength(r.text),locCount:all.length,likely:likely.slice(0,20),first:all.slice(0,20),error:(r as any).error||null});
}
const follow:any[]=[];
for(const root of results){
 for(const url of [...root.likely,...root.first].slice(0,6)){
  const r=await fetchText(url);
  const all=locs(r.text);
  follow.push({url,status:r.status,ok:r.ok,type:r.type,bytes:Buffer.byteLength(r.text),locCount:all.length,teamUrls:all.filter(x=>/\/teams?\//i.test(x)).slice(0,15),first:all.slice(0,10)});
 }
}
const out={schema:"fih-soccerway-source-probe-v1",date:DATE,generatedAt:new Date().toISOString(),roots:results,follow};
const p=path.join("data","research-probe",DATE+"-soccerway.json");
fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({roots:results.map(x=>({url:x.url,status:x.status,ok:x.ok,type:x.type,bytes:x.bytes,locCount:x.locCount,likely:x.likely.slice(0,5)})),follow:follow.map(x=>({url:x.url,status:x.status,ok:x.ok,type:x.type,bytes:x.bytes,locCount:x.locCount,teamUrls:x.teamUrls.slice(0,5)}))},null,2));
