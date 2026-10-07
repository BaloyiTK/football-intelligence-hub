import fs from "node:fs";
import path from "node:path";
import {fetchPublicPage} from "./public-research-adapter";
import {stripHtml,explicitScores,teamSeries} from "./public-research-extract";
import {discoverFixturePages} from "./public-source-discovery";

const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const root=process.cwd();
const queuePath=path.join(root,`data/research-queue/${DATE}.json`);
const outPath=path.join(root,`data/research-inbox/${DATE}.json`);
if(!fs.existsSync(queuePath)) throw new Error("RESEARCH_QUEUE_MISSING");
const queue=JSON.parse(fs.readFileSync(queuePath,"utf8"));
const results:any[]=[];
for(const f of queue.fixtures){
 const sourceUrls:string[]=[]; const rows:any[]=[]; const failures:any[]=[];
 const discovered=await discoverFixturePages(f.home,f.away);
 for(const d of discovered){
  try{
   const p=await fetchPublicPage(d.url);
   const found=explicitScores(stripHtml(p.html),p.url);
   if(found.length){rows.push(...found);sourceUrls.push(p.url);}
   if(rows.length>=10) break;
  }catch(e:any){failures.push({source:d.source,url:d.url,error:String(e?.message||e)});}
 }
 const home=teamSeries(f.home,rows,5),away=teamSeries(f.away,rows,5);
 const enough=home.length>=3&&away.length>=3;
 results.push({fixtureId:String(f.fixtureId),researchedAt:new Date().toISOString(),searchQuery:f.query,sourceUrls:[...new Set(sourceUrls)],evidenceStatus:enough?"VERIFIED_MINIMUM_MODEL_INPUT":"PARTIAL",requiredModelMatchSeries:enough?"VERIFIED":"UNAVAILABLE",verifiedInputs:{overallMatchSeries:{home,away}},integrity:enough?"Direct public-page score evidence extracted from same-site discovered pages; source URLs retained.":"Direct public source discovery attempted; minimum reproducible score series unavailable.",failures});
}
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify({schema:"fih-research-inbox-v1",date:DATE,generatedAt:new Date().toISOString(),results},null,2)+"\n");
console.log(JSON.stringify({date:DATE,fixtures:results.length,verified:results.filter(r=>r.requiredModelMatchSeries==="VERIFIED").length,partial:results.filter(r=>r.requiredModelMatchSeries!=="VERIFIED").length,outPath},null,2));
