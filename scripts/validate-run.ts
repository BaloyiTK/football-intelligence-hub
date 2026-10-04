import fs from "node:fs";
const file=process.argv[2];if(!file)throw new Error("Usage: npm run run:validate -- <run-file>");
const r=JSON.parse(fs.readFileSync(file,"utf8"));
const terminal=new Set(["BET","NO_BET","NO_MODEL","WIN","LOSS"]);
const errors:string[]=[];
if(!Array.isArray(r.leagueScan)||!Array.isArray(r.fixtures))errors.push("Missing leagueScan/fixtures arrays");
for(const l of r.leagueScan??[]){
 const fx=(r.fixtures??[]).filter((f:any)=>f.leagueId===l.leagueId);
 const unfinished=fx.filter((f:any)=>!terminal.has(f.status)&&!terminal.has(f.outcome));
 if(l.status==="complete"&&unfinished.length)errors.push(`${l.leagueId}: marked complete with ${unfinished.length} unfinished fixture(s)`);
 if(l.status==="complete"&&Number(l.fixturesDiscovered??fx.length)!==fx.length)errors.push(`${l.leagueId}: discovered count does not match saved fixtures`);
}
const unfinished=(r.fixtures??[]).filter((f:any)=>!terminal.has(f.status)&&!terminal.has(f.outcome));
const incomplete=(r.leagueScan??[]).filter((l:any)=>l.status!=="complete");
if(r.status==="complete"&&(unfinished.length||incomplete.length))errors.push("Run marked complete before all leagues/fixtures reached terminal state");
const computed={leaguesComplete:(r.leagueScan??[]).length-incomplete.length,leaguesTotal:(r.leagueScan??[]).length,fixturesDiscovered:(r.fixtures??[]).length,fixturesTerminal:(r.fixtures??[]).length-unfinished.length,fixturesPending:unfinished.length,valid:errors.length===0,readyToFinalize:errors.length===0&&unfinished.length===0&&incomplete.length===0};
console.log(JSON.stringify({file,computed,errors},null,2));if(errors.length||!computed.readyToFinalize)process.exit(2);
