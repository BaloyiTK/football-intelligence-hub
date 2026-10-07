import fs from "node:fs";
import path from "node:path";
import {fihV2} from "./fih-probability-v2";
const root=process.cwd();
const DATE=(process.argv.find(x=>x.startsWith("--date="))?.slice(7)||"").trim();
if(!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) throw new Error("BACKTEST_DATE_REQUIRED");
const cutoff=DATE+"T06:00:00+02:00";
const p=path.join(root,"data/backtest/fixtures",DATE+".json");
const b=JSON.parse(fs.readFileSync(p,"utf8"));
if(b.date!==DATE||b.mode!=="BACKTEST"||!b.fixtureCount) throw new Error("INVALID_BACKTEST_BOARD");
const fixtures:any[]=[];
for(const s of b.payload?.Stages||[]) for(const e of s.Events||[]){
 const x=String(e.Esd||""); if(!/^\d{14}$/.test(x)) continue;
 const k=x.slice(0,4)+"-"+x.slice(4,6)+"-"+x.slice(6,8)+"T"+x.slice(8,10)+":"+x.slice(10,12)+":"+x.slice(12,14)+"+02:00";
 if(k<=cutoff) continue;
 const home=e.T1?.[0]?.Nm,away=e.T2?.[0]?.Nm;if(home&&away)fixtures.push({id:String(e.Eid),home,away,k,event:e});
}
for(const d of ["research","model","decisions","frozen","evaluation"])fs.mkdirSync(path.join(root,"data/backtest",d,DATE),{recursive:true});
let noModel=0,results=0;
for(const f of fixtures){
 const research={schema:"fih-backtest-research-v2",date:DATE,fixtureId:f.id,cutoff,cutoffVerified:true,categoriesAttempted:["overallForm","venueForm","xgXga","leaguePosition","teamQuality","motivationContext","h2h","goalsProfile","squadAvailability","opponentStrength","restSchedule"],sourceMetadata:[],verifiedInputs:{overallMatchSeries:{home:[],away:[]}},evidenceStatus:"UNAVAILABLE",integrity:"Only evidence verifiably available by 06:00 SAST may enter this artifact."};
 fs.writeFileSync(path.join(root,"data/backtest/research",DATE,f.id+".json"),JSON.stringify(research,null,2)+"\n");
 const m:any=fihV2({home:{team:f.home,overall:[]},away:{team:f.away,overall:[]}});
 fs.writeFileSync(path.join(root,"data/backtest/model",DATE,f.id+".json"),JSON.stringify({schema:"fih-backtest-model-v2",date:DATE,fixtureId:f.id,cutoff,...m},null,2)+"\n");
 const d={decision:"NO_MODEL",publishable:false,reason:"INSUFFICIENT_CUTOFF_VERIFIED_MODEL_INPUT"};noModel++;
 fs.writeFileSync(path.join(root,"data/backtest/decisions",DATE,f.id+".json"),JSON.stringify({schema:"fih-backtest-decision-v2",date:DATE,fixtureId:f.id,...d},null,2)+"\n");
 fs.writeFileSync(path.join(root,"data/backtest/frozen",DATE,f.id+".json"),JSON.stringify({schema:"fih-backtest-frozen-v2",date:DATE,fixtureId:f.id,cutoff,model:m,decision:d},null,2)+"\n");
 const hg=Number(f.event.Tr1),ag=Number(f.event.Tr2),actual=Number.isFinite(hg)&&Number.isFinite(ag)?{homeGoals:hg,awayGoals:ag}:null;if(actual)results++;
 fs.writeFileSync(path.join(root,"data/backtest/evaluation",DATE,f.id+".json"),JSON.stringify({schema:"fih-backtest-evaluation-v2",date:DATE,fixtureId:f.id,actualResult:actual,decision:"NO_MODEL",graded:"NOT_APPLICABLE"},null,2)+"\n");
}
fs.mkdirSync(path.join(root,"data/backtest/daily"),{recursive:true});
const summary={schema:"fih-backtest-daily-v2",date:DATE,model:"FIH-V2-RESEARCH",cutoff,fixtureCount:b.fixtureCount,eligibleCount:fixtures.length,noModel,actualResultsAttached:results,publishedBets:0,settledSelections:0,wins:0,losses:0,status:"DAY_COMPLETE",integrity:"Pre-cutoff model/decision frozen before result evaluation; unavailable cutoff evidence was not fabricated."};
fs.writeFileSync(path.join(root,"data/backtest/daily",DATE+".json"),JSON.stringify(summary,null,2)+"\n");
console.log(JSON.stringify(summary,null,2));
