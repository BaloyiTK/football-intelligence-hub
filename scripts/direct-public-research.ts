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
 const toFact=(team:string,m:any)=>({date:m.date||"UNKNOWN",opponent:(m.home===team?m.away:m.home),venue:m.home===team?"HOME":"AWAY",goalsFor:m.home===team?m.homeGoals:m.awayGoals,goalsAgainst:m.home===team?m.awayGoals:m.homeGoals,sourceRef:m.sourceUrl});
 const homeOverall=teamSeries(f.home,rows,5).map((m:any)=>toFact(f.home,m));
 const awayOverall=teamSeries(f.away,rows,5).map((m:any)=>toFact(f.away,m));
 const homeLast5=teamSeries(f.home,rows.filter((m:any)=>m.home===f.home),5).map((m:any)=>toFact(f.home,m));
 const awayLast5=teamSeries(f.away,rows.filter((m:any)=>m.away===f.away),5).map((m:any)=>toFact(f.away,m));
 const enough=homeOverall.length>=5&&awayOverall.length>=5&&homeLast5.length>=5&&awayLast5.length>=5;
 const attemptedAt=new Date().toISOString();
 const sourceRefs=[...new Set([...homeOverall,...awayOverall,...homeLast5,...awayLast5].map((m:any)=>m.sourceRef))];
 const form={status:enough?"VERIFIED":(sourceRefs.length?"PARTIAL":"UNAVAILABLE"),data:{homeTeam:{overallLast5:homeOverall,homeLast5},awayTeam:{overallLast5:awayOverall,awayLast5}},sourceRefs,attempts:[{query:`${f.home} last 5 overall and home matches; ${f.away} last 5 overall and away matches`,attemptedAt,outcome:enough?"FACTUAL_FORM_VERIFIED":(sourceRefs.length?"INSUFFICIENT_FACTUAL_FORM":"NO_SOURCE_EVIDENCE")}]} ;
 const unavailable=(category:string)=>({status:"UNAVAILABLE",data:{homeTeam:[],awayTeam:[]},sourceRefs:[],attempts:[{query:`${f.home} ${f.away} ${category}`,attemptedAt,outcome:"NO_SOURCE_EVIDENCE"}]});
 const facts={form,squadAvailability:unavailable("confirmed injuries suspensions absences"),competitionContext:unavailable("competition stage standings context")};
 results.push({fixtureId:String(f.fixtureId),researchedAt:new Date().toISOString(),searchQuery:f.query,sourceUrls:[...new Set(sourceUrls)],sourceMetadata:[...new Set(sourceUrls)].map(url=>({url,retrievedAt:new Date().toISOString(),supports:["form"]})),evidenceStatus:enough?"VERIFIED_FACTUAL_FORM":"PARTIAL",requiredModelMatchSeries:enough?"VERIFIED":"UNAVAILABLE",categoriesAttempted:["form","squadAvailability","competitionContext"],facts,verifiedInputs:{},integrity:enough?"Verified factual match records only; analytical metrics are calculated downstream by FIH.":"Factual form research incomplete; no analytical values were fabricated.",failures});
}
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify({schema:"fih-research-inbox-v1",date:DATE,generatedAt:new Date().toISOString(),results},null,2)+"\n");
console.log(JSON.stringify({date:DATE,fixtures:results.length,verified:results.filter(r=>r.requiredModelMatchSeries==="VERIFIED").length,partial:results.filter(r=>r.requiredModelMatchSeries!=="VERIFIED").length,outPath},null,2));
}
main().catch((e)=>{console.error(e);process.exit(1)});
