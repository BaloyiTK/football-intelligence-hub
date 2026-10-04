import fs from "node:fs";import {gradeBet,parseScore} from "../lib/grading";
const args=process.argv.slice(2),fix=args.includes("--fix"),file=args.find(x=>!x.startsWith("--"));
if(!file)throw new Error("Usage: npm run backtest:audit -- <backtest-file> [--fix]");
const r=JSON.parse(fs.readFileSync(file,"utf8")),mismatches:any[]=[],errors:string[]=[];
for(const f of r.fixtures??[]){if(!f.recommendedBet)continue;const s=parseScore(f.actualScore);if(!s){errors.push(`${f.homeTeam} v ${f.awayTeam}: missing/invalid actualScore`);continue}let expected:"WIN"|"LOSS";try{expected=gradeBet(f.recommendedBet,s)}catch(e:any){errors.push(`${f.homeTeam} v ${f.awayTeam}: ${e.message}`);continue}if(f.outcome!==expected){mismatches.push({match:`${f.homeTeam} vs ${f.awayTeam}`,pick:f.recommendedBet.pick,actualScore:f.actualScore,stored:f.outcome,expected});if(fix)f.outcome=expected}}
if(fix&&!errors.length){const bets=(r.fixtures??[]).filter((x:any)=>x.recommendedBet&&["WIN","LOSS"].includes(x.outcome)),wins=bets.filter((x:any)=>x.outcome==="WIN").length,losses=bets.length-wins,hitRate=bets.length?+(100*wins/bets.length).toFixed(1):null;
 if(r.metrics){r.metrics.wins=wins;r.metrics.losses=losses}
 if(r.aggregateMetrics){r.aggregateMetrics.wins=wins;r.aggregateMetrics.losses=losses;r.aggregateMetrics.hitRate=hitRate}
 r.gradingAudit={auditedAt:new Date().toISOString(),betsAudited:bets.length,mismatchesCorrected:mismatches.length,status:"passed"};
 fs.writeFileSync(file,JSON.stringify(r,null,2)+"\n");
}
console.log(JSON.stringify({file,mode:fix?"fix":"check",bets:(r.fixtures??[]).filter((x:any)=>x.recommendedBet).length,mismatches,errors,passed:mismatches.length===0&&errors.length===0||fix&&errors.length===0},null,2));
if(errors.length||(!fix&&mismatches.length))process.exit(2);
