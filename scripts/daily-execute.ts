import fs from "node:fs";
import path from "node:path";
import {calculate,MODEL_VERSION,ModelInput} from "../lib/model";
const runFile=process.argv[2], evidenceFile=process.argv[3];
if(!runFile||!evidenceFile) throw new Error("Usage: npm run daily:execute -- data/runs/<run>.json data/daily-evidence/<date>.json");
const read=(p:string)=>JSON.parse(fs.readFileSync(path.resolve(p),"utf8"));
const run=read(runFile), evidence=read(evidenceFile), registry=read("data/leagues.json");
if(run.date!==evidence.date) throw new Error("Run/evidence date mismatch");
if(run.modelVersion!==MODEL_VERSION) throw new Error("Refusing non-locked model version");
if(registry.associationCount!==211||(run.registrySnapshot?.scopeIds??[]).length!==211) throw new Error("211-scope invariant failed");
const scopeIds=new Set(registry.leagues.map((x:any)=>x.id)), items=Array.isArray(evidence.fixtures)?evidence.fixtures:[], scopeEvidence=evidence.associationVerification??{};
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
for(const s of run.leagueScan){
 const rows=run.fixtures.filter((x:any)=>x.leagueId===s.leagueId);
 s.fixturesDiscovered=rows.length; s.fixturesProcessed=rows.filter((x:any)=>terminal.has(x.status)).length;
 s.sources=Array.from(new Set<string>([...(s.sources??[]),...(scopeEvidence[s.leagueId]?.sources??[]),...rows.flatMap((x:any)=>x.sources??[])]));
 if(rows.length) s.status=s.fixturesProcessed===rows.length?"complete":"processing";
 else if(scopeEvidence[s.leagueId]?.verifiedZero===true&&s.sources.length) s.status="complete"; else s.status="pending";
}
const complete=run.leagueScan.filter((x:any)=>x.status==="complete").length, unresolved=run.leagueScan.find((x:any)=>x.status!=="complete");
run.globalDiscovery.mappedFixtureCount=run.fixtures.length;
for(const stage of ["normalize-and-map","persist-discovery"]) run.pipelineManifest[stage]={status:"complete",evidence:"Consumed persisted sourced daily evidence"};
if(complete===211){
 for(const stage of ["verify-prematch","research","calculate-primary-and-support-signals","calibrate-risk-and-select-one-or-no-bet","freeze-output","complete-all-checkpoints"]) run.pipelineManifest[stage]={status:"complete",evidence:"All 211 scopes and mapped fixtures reached auditable terminal state from persisted evidence"};
 run.resumeCursor={stage:"validate",associationIndex:211,associationId:null}; run.resumeAction="Run validation, strict finalization and publication handoff.";
}else{
 run.resumeCursor={stage:"research",associationIndex:Math.max(0,run.leagueScan.findIndex((x:any)=>x.status!=="complete")),associationId:unresolved?.leagueId??null};
 run.resumeAction="Supply/repair persisted evidence for unresolved association scopes and rerun daily:execute; never fabricate zero-fixture or model evidence.";
}
run.executionSummary={associationScopes:211,scopesComplete:complete,scopesRemaining:211-complete,mappedFixtures:run.fixtures.length,terminalFixtures:run.fixtures.filter((x:any)=>terminal.has(x.status)).length,bets:run.fixtures.filter((x:any)=>x.status==="BET").length};
fs.writeFileSync(runFile,JSON.stringify(run,null,2)+"\n"); console.log(JSON.stringify(run.executionSummary,null,2));
