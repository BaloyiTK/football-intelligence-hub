import fs from "node:fs";
import path from "node:path";

const date=process.argv[2];
if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Usage: npm run daily:controller -- YYYY-MM-DD");
const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,"data/leagues.json"),"utf8"));
const fixtureSnapshot=`data/fixture-snapshots/${date}.json`;
const newsSnapshot=`data/news-snapshots/${date}.json`;
const runsDir=path.join(root,"data/runs"); fs.mkdirSync(runsDir,{recursive:true});
const existing=fs.readdirSync(runsDir).filter(n=>n.startsWith(date+"_")&&n.endsWith(".json")).map(name=>({name,mtime:fs.statSync(path.join(runsDir,name)).mtimeMs})).sort((a,b)=>b.mtime-a.mtime);
for(const {name} of existing){
 const p=path.join(runsDir,name),r=JSON.parse(fs.readFileSync(p,"utf8"));
 if(r.status!=="complete"&&r.completionPolicy==="daily-fixture-snapshot"){
  console.log(JSON.stringify({action:"RESUME",runFile:path.relative(root,p),completionPolicy:r.completionPolicy,resumeCursor:r.resumeCursor,resumeAction:r.resumeAction},null,2)); process.exit(0);
 }
}
const stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
const runId=`${date}_${stamp}_v2.9_snapshot`, runFile=path.join(runsDir,runId+".json");
const pipeline=["load-contract","freeze-contract-hash","preflight","resolve-run-and-resume","reconcile-results","freeze-registry","worldwide-discovery","normalize-and-map","persist-discovery","verify-prematch","research","calculate-primary-and-support-signals","calibrate-risk-and-select-one-or-no-bet","freeze-output","complete-all-checkpoints","validate","finalize","publish-daily-artifact","verify-publication-artifact","train-if-new-verified-outcomes","verify-exact-deployment-sha"];
const pipelineManifest:any={}; for(const x of pipeline)pipelineManifest[x]={status:"pending"};
for(const x of ["load-contract","freeze-contract-hash","preflight","resolve-run-and-resume","freeze-registry"])pipelineManifest[x]={status:"complete",evidence:"Initialized from canonical V2.9 contract; LiveScore daily snapshot is the discovery universe"};
const run={runId,date,timezone:"Africa/Johannesburg",status:"active",storagePolicy:"full-audit",completionPolicy:"daily-fixture-snapshot",contractVersion:"2.9.0",modelVersion:"v2.9-market-specific-quality-selector",dailyCache:{fixtureSnapshot,newsSnapshot,policy:"Fetch each LiveScore dataset at most once per SAST date; reuse on reruns.",newsUsage:"Contextual research only; does not independently alter locked V2.9 probabilities."},globalDiscovery:{sources:[],snapshot:fixtureSnapshot,mappedFixtureCount:0},leagueScan:[],fixtures:[],pipelineManifest,resumeCursor:{stage:"worldwide-discovery",fixtureIndex:0},resumeAction:"Ingest/reuse today's LiveScore fixture snapshot, normalize eligible senior fixtures, then research and model every eligible fixture."};
fs.writeFileSync(runFile,JSON.stringify(run,null,2)+"\n");
console.log(JSON.stringify({action:"CREATE",runFile:path.relative(root,runFile),completionPolicy:run.completionPolicy,fixtureSnapshot,newsSnapshot},null,2));
