import fs from "node:fs";
import path from "node:path";
import { gradeBet, parseScore } from "../lib/grading";

type VerifiedResult={fixtureKey:string;actualScore:{home:number;away:number};sources?:string[];verifiedAt?:string};
const date=process.argv[2], input=process.argv[3];
if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!input) throw new Error("Usage: npm run results:reconcile -- YYYY-MM-DD <verified-results.json>");
const predictionPath=path.join(process.cwd(),"data","predictions",date+".json");
if(!fs.existsSync(predictionPath)) throw new Error("Prediction archive not found: "+predictionPath);
const archive=JSON.parse(fs.readFileSync(predictionPath,"utf8"));
const before=JSON.stringify(archive.fixtures.map((f:any)=>({fixtureKey:f.fixtureKey,leagueId:f.leagueId,league:f.league,homeTeam:f.homeTeam,awayTeam:f.awayTeam,kickoff:f.kickoff,model:f.model,recommendedBet:f.recommendedBet})));
const payload=JSON.parse(fs.readFileSync(path.resolve(input),"utf8"));
const rows:VerifiedResult[]=Array.isArray(payload)?payload:payload.results;
if(!Array.isArray(rows)) throw new Error("Verified results input must be an array or {results:[...]}");
const byKey=new Map(rows.map(r=>[r.fixtureKey,r]));
let updated=0;
for(const f of archive.fixtures){
 const r=byKey.get(f.fixtureKey); if(!r) continue;
 const score=parseScore(r.actualScore); if(!score) throw new Error("Invalid score for "+f.fixtureKey);
 const bet=f.recommendedBet??f.model?.recommendedBet;
 if(!bet) continue;
 const sources=Array.isArray(r.sources)?r.sources.filter(Boolean):[];
 if(sources.length===0) throw new Error("Verified result requires at least one source: "+f.fixtureKey);
 const outcome=gradeBet(bet,score);
 f.result={actualScore:score,outcome,verifiedAt:r.verifiedAt??new Date().toISOString(),sources};
 updated++;
}
const after=JSON.stringify(archive.fixtures.map((f:any)=>({fixtureKey:f.fixtureKey,leagueId:f.leagueId,league:f.league,homeTeam:f.homeTeam,awayTeam:f.awayTeam,kickoff:f.kickoff,model:f.model,recommendedBet:f.recommendedBet})));
if(before!==after) throw new Error("Frozen prediction mutation detected");
const graded=archive.fixtures.filter((f:any)=>f.result?.outcome==="WIN"||f.result?.outcome==="LOSS");
const wins=graded.filter((f:any)=>f.result.outcome==="WIN").length, losses=graded.length-wins;
archive.results={graded:graded.length,wins,losses,winRate:graded.length?Number((wins/graded.length*100).toFixed(1)):0};
fs.writeFileSync(predictionPath,JSON.stringify(archive,null,2)+"\n");
console.log(JSON.stringify({status:"results-reconciled",date,updated,...archive.results}));
