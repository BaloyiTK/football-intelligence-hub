import fs from "node:fs";
import path from "node:path";

const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const root=process.cwd();
const queuePath=path.join(root,`data/research-queue/${DATE}.json`);
const inboxPath=path.join(root,`data/research-inbox/${DATE}.json`);
const outDir=path.join(root,`data/research/${DATE}`);

type Result={fixtureId:string;sourceUrls?:string[];sourceMetadata?:unknown[];categoriesAttempted?:string[];evidence?:Record<string,unknown>;evidenceStatus?:string;requiredModelMatchSeries?:string;verifiedInputs?:unknown;integrity?:string;researchedAt?:string;searchQuery?:string};
if(!fs.existsSync(queuePath)) throw new Error(`Research queue missing: ${queuePath}`);
const queue=JSON.parse(fs.readFileSync(queuePath,"utf8"));
if(queue.schema!=="fih-research-queue-v1"||queue.date!==DATE||!Array.isArray(queue.fixtures)) throw new Error("Invalid research queue");
if(!fs.existsSync(inboxPath)){
 console.log(`RESEARCH_PROVIDER_REQUIRED ${inboxPath}`);
 console.log("Provider must return fih-research-inbox-v1 with one result per researched fixture. Missing evidence must be UNAVAILABLE; never fabricate.");
 process.exit(2);
}
const inbox=JSON.parse(fs.readFileSync(inboxPath,"utf8"));
if(inbox.schema!=="fih-research-inbox-v1"||inbox.date!==DATE||!Array.isArray(inbox.results)) throw new Error("Invalid research inbox");
const byId=new Map(queue.fixtures.map((f:any)=>[String(f.fixtureId),f]));
fs.mkdirSync(outDir,{recursive:true});
let written=0,rejected=0;
for(const r of inbox.results as Result[]){
 const q:any=byId.get(String(r.fixtureId));
 if(!q){console.error(`REJECT unknown fixture ${r.fixtureId}`);rejected++;continue;}
 const urls=Array.isArray(r.sourceUrls)?r.sourceUrls.filter(x=>typeof x==="string"&&/^https?:\/\//.test(x)):[];
 if(!r.evidenceStatus||!r.integrity){console.error(`REJECT incomplete result ${r.fixtureId}`);rejected++;continue;}
 const artifact={schema:"fih-research-v1",date:DATE,fixtureId:String(r.fixtureId),fixture:{home:q.home,away:q.away,competition:q.competition,kickoff:q.kickoff},researchedAt:r.researchedAt||new Date().toISOString(),searchQuery:r.searchQuery||q.query,sourceUrls:urls,sourceMetadata:Array.isArray(r.sourceMetadata)?r.sourceMetadata:[],categoriesAttempted:Array.isArray(r.categoriesAttempted)?r.categoriesAttempted:[],evidence:r.evidence??{},evidenceStatus:r.evidenceStatus,requiredModelMatchSeries:r.requiredModelMatchSeries||"UNAVAILABLE",verifiedInputs:r.verifiedInputs??{},integrity:r.integrity};
 fs.writeFileSync(path.join(outDir,`${r.fixtureId}.json`),JSON.stringify(artifact,null,2)+"\n");
 written++;
}
console.log(JSON.stringify({date:DATE,queued:queue.fixtures.length,received:inbox.results.length,written,rejected},null,2));
if(rejected) process.exitCode=2;
