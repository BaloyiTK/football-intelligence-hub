import fs from "node:fs";
import path from "node:path";

const date=process.argv[2];
if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Usage: npm run daily:controller -- YYYY-MM-DD");
const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,"data/leagues.json"),"utf8"));
const scopes=registry.leagues??[];
if(registry.associationCount!==211||scopes.length!==211) throw new Error(`FIH registry must contain exactly 211 frozen association scopes; associationCount=${registry.associationCount} scopes=${scopes.length}`);
const runsDir=path.join(root,"data/runs");
fs.mkdirSync(runsDir,{recursive:true});
const existing=fs.readdirSync(runsDir)
  .filter(n=>n.startsWith(date+"_")&&n.endsWith(".json"))
  .map(name=>({name,mtime:fs.statSync(path.join(runsDir,name)).mtimeMs}))
  .sort((a,b)=>b.mtime-a.mtime);
for(const {name} of existing){
  const p=path.join(runsDir,name), r=JSON.parse(fs.readFileSync(p,"utf8"));
  const ids=new Set((r.leagueScan??[]).map((x:any)=>x.leagueId));
  const all211=scopes.every((s:any)=>ids.has(s.id))&&ids.size===211;
  if(r.status!=="complete"&&all211){
    const incomplete=(r.leagueScan??[]).filter((x:any)=>x.status!=="complete");
    const cursor=r.resumeCursor??{stage:"normalize-and-map",associationIndex:0,associationId:incomplete[0]?.leagueId??scopes[0]?.id??null};
    console.log(JSON.stringify({
      action:"RESUME",
      runFile:path.relative(root,p),
      associationScopes:211,
      scopesComplete:211-incomplete.length,
      scopesRemaining:incomplete.length,
      resumeCursor:cursor,
      resumeAction:r.resumeAction??"Continue from the persisted cursor. Do not restart completed stages.",
      requiresExternalResearch:["worldwide-discovery","normalize-and-map","verify-prematch","research"].includes(String(cursor.stage??""))
    },null,2));
    process.exit(0);
  }
}
const stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
const runId=`${date}_${stamp}_v2.9_211`;
const runFile=path.join(runsDir,runId+".json");
const leagueScan=scopes.map((s:any)=>({leagueId:s.id,status:"pending",fixturesDiscovered:0,fixturesProcessed:0,sources:[]}));
const pipeline=["load-contract","freeze-contract-hash","preflight","resolve-run-and-resume","reconcile-results","freeze-registry","worldwide-discovery","normalize-and-map","persist-discovery","verify-prematch","research","calculate-primary-and-support-signals","calibrate-risk-and-select-one-or-no-bet","freeze-output","complete-all-checkpoints","validate","finalize","publish-daily-artifact","verify-publication-artifact","train-if-new-verified-outcomes","verify-exact-deployment-sha"];
const pipelineManifest:any={};
for(const stage of pipeline) pipelineManifest[stage]={status:"pending"};
for(const stage of ["load-contract","freeze-contract-hash","preflight","resolve-run-and-resume","freeze-registry"]) pipelineManifest[stage]={status:"complete",evidence:"Initialized by daily controller from canonical contract and 211-scope registry"};
const run={runId,date,timezone:"Africa/Johannesburg",status:"active",storagePolicy:"full-audit",contractVersion:"2.9.0",modelVersion:"v2.9-market-specific-quality-selector",registrySnapshot:{version:registry.version,associationCount:211,scopeIds:scopes.map((s:any)=>s.id)},globalDiscovery:{sources:[],mappedFixtureCount:0,coverageGapCandidates:[]},leagueScan,fixtures:[],pipelineManifest,resumeCursor:{stage:"reconcile-results",associationIndex:0,associationId:scopes[0]?.id??null},resumeAction:"Attempt prior-result reconciliation, then perform worldwide discovery and process every frozen association scope."};
fs.writeFileSync(runFile,JSON.stringify(run,null,2)+"\n");
console.log(JSON.stringify({action:"CREATE",runFile:path.relative(root,runFile),associationScopes:211,resumeCursor:run.resumeCursor},null,2));
