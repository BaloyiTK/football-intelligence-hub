import fs from "node:fs";
import path from "node:path";

type Source={id:string;baseUrl:string;capabilities:string[];priority:number};
const root=process.cwd();
const cfg=JSON.parse(fs.readFileSync(path.join(root,"config/public-research-sources.json"),"utf8"));
const sources=(cfg.sources as Source[]).sort((a,b)=>a.priority-b.priority);

export function publicSources(){return sources;}

export async function fetchPublicPage(url:string){
 const source=sources.find(s=>url.startsWith(s.baseUrl));
 if(!source) throw new Error("PUBLIC_SOURCE_NOT_ALLOWLISTED");
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const r=await fetch(url,{signal:controller.signal,headers:{"user-agent":"FootballIntelligenceHub/1.0 research; public-page evidence"}});
  if(!r.ok) throw new Error(`PUBLIC_SOURCE_HTTP_${r.status}`);
  const type=r.headers.get("content-type")||"";
  if(!type.includes("text/html")&&!type.includes("application/xhtml+xml")) throw new Error("PUBLIC_SOURCE_NON_HTML");
  const text=await r.text();
  return {source:source.id,url,status:r.status,retrievedAt:new Date().toISOString(),html:text};
 } finally {clearTimeout(timer);}
}

export function unavailable(reason:string){return {status:"UNAVAILABLE",reason};}
