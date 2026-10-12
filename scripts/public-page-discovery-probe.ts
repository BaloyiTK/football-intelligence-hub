import fs from "node:fs";
import path from "node:path";

const tz="Africa/Johannesburg";
const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const LIMIT=Math.max(1,Math.min(50,Number(process.env.FIH_HYBRID_LIMIT||10)));
const root=process.cwd(),queue=JSON.parse(fs.readFileSync(path.join(root,"data/research-queue",DATE+".json"),"utf8"));
const preferred=["LaLiga","Serie A","Süper Lig","Primeira Liga","AFC Champions League Elite"];
const selected:any[]=[];
for(const competition of preferred)for(const f of queue.fixtures.filter((x:any)=>x.competition===competition).slice(0,2))if(selected.length<LIMIT&&!selected.some(x=>String(x.fixtureId)===String(f.fixtureId)))selected.push(f);
for(const f of queue.fixtures){if(selected.length>=LIMIT)break;if(!selected.some(x=>String(x.fixtureId)===String(f.fixtureId)))selected.push(f);}

const normalize=(s:string)=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/\b(fc|cf|afc|sc|club|calcio|fk|ac|cd|ud|deportivo)\b/g," ").replace(/[^a-z0-9]+/g," ").trim();
function similarity(a:string,b:string){const A=new Set(normalize(a).split(" ").filter(Boolean)),B=new Set(normalize(b).split(" ").filter(Boolean));if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return 2*hit/(A.size+B.size)}
const hrefRe=/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const strip=(s:string)=>s.replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();
function links(base:string,html:string){const out:any[]=[];let m;while((m=hrefRe.exec(html))){try{const url=new URL(m[1],base).toString(),label=strip(m[2]);if(label)out.push({url,label})}catch{}}return out}
async function fetchHtml(url:string){const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);try{const r=await fetch(url,{signal:c.signal,headers:{"user-agent":"Mozilla/5.0 (compatible; FootballIntelligenceHub/0.1)","accept":"text/html"}});const text=await r.text();return {url:r.url,status:r.status,ok:r.ok,text}}finally{clearTimeout(timer)}}
const sources=[{id:"soccerway",url:"https://www.soccerway.com/"},{id:"global-sports-archive",url:"https://globalsportsarchive.com/en/"}];
const pages:any[]=[];
for(const s of sources){try{const p=await fetchHtml(s.url);pages.push({...s,status:p.status,ok:p.ok,links:links(s.url,p.text)})}catch(e:any){pages.push({...s,status:null,ok:false,error:String(e?.message||e),links:[]})}}
const results=selected.map(f=>{
 const bySource:any={};
 let homeFound=false,awayFound=false,pairFound=false;
 for(const p of pages){
  const home=p.links.map((x:any)=>({...x,score:similarity(f.home,x.label)})).filter((x:any)=>x.score>=.55).sort((a:any,b:any)=>b.score-a.score).slice(0,5);
  const away=p.links.map((x:any)=>({...x,score:similarity(f.away,x.label)})).filter((x:any)=>x.score>=.55).sort((a:any,b:any)=>b.score-a.score).slice(0,5);
  const pair=p.links.map((x:any)=>({...x,homeScore:similarity(f.home,x.label),awayScore:similarity(f.away,x.label)})).filter((x:any)=>x.homeScore>=.45&&x.awayScore>=.45).sort((a:any,b:any)=>(b.homeScore+b.awayScore)-(a.homeScore+a.awayScore)).slice(0,5);
  homeFound ||= home.length>0; awayFound ||= away.length>0; pairFound ||= pair.length>0;
  bySource[p.id]={home,away,pair};
 }
 return {fixtureId:String(f.fixtureId),home:f.home,away:f.away,competition:f.competition,homeFound,awayFound,pairFound,bySource};
});
const summary={attempted:results.length,homeFound:results.filter(r=>r.homeFound).length,awayFound:results.filter(r=>r.awayFound).length,bothTeamsFound:results.filter(r=>r.homeFound&&r.awayFound).length,pairLinkFound:results.filter(r=>r.pairFound).length,sources:pages.map(p=>({id:p.id,status:p.status,ok:p.ok,linkCount:p.links.length}))};
const out={schema:"fih-public-page-discovery-probe-v1",date:DATE,generatedAt:new Date().toISOString(),nonCanonical:true,summary,results};
const outPath=path.join(root,"data/research-probe",DATE+"-discovery.json");fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({outPath,...summary},null,2));
