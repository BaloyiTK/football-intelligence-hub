import fs from "node:fs";
import path from "node:path";
import {fihV2,Match} from "./fih-probability-v2";

const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const root=process.cwd(),researchDir=path.join(root,`data/research/${DATE}`),outDir=path.join(root,`data/model/${DATE}`);
fs.mkdirSync(outDir,{recursive:true});
if(!fs.existsSync(researchDir)){console.log("MODEL_RUNNER_NO_RESEARCH");process.exit(0);}
const files=fs.readdirSync(researchDir).filter(x=>x.endsWith(".json"));
let written=0,calculated=0,insufficient=0,rejected=0;
const rows=(x:any):Match[]=>Array.isArray(x)?x.filter((m:any)=>m&&typeof m.home==="string"&&typeof m.away==="string"&&Number.isFinite(Number(m.homeGoals))&&Number.isFinite(Number(m.awayGoals))).map((m:any)=>({home:m.home,away:m.away,homeGoals:Number(m.homeGoals),awayGoals:Number(m.awayGoals)})):[];
for(const file of files){
 const r=JSON.parse(fs.readFileSync(path.join(researchDir,file),"utf8"));
 if(r.schema!=="fih-research-v1"||r.date!==DATE||!r.fixtureId||!r.fixture?.home||!r.fixture?.away){rejected++;continue;}
 const overall=r.verifiedInputs?.overallMatchSeries||{};
 const homeRows=rows(overall.home),awayRows=rows(overall.away);
 const result:any=fihV2({home:{team:r.fixture.home,overall:homeRows},away:{team:r.fixture.away,overall:awayRows}});
 const artifact={schema:"fih-model-v1",date:DATE,fixtureId:String(r.fixtureId),fixture:r.fixture,modelVersion:result.version,status:result.status,generatedAt:new Date().toISOString(),researchEvidenceStatus:r.evidenceStatus,researchRequiredModelMatchSeries:r.requiredModelMatchSeries,inputCounts:{homeOverall:homeRows.length,awayOverall:awayRows.length},...result};
 const target=path.join(outDir,`${r.fixtureId}.json`);
 fs.writeFileSync(target,JSON.stringify(artifact,null,2)+"\n");
 const verify=JSON.parse(fs.readFileSync(target,"utf8"));
 if(verify.fixtureId!==String(r.fixtureId)||verify.date!==DATE||!["CALCULATED","INSUFFICIENT_DATA"].includes(verify.status))throw new Error(`MODEL_PERSIST_VERIFY_FAILED ${r.fixtureId}`);
 written++; if(verify.status==="CALCULATED")calculated++;else insufficient++;
}
console.log(JSON.stringify({date:DATE,researchFiles:files.length,written,calculated,insufficient,rejected},null,2));
if(rejected)process.exitCode=2;
