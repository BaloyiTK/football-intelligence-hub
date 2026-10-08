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
async function main(){
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
 const attemptedAt=new Date().toISOString();
 const attempt=(category:string,outcome:string)=>[{query:`${f.home} ${f.away} ${DATE} ${category}`,attemptedAt,outcome}];
 const unavailable=(category:string,reason:string)=>({status:"UNAVAILABLE",reason,attempts:attempt(category,"NO_DIRECT_SOURCE_EVIDENCE")});
 const categories={
  overallForm:{status:enough?"VERIFIED":(sourceUrls.length?"PARTIAL":"UNAVAILABLE"),homeMatches:home,awayMatches:away,sourceRefs:sourceUrls.map((_,idx)=>idx),attempts:attempt("overall form",enough?"SOURCE_EVIDENCE_FOUND":(sourceUrls.length?"INSUFFICIENT_SOURCE_EVIDENCE":"NO_SOURCE_EVIDENCE"))},
  venueForm:unavailable("venue form","Direct extractor did not execute a category-specific search."),
  xgXga:unavailable("xG xGA","Direct extractor did not execute a category-specific search."),
  leaguePosition:unavailable("standings PPG goal difference","Direct extractor did not execute a category-specific search."),
  teamQuality:unavailable("team quality","Direct extractor did not execute a category-specific search."),
  motivationContext:unavailable("motivation context","Direct extractor did not execute a category-specific search."),
  h2h:unavailable("H2H","Direct extractor did not execute a category-specific search."),
  goalsProfile:unavailable("goals profile BTTS over 2.5","Direct extractor did not execute a category-specific search."),
  squadAvailability:unavailable("squad availability injuries suspensions","Direct extractor did not execute a category-specific search."),
  opponentStrength:unavailable("opponent strength","Direct extractor did not execute a category-specific search."),
  restSchedule:unavailable("rest schedule","Direct extractor did not execute a category-specific search.")
 };
 results.push({fixtureId:String(f.fixtureId),researchedAt:new Date().toISOString(),searchQuery:f.query,sourceUrls:[...new Set(sourceUrls)],sourceMetadata:[...new Set(sourceUrls)].map(url=>({url,retrievedAt:new Date().toISOString(),supports:["overallForm"]})),evidenceStatus:enough?"VERIFIED_MINIMUM_MODEL_INPUT":"PARTIAL",requiredModelMatchSeries:enough?"VERIFIED":"UNAVAILABLE",categoriesAttempted:Object.keys(categories),evidence:categories,verifiedInputs:{overallMatchSeries:{home,away}},integrity:enough?"Direct extractor verified only supported overall-form evidence; unsearched Build Step 2 categories are explicitly non-canonical.":"Direct extractor did not complete Build Step 2; unsearched categories remain explicitly non-canonical and minimum reproducible score series was not reached.",failures});
}
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify({schema:"fih-research-inbox-v1",date:DATE,generatedAt:new Date().toISOString(),results},null,2)+"\n");
console.log(JSON.stringify({date:DATE,fixtures:results.length,verified:results.filter(r=>r.requiredModelMatchSeries==="VERIFIED").length,partial:results.filter(r=>r.requiredModelMatchSeries!=="VERIFIED").length,outPath},null,2));
}
main().catch((e)=>{console.error(e);process.exit(1)});
