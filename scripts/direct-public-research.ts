import fs from "node:fs";
import path from "node:path";
import {publicSources,fetchPublicPage} from "./public-research-adapter";
import {stripHtml,explicitScores,teamSeries} from "./public-research-extract";

const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const root=process.cwd(),queuePath=path.join(root,`data/research-queue/${DATE}.json`),outPath=path.join(root,`data/research-inbox/${DATE}.json`);
if(!fs.existsSync(queuePath))throw new Error("RESEARCH_QUEUE_MISSING");
const queue=JSON.parse(fs.readFileSync(queuePath,"utf8"));
const results:any[]=[];
for(const f of queue.fixtures){
 const sourceUrls:string[]=[]; const rows:any[]=[]; const failures:any[]=[];
 for(const s of publicSources()){
  const candidates=[
   `${s.baseUrl}search/?q=${encodeURIComponent(f.home+" "+f.away)}`,
   `${s.baseUrl}search?q=${encodeURIComponent(f.home+" "+f.away)}`
  ];
  let ok=false;
  for(const url of candidates){try{const p=await fetchPublicPage(url);const text=stripHtml(p.html);const found=explicitScores(text,p.url);if(found.length){rows.push(...found);sourceUrls.push(p.url);ok=true;break;}}catch(e:any){failures.push({source:s.id,url,error:String(e?.message||e)});}}
  if(ok&&rows.length>=10)break;
 }
 const home=teamSeries(f.home,rows,5),away=teamSeries(f.away,rows,5);
 const enough=home.length>=3&&away.length>=3;
 results.push({fixtureId:String(f.fixtureId),researchedAt:new Date().toISOString(),searchQuery:f.query,sourceUrls:[...new Set(sourceUrls)],evidenceStatus:enough?"VERIFIED_MINIMUM_MODEL_INPUT":"PARTIAL",requiredModelMatchSeries:enough?"VERIFIED":"UNAVAILABLE",verifiedInputs:{overallMatchSeries:{home,away}},integrity:enough?"Direct public-page score evidence extracted; source URLs retained.":"Direct public sources attempted; minimum reproducible score series unavailable.",failures});
}
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify({schema:"fih-research-inbox-v1",date:DATE,generatedAt:new Date().toISOString(),results},null,2)+"\n");
console.log(JSON.stringify({date:DATE,fixtures:results.length,verified:results.filter(r=>r.requiredModelMatchSeries==="VERIFIED").length,partial:results.filter(r=>r.requiredModelMatchSeries!=="VERIFIED").length,outPath},null,2));
