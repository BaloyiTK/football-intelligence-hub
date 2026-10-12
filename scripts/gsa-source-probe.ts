import fs from "node:fs";
import path from "node:path";

const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const root=process.cwd();
async function fetchText(url:string){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),20000);
 try{
  const r=await fetch(url,{signal:c.signal,redirect:"follow",headers:{"accept":"text/html,application/xml,text/xml,*/*;q=0.8","user-agent":"Mozilla/5.0 (compatible; FootballIntelligenceHub/0.1)"}});
  return {requested:url,url:r.url,status:r.status,ok:r.ok,type:r.headers.get("content-type")||"",text:await r.text(),retrievedAt:new Date().toISOString()};
 }catch(e:any){return {requested:url,url,status:null,ok:false,type:"",text:"",retrievedAt:new Date().toISOString(),error:String(e?.message||e)}}
 finally{clearTimeout(timer)}
}
const hrefs=(html:string)=>[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({href:m[1],label:m[2].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()}));
const forms=(html:string)=>[...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].map(m=>{
 const attrs=m[1],body=m[2],action=attrs.match(/action=["']([^"']+)["']/i)?.[1]||"",method=attrs.match(/method=["']([^"']+)["']/i)?.[1]||"GET";
 const inputs=[...body.matchAll(/<input\b([^>]*)>/gi)].map(x=>({name:x[1].match(/name=["']([^"']+)["']/i)?.[1]||"",type:x[1].match(/type=["']([^"']+)["']/i)?.[1]||"",placeholder:x[1].match(/placeholder=["']([^"']+)["']/i)?.[1]||""}));
 return {action,method,inputs};
});
const locs=(s:string)=>[...s.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m=>m[1].replace(/&amp;/g,"&"));
async function main(){
 const home=await fetchText("https://globalsportsarchive.com/");
 const robots=await fetchText("https://globalsportsarchive.com/robots.txt");
 const declared=[...robots.text.matchAll(/^\s*Sitemap:\s*(\S+)/gim)].map(m=>m[1]);
 const candidates=[...new Set([...declared,"https://globalsportsarchive.com/sitemap.xml","https://globalsportsarchive.com/sitemap_index.xml"])];
 const maps:any[]=[];
 for(const url of candidates){
  const r=await fetchText(url),all=locs(r.text);
  maps.push({url,status:r.status,ok:r.ok,type:r.type,bytes:Buffer.byteLength(r.text),locCount:all.length,first:all.slice(0,20),teamLike:all.filter(x=>/\/soccer\/team\//i.test(x)).slice(0,20)});
 }
 const allLinks=hrefs(home.text);
 const out={schema:"fih-gsa-source-probe-v1",date:DATE,generatedAt:new Date().toISOString(),nonCanonical:true,
  home:{status:home.status,ok:home.ok,type:home.type,bytes:Buffer.byteLength(home.text),forms:forms(home.text),searchLinks:allLinks.filter(x=>/search/i.test(x.href+" "+x.label)).slice(0,30),teamLinks:allLinks.filter(x=>/\/soccer\/team\//i.test(x.href)).slice(0,20)},
  robots:{status:robots.status,ok:robots.ok,type:robots.type,bytes:Buffer.byteLength(robots.text),declaredSitemaps:declared,firstLines:robots.text.split(/\r?\n/).slice(0,80)},
  maps};
 const p=path.join(root,"data/research-probe",DATE+"-gsa.json");fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(out,null,2)+"\n");
 console.log(JSON.stringify(out,null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
