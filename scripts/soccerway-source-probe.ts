import fs from "node:fs";
import path from "node:path";

const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const root=process.cwd();
const queue=JSON.parse(fs.readFileSync(path.join(root,"data/research-queue",DATE+".json"),"utf8"));
const roots=[
  "https://www.soccerway.com/sitemap.xml"
];
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function fetchText(url:string){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),20000);
 try{
  const r=await fetch(url,{signal:c.signal,redirect:"follow",headers:{"accept":"application/xml,text/xml,text/html,*/*;q=0.8","user-agent":"Mozilla/5.0 (compatible; FootballIntelligenceHub/0.1)"}});
  return {url:r.url,status:r.status,ok:r.ok,type:r.headers.get("content-type")||"",text:await r.text(),retrievedAt:new Date().toISOString()};
 }catch(e:any){return {url,status:null,ok:false,type:"",text:"",retrievedAt:new Date().toISOString(),error:String(e?.message||e)}}
 finally{clearTimeout(timer)}
}
const locs=(s:string)=>[...s.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m=>m[1].replace(/&amp;/g,"&"));
const normalize=(s:string)=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/\b(fc|cf|afc|sc|club|calcio|fk|ac|cd|ud|deportivo|hapoel|hapeol)\b/g,m=>m.startsWith("hap")?"hapoel":" ").replace(/[^a-z0-9]+/g," ").trim();
function similarity(a:string,b:string){
 const A=new Set(normalize(a).split(" ").filter(Boolean)),B=new Set(normalize(b).split(" ").filter(Boolean));
 if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return 2*hit/(A.size+B.size);
}
function slugName(raw:string){return decodeURIComponent(raw).replace(/-[A-Za-z0-9]{8}$/,"").replace(/-/g," ")}
function parseMatchUrl(url:string){
 try{
  const u=new URL(url),m=u.pathname.match(/^\/match\/([^/]+)\/([^/]+)\/?$/i);
  if(!m)return null;
  return {url,first:slugName(m[1]),second:slugName(m[2])};
 }catch{return null}
}
function bestMatch(f:any,rows:any[]){
 let best:any=null,bestScore=0,reversed=false;
 for(const r of rows){
  const direct=(similarity(f.home,r.first)+similarity(f.away,r.second))/2;
  const rev=(similarity(f.home,r.second)+similarity(f.away,r.first))/2;
  const score=Math.max(direct,rev);
  if(score>=.58&&score>bestScore){best=r;bestScore=score;reversed=rev>direct;}
 }
 return best?{...best,score:Number(bestScore.toFixed(3)),reversed}:null;
}
function inspectHtml(html:string){
 const hrefs=[...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]);
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
 const interestingStrings=[...new Set([
  ...hrefs.filter(h=>/team|standings|results|fixtures|h2h|competition|league/i.test(h)),
  ...scripts.flatMap(s=>[...s.matchAll(/https?:\\?\/\\?\/[^\"'<> ]+/g)].map(m=>m[0].replace(/\\\//g,"/"))).filter(h=>/soccer|team|match|league|tournament/i.test(h))
 ])].slice(0,40);
 const jsonLd=[...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1].slice(0,1500));
 return {
  bytes:Buffer.byteLength(html),
  title:html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g," ").trim()||"",
  scriptCount:scripts.length,
  jsonLdCount:jsonLd.length,
  jsonLd,
  hasNextData:/__NEXT_DATA__/.test(html),
  hasNuxt:/__NUXT__/.test(html),
  hasInitialState:/INITIAL_STATE|preloadedState|__INITIAL/i.test(html),
  teamHrefCount:hrefs.filter(h=>/team/i.test(h)).length,
  interestingStrings
 };
}
async function main(){
 const rootSitemap=await fetchText(roots[0]);
 const children=locs(rootSitemap.text);
 const matchMap=children.find(x=>/match-detail-1\.xml/i.test(x))||"https://www.soccerway.com/sitemap/match-detail-1.xml";
 const sitemap=await fetchText(matchMap);
 const matchRows=locs(sitemap.text).map(parseMatchUrl).filter(Boolean) as any[];
 const matches=queue.fixtures.map((f:any)=>({fixtureId:String(f.fixtureId),home:f.home,away:f.away,competition:f.competition,match:bestMatch(f,matchRows)}));
 const matched=matches.filter((x:any)=>x.match);
 const samples:any[]=[];
 for(const x of matched.slice(0,4)){
  await sleep(6500);
  const p=await fetchText(x.match.url);
  samples.push({fixtureId:x.fixtureId,home:x.home,away:x.away,url:x.match.url,status:p.status,ok:p.ok,type:p.type,retrievedAt:p.retrievedAt,inspection:inspectHtml(p.text)});
 }
 const summary={
  queueCount:queue.fixtures.length,
  sitemapStatus:sitemap.status,
  sitemapBytes:Buffer.byteLength(sitemap.text),
  sitemapMatchCount:matchRows.length,
  matchedPairs:matched.length,
  reversedPairs:matched.filter((x:any)=>x.match.reversed).length,
  unmatched:matches.filter((x:any)=>!x.match).length
 };
 const out={schema:"fih-soccerway-source-probe-v2",date:DATE,generatedAt:new Date().toISOString(),nonCanonical:true,summary,matches,samples};
 const p=path.join(root,"data/research-probe",DATE+"-soccerway.json");
 fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(out,null,2)+"\n");
 console.log(JSON.stringify({summary,sample:matched.slice(0,12),pageSamples:samples},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
