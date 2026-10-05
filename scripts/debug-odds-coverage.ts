import fs from "node:fs";
async function main(){
const F="data/backtests/2026-04-08_to_2026-10-04.json";
const j=JSON.parse(fs.readFileSync(F,"utf8"));
const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(x=>x&&!["fc","cf","sc","afc","fk","club","de","the","ac","cd","ca"].includes(x));
const score=(a:string,b:string)=>{const A=new Set(norm(a)),B=new Set(norm(b));if(!A.size||!B.size)return 0;let h=0;for(const x of A)if(B.has(x))h++;return h/Math.max(A.size,B.size)};
const day=(d:string,off:number)=>{const x=new Date(d+"T00:00:00Z");x.setUTCDate(x.getUTCDate()+off);return x.toISOString().slice(0,10)};
const xml=await fetch("https://football-predictions.ai/sitemap-en.xml").then(r=>r.text());
const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m=>m[1].replace(/&amp;/g,"&"));
const by=new Map<string,string[]>();for(const u of urls){const m=u.match(/(\d{4}-\d{2}-\d{2})(?:\/)?$/);if(m){const a=by.get(m[1])??[];a.push(u);by.set(m[1],a)}}
const urlTeams=(u:string)=>{const x=(u.split("/").filter(Boolean).pop()??"").replace(/-prediction-betting-tips-\d{4}-\d{2}-\d{2}$/,"").split("-vs-");return x.length===2?x:null};
let exact=0,pm1=0,good=0;const samples:any[]=[];
for(const f of j.fixtures){
 const dates=[f.date,day(f.date,-1),day(f.date,1)],cands=dates.flatMap(d=>by.get(d)??[]);
 if((by.get(f.date)??[]).length)exact++;if(cands.length)pm1++;
 let best:any=null;
 for(const u of cands){const p=urlTeams(u);if(!p)continue;const hs=score(f.homeTeam,p[0].replace(/-/g," ")),as=score(f.awayTeam,p[1].replace(/-/g," "));const s=(hs+as)/2;if(!best||s>best.s)best={u,hs,as,s}}
 if(best&&best.hs>=.35&&best.as>=.35)good++;
 if(samples.length<40&&(best?.s??0)>.2)samples.push({date:f.date,home:f.homeTeam,away:f.awayTeam,pick:f.recommendedBet.pick,best});
}
const dateKeys=[...by.keys()].sort();
console.log(JSON.stringify({sitemapUrls:urls.length,dated:dateKeys.length,minDate:dateKeys[0],maxDate:dateKeys.at(-1),fixtures:j.fixtures.length,hasExactDateCandidates:exact,hasPm1Candidates:pm1,goodPm1TeamMatches:good,samples},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
