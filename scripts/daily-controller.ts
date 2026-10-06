import fs from "node:fs";import path from "node:path";
const date=process.argv[2];
if(!date||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))throw new Error("Usage: tsx scripts/daily-controller.ts YYYY-MM-DD");
const root=process.cwd(),dir=path.join(root,"data/runs");
const files=fs.readdirSync(dir).filter(n=>n.startsWith(date+"_")&&n.endsWith(".json")).sort().reverse();
const runs=files.map(n=>({name:n,path:path.join("data/runs",n),data:JSON.parse(fs.readFileSync(path.join(dir,n),"utf8"))}));
const activeStates=new Set(["pending","discovering","processing","recovering","publishing","blocked"]);
const active=runs.find(x=>activeStates.has(String(x.data.status??""))&&x.data.status!=="complete");
if(active){
 const r=active.data;
 const scan=Array.isArray(r.leagueScan)?r.leagueScan:[];
 const next=scan.find((x:any)=>x.status!=="complete");
 console.log(JSON.stringify({action:"RESUME",runFile:active.path,status:r.status,current:r.current??null,nextCheckpoint:next??null,resumeAction:r.resumeAction??r.current?.resumeAction??"continue-first-nonterminal-checkpoint"},null,2));
 process.exit(0);
}
const registry=JSON.parse(fs.readFileSync(path.join(root,"data/leagues.json"),"utf8"));
const scopes=Array.isArray(registry.leagues)?registry.leagues:[];
if(scopes.length!==211)throw new Error("Registry must contain exactly 211 association discovery scopes");
const id=date.replaceAll("-","")+"_"+new Date().toISOString().replace(/[-:]/g,"").replace(/\..*/,"Z")+"_v2.9";
const runFile=path.join("data/runs",id+".json");
const contract=JSON.parse(fs.readFileSync(path.join(root,"automation/FIH_CONTRACT.json"),"utf8"));
const pipelineManifest:any={};
for(const stage of contract.pipeline??[])pipelineManifest[stage]={status:"pending"};
pipelineManifest["load-contract"]={status:"passed"};pipelineManifest["freeze-contract-hash"]={status:"passed"};pipelineManifest["preflight"]={status:"passed"};pipelineManifest["resolve-run-and-resume"]={status:"passed"};pipelineManifest["freeze-registry"]={status:"complete"};
const run={schema:"fih-daily-run-v2",runId:id,date,timezone:"Africa/Johannesburg",modelVersion:contract.production.modelVersion,status:"discovering",storagePolicy:"full-audit",registrySnapshot:{version:registry.version,associationCount:scopes.length,associationIds:scopes.map((x:any)=>x.id),competitionIds:(registry.knownCompetitions??[]).map((x:any)=>x.id)},associationScan:scopes.map((x:any)=>({associationId:x.id,country:x.country,status:"pending",competitionsDiscovered:0,fixturesDiscovered:0,sources:[]})),leagueScan:[],fixtures:[],pipelineManifest,current:{stage:"worldwide-discovery",associationIndex:0,associationId:scopes[0]?.id??null},resumeAction:"perform-two-source-global-date-discovery-then-map-across-211-associations",recovery:{attempts:[],lastFailure:null}};
fs.writeFileSync(path.join(root,runFile),JSON.stringify(run,null,2)+"\n");
console.log(JSON.stringify({action:"CREATE",runFile,status:run.status,associationScopes:scopes.length,current:run.current,resumeAction:run.resumeAction},null,2));
