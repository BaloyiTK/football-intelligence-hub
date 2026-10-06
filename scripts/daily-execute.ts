import fs from "node:fs";
import path from "node:path";
import {calculate,MODEL_VERSION,ModelInput} from "../lib/model";
const runFile=process.argv[2], evidenceFile=process.argv[3];
if(!runFile||!evidenceFile) throw new Error("Usage: npm run daily:execute -- data/runs/<run>.json data/daily-evidence/<date>.json");
const read=(p:string)=>JSON.parse(fs.readFileSync(path.resolve(p),"utf8"));
const run=read(runFile), evidence=read(evidenceFile), registry=read("data/leagues.json");
if(run.date!==evidence.date) throw new Error("Run/evidence date mismatch");
if(run.modelVersion!==MODEL_VERSION) throw new Error("Refusing non-locked model version");
if(run.completionPolicy!=="daily-fixture-snapshot") throw new Error("Run is not using daily fixture snapshot completion policy");
const scopeIds=new Set(registry.leagues.map((x:any)=>x.id)), items=Array.isArray(evidence.fixtures)?evidence.fixtures:[];
const terminal=new Set(["BET","NO_BET","NO_MODEL"]), existing=new Map<string,any>((run.fixtures??[]).map((x:any)=>[x.fixtureKey,x]));
const norm=(s:string)=>s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
for(const x of items){
 if(!scopeIds.has(x.leagueId)) throw new Error("Unknown association scope "+x.leagueId);
 if(!x.homeTeam||!x.awayTeam||!x.league||!x.country||!x.kickoff) throw new Error("Incomplete fixture identity");
 const k=x.fixtureKey??[run.date,x.leagueId,norm(x.homeTeam),norm(x.awayTeam)].join("|"), old=existing.get(k);
 if(old&&terminal.has(old.status)) continue;
 const sources=Array.from(new Set<string>([...(x.sources??[]),...(x.research?.sources??[])]));
 if(!sources.length) throw new Error("Fixture has no persisted sources: "+k);
 let rec:any={...old,...x,fixtureKey:k,sources,status:"processing"};
 if(x.eligibility==="excluded") rec={...rec,status:"NO_MODEL",noModelReason:x.exclusionReason??"Excluded by configured senior-football scope"};
 else if(x.modelInput){ const out=calculate(x.modelInput as ModelInput); rec={...rec,model:out,recommendedBet:out.recommendedBet??null,reviewBet:out.reviewBet??null,status:out.recommendedBet?"BET":"NO_BET"}; }
 else if(x.researchComplete===true) rec={...rec,status:"NO_MODEL",noModelReason:x.noModelReason??"Required model inputs unavailable after Full -> Standard -> Basic evidence fallback"};
 existing.set(k,rec);
}
run.fixtures=Array.from(existing.values());
run.leagueScan=[];
const unfinished=run.fixtures.filter((x:any)=>!terminal.has(x.status));
run.globalDiscovery.mappedFixtureCount=run.fixtures.length;
for(const stage of ["worldwide-discovery","normalize-and-map","persist-discovery"]) run.pipelineManifest[stage]={status:"complete",evidence:"Consumed persisted LiveScore daily fixture snapshot and sourced daily evidence"};
if(unfinished.length===0){
 for(const stage of ["verify-prematch","research","calculate-primary-and-support-signals","calibrate-risk-and-select-one-or-no-bet","freeze-output","complete-all-checkpoints"]) run.pipelineManifest[stage]={status:"complete",evidence:"Every eligible fixture from the daily snapshot reached BET / NO_BET / NO_MODEL"};
 run.resumeCursor={stage:"validate",fixtureIndex:run.fixtures.length}; run.resumeAction="Run validation, strict finalization and publication handoff.";
}else{
 const i=run.fixtures.findIndex((x:any)=>!terminal.has(x.status)); run.resumeCursor={stage:"research",fixtureIndex:Math.max(0,i),fixtureKey:unfinished[0]?.fixtureKey??null}; run.resumeAction="Complete research/model evidence for every unresolved eligible fixture from the stored daily snapshot.";
}
run.executionSummary={completionPolicy:"daily-fixture-snapshot",mappedFixtures:run.fixtures.length,terminalFixtures:run.fixtures.length-unfinished.length,fixturesRemaining:unfinished.length,bets:run.fixtures.filter((x:any)=>x.status==="BET").length};
fs.writeFileSync(runFile,JSON.stringify(run,null,2)+"\n"); console.log(JSON.stringify(run.executionSummary,null,2));
