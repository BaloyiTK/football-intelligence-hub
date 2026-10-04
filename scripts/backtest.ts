import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { calculate, type ModelInput } from "../lib/model";
import { gradeBet } from "../lib/grading";

type EvidenceFixture={date:string;kickoff:string;leagueId:string;homeTeam:string;awayTeam:string;evidenceCutoff:string;modelLevel:"full"|"standard"|"basic"|"no-model";sampleSize:number;inputs?:ModelInput;actualScore:{home:number;away:number};sources:string[];noModelReason?:string};
type League={id:string};
const arg=(n:string)=>{const i=process.argv.indexOf(n);return i<0?undefined:process.argv[i+1]};
const from=arg("--from"),to=arg("--to"),evidence=arg("--evidence"),resume=arg("--resume");
if(!from||!to||(!evidence&&!resume)){console.error("Usage: npm run backtest -- --from YYYY-MM-DD --to YYYY-MM-DD --evidence data/backtest-evidence/file.json\n   or: npm run backtest -- --from ... --to ... --resume data/backtests/file.json --evidence ...");process.exit(1)}
const root=process.cwd(), leagues=(JSON.parse(fs.readFileSync(path.join(root,"data/leagues.json"),"utf8")).leagues as League[]);
const dates:string[]=[];for(let d=new Date(from+"T00:00:00Z"),e=new Date(to+"T00:00:00Z");d<=e;d.setUTCDate(d.getUTCDate()+1))dates.push(d.toISOString().slice(0,10));
let report:any, out:string;
if(resume){out=path.join(root,resume);report=JSON.parse(fs.readFileSync(out,"utf8"))}else{const id=String(crypto.randomInt(10000,100000));out=path.join(root,`data/backtests/${from}_to_${to}_${id}_v2.2.json`);report={status:"in-progress",runId:id,modelVersion:"v2.2-calibrated-selector",range:{start:from,end:to},dailyScan:dates.map(date=>({date,status:"pending"})),leagueScan:leagues.map(x=>({leagueId:x.id,status:"pending",dates:{}})),fixtures:[],aggregateMetrics:null,failureAnalysis:[],improvementCandidates:[]}}
const ev=JSON.parse(fs.readFileSync(path.join(root,evidence!),"utf8")) as EvidenceFixture[];
const coveragePath=path.join(root,evidence!).replace(/\\.json$/,".coverage.json");
if(!fs.existsSync(coveragePath))throw new Error("Missing coverage manifest: "+coveragePath);
const coverage=JSON.parse(fs.readFileSync(coveragePath,"utf8"));
if(coverage.status!=="complete"||coverage.missingLeagueDays!==0)throw new Error("Evidence coverage is incomplete; refusing to mark unchecked league-days complete.");
const save=()=>{fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n")};
save();
for(const date of dates){for(const l of leagues){const ls=report.leagueScan.find((x:any)=>x.leagueId===l.id);if(ls.dates?.[date]==="complete")continue;const rows=ev.filter(x=>x.date===date&&x.leagueId===l.id);for(const f of rows){if(report.fixtures.some((x:any)=>x.date===f.date&&x.kickoff===f.kickoff&&x.leagueId===f.leagueId&&x.homeTeam===f.homeTeam&&x.awayTeam===f.awayTeam))continue;if(f.modelLevel==="no-model"||!f.inputs){report.fixtures.push({...f,outcome:"NO_MODEL",recommendedBet:null});continue}const m=calculate({...f.inputs,modelLevel:f.modelLevel,sampleSize:f.sampleSize});const b=m.recommendedBet;report.fixtures.push({...f,lambdaHome:m.lambdaHome,lambdaAway:m.lambdaAway,correctScore:m.likelyScores[0]??null,recommendedBet:b,outcome:b?(gradeBet(b,f.actualScore)):"NO_BET"})}ls.dates??={};ls.dates[date]="complete";save()}report.dailyScan.find((x:any)=>x.date===date).status="complete";save()}
for(const l of report.leagueScan)l.status=dates.every(d=>l.dates?.[d]==="complete")?"complete":"pending";
const bets=report.fixtures.filter((x:any)=>x.recommendedBet), wins=bets.filter((x:any)=>x.outcome==="WIN").length, losses=bets.filter((x:any)=>x.outcome==="LOSS").length;
const group=(key:(x:any)=>string)=>Object.values(bets.reduce((a:any,x:any)=>{const k=key(x);a[k]??={key:k,bets:0,wins:0,losses:0};a[k].bets++;a[k][x.outcome==="WIN"?"wins":"losses"]++;return a},{})).map((x:any)=>({...x,hitRate:x.bets?+(100*x.wins/x.bets).toFixed(1):null}));
report.aggregateMetrics={configuredLeaguesChecked:report.leagueScan.filter((x:any)=>x.status==="complete").length,configuredLeaguesTotal:leagues.length,datesChecked:report.dailyScan.filter((x:any)=>x.status==="complete").length,datesTotal:dates.length,historicalFixturesFound:report.fixtures.length,modelledFixtures:report.fixtures.filter((x:any)=>!["NO_MODEL"].includes(x.outcome)).length,noModel:report.fixtures.filter((x:any)=>x.outcome==="NO_MODEL").length,recommendedBets:bets.length,noBet:report.fixtures.filter((x:any)=>x.outcome==="NO_BET").length,wins,losses,hitRate:bets.length?+(100*wins/bets.length).toFixed(1):null,byMarket:group(x=>x.recommendedBet.market),byRating:group(x=>x.recommendedBet.rating),byModelLevel:group(x=>x.modelLevel),bySampleDepth:group(x=>x.sampleSize>=8?"8+":x.sampleSize>=5?"5-7":x.sampleSize>=3?"3-4":"1-2")};
report.status=report.aggregateMetrics.configuredLeaguesChecked===leagues.length&&report.aggregateMetrics.datesChecked===dates.length?"complete":"in-progress";
save();console.log(JSON.stringify({file:path.relative(root,out),status:report.status,...report.aggregateMetrics},null,2));
