import fs from "node:fs";import path from "node:path";
const file=process.argv[2];if(!file)throw new Error("Usage: npm run run:predictions -- <run-file>");
const r=JSON.parse(fs.readFileSync(file,"utf8")),bets=(r.fixtures??[]).filter((f:any)=>f.status==="BET"&&f.recommendedBet&&Array.isArray(f.sources)&&f.sources.length);
const complete=(r.leagueScan??[]).filter((l:any)=>l.status==="complete").length,total=(r.leagueScan??[]).length,terminal=(r.fixtures??[]).filter((f:any)=>["BET","NO_BET","NO_MODEL","WIN","LOSS"].includes(f.status)||["WIN","LOSS","NO_BET","NO_MODEL"].includes(f.outcome)).length;
console.log(JSON.stringify({label:r.status==="complete"?"FINAL":"PARTIAL — verified/frozen so far",runId:r.runId,status:r.status,coverage:{leaguesComplete:complete,leaguesTotal:total,fixturesTerminal:terminal,fixturesDiscovered:(r.fixtures??[]).length},predictions:bets.map((f:any)=>({leagueId:f.leagueId,homeTeam:f.homeTeam,awayTeam:f.awayTeam,...f.recommendedBet}))},null,2));
