import fs from "node:fs";
const args=process.argv.slice(2),finalize=args.includes("--finalize"),file=args.find(x=>!x.startsWith("--"));
if(!file)throw new Error("Usage: npm run run:validate -- <run-file> [--finalize]");
const r=JSON.parse(fs.readFileSync(file,"utf8")),terminal=new Set(["BET","NO_BET","NO_MODEL","WIN","LOSS"]),allowedLeague=new Set(["pending","discovering","researching","processing","complete","blocked"]);
const errors:string[]=[],warnings:string[]=[];
if(!Array.isArray(r.leagueScan)||!Array.isArray(r.fixtures))errors.push("Missing leagueScan/fixtures arrays");
const seen=new Set<string>();
for(const l of r.leagueScan??[]){
 if(!allowedLeague.has(l.status))errors.push(`${l.leagueId}: invalid league status ${l.status}`);
 const fx=(r.fixtures??[]).filter((f:any)=>f.leagueId===l.leagueId),unfinished=fx.filter((f:any)=>!terminal.has(f.status)&&!terminal.has(f.outcome));
 if(seen.has(l.leagueId))errors.push(`${l.leagueId}: duplicate league checkpoint`);seen.add(l.leagueId);
 if(Number(l.fixturesDiscovered??fx.length)!==fx.length)errors.push(`${l.leagueId}: fixturesDiscovered does not match saved fixtures`);
 if(Number(l.fixturesProcessed??0)!==fx.length-unfinished.length)errors.push(`${l.leagueId}: fixturesProcessed does not match terminal fixtures`);
 if(l.status==="complete"&&unfinished.length)errors.push(`${l.leagueId}: complete with ${unfinished.length} unfinished fixture(s)`);
 if(l.status==="complete"&&fx.length===0&&(!Array.isArray(l.sources)||l.sources.length===0))errors.push(`${l.leagueId}: zero-fixture completion has no verification source`);
 if(l.status==="blocked"&&!l.blocker)errors.push(`${l.leagueId}: blocked without blocker reason`);
}
for(const f of r.fixtures??[]){
 if(!f.leagueId||!f.homeTeam||!f.awayTeam)errors.push("Fixture missing leagueId/homeTeam/awayTeam");
 if(terminal.has(f.status)||terminal.has(f.outcome)){if(!Array.isArray(f.sources)||f.sources.length===0)errors.push(`${f.leagueId} ${f.homeTeam} v ${f.awayTeam}: terminal fixture missing sources`);}
}
const unfinished=(r.fixtures??[]).filter((f:any)=>!terminal.has(f.status)&&!terminal.has(f.outcome)),incomplete=(r.leagueScan??[]).filter((l:any)=>l.status!=="complete");
const ready=errors.length===0&&unfinished.length===0&&incomplete.length===0;
if(r.status==="complete"&&!ready)errors.push("Run status complete but finalization invariants fail");
if(r.status==="blocked"&&!r.blocker)errors.push("Run blocked without blocker reason");
if(finalize&&!ready)errors.push("Finalization requested before all leagues and fixtures are complete");
if(!finalize&&!ready)warnings.push("Run is internally checkable but not ready to finalize");
const computed={mode:finalize?"finalize":"integrity",leaguesComplete:(r.leagueScan??[]).length-incomplete.length,leaguesTotal:(r.leagueScan??[]).length,fixturesDiscovered:(r.fixtures??[]).length,fixturesTerminal:(r.fixtures??[]).length-unfinished.length,fixturesPending:unfinished.length,readyToFinalize:ready};
console.log(JSON.stringify({file,computed,errors,warnings},null,2));if(errors.length)process.exit(2);
