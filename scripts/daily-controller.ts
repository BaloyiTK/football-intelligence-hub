import fs from "node:fs";
import path from "node:path";

const date=process.argv[2];
if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Usage: npm run daily:controller -- YYYY-MM-DD");
const root=process.cwd();
const fixtureSnapshot="data/today_fixture.json";
const newsSnapshot="data/today_news.json";
const fixturePath=path.join(root,fixtureSnapshot);
if(!fs.existsSync(fixturePath)) throw new Error("FRESH_DATA_GATE: data/today_fixture.json is missing");
const snapshot=JSON.parse(fs.readFileSync(fixturePath,"utf8"));
if(snapshot.schema!=="fih-today-fixture-v1") throw new Error("FRESH_DATA_GATE: unsupported today_fixture schema");
if(snapshot.date!==date) throw new Error(`FRESH_DATA_GATE: today_fixture date ${snapshot.date??"missing"} does not match ${date}`);
const stages=Array.isArray(snapshot?.payload?.Stages)?snapshot.payload.Stages:[];
const fixtureCount=stages.reduce((n:number,s:any)=>n+(Array.isArray(s?.Events)?s.Events.length:0),0);
if(!stages.length||!fixtureCount||fixtureCount!==Number(snapshot.fixtureCount)) throw new Error("FRESH_DATA_GATE: today_fixture is empty or count validation failed");

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
const pipeline=["load-contract","freeze-contract-hash","preflight","resolve-run-and-resume","reconcile-results","fresh-data-gate","worldwide-discovery","normalize-and-map","persist-discovery","verify-prematch","research","calculate-primary-and-support-signals","calibrate-risk-and-select-one-or-no-bet","freeze-output","complete-all-checkpoints","validate","finalize","publish-daily-artifact","verify-publication-artifact","train-if-new-verified-outcomes","verify-exact-deployment-sha"];
const pipelineManifest:any={}; for(const x of pipeline)pipelineManifest[x]={status:"pending"};
for(const x of ["load-contract","freeze-contract-hash","preflight","resolve-run-and-resume","fresh-data-gate"]) pipelineManifest[x]={status:"complete",evidence:`Validated rolling LiveScore snapshot for ${date}: ${stages.length} stages / ${fixtureCount} fixtures`};
const run={runId,date,timezone:"Africa/Johannesburg",status:"active",storagePolicy:"full-audit",completionPolicy:"daily-fixture-snapshot",contractVersion:"2.9.0",modelVersion:"v2.9-market-specific-quality-selector",dailyCache:{fixtureSnapshot,newsSnapshot,fixtureDate:snapshot.date,fixtureCount,stageCount:stages.length,policy:"A fresh same-SAST-date LiveScore snapshot is mandatory before modeling; deployment state is not a data gate.",newsUsage:"Contextual research only; does not independently alter locked V2.9 probabilities."},globalDiscovery:{sources:[fixtureSnapshot],snapshot:fixtureSnapshot,mappedFixtureCount:0},leagueScan:[],fixtures:[],pipelineManifest,resumeCursor:{stage:"normalize-and-map",fixtureIndex:0},resumeAction:"Normalize every eligible senior fixture from today's LiveScore board, research Full -> Standard -> Basic, then run exact V2.9."};
fs.writeFileSync(runFile,JSON.stringify(run,null,2)+"\n");
console.log(JSON.stringify({action:"CREATE",runFile:path.relative(root,runFile),completionPolicy:run.completionPolicy,fixtureSnapshot,date,stageCount:stages.length,fixtureCount},null,2));
