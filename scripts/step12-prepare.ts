import fs from "node:fs";
import path from "node:path";

const ROOT=process.cwd(),TZ="Africa/Johannesburg";
const DATE=process.argv[process.argv.indexOf("--date")+1]||process.env.FIH_DATE||"";
const MODE=process.argv[process.argv.indexOf("--mode")+1]||"";
if(!/^\d{4}-\d{2}-\d{2}$/.test(DATE)||!["PREDICTION","BACKTEST"].includes(MODE))throw new Error("usage: step12-prepare --date YYYY-MM-DD --mode PREDICTION|BACKTEST");
const boardPath=path.join(ROOT,MODE==="BACKTEST"?"data/backtest/fixtures":"data/prediction-fixtures",DATE+".json");
if(!fs.existsSync(boardPath))throw new Error("STEP12_BOARD_MISSING "+boardPath);
const board=JSON.parse(fs.readFileSync(boardPath,"utf8"));
const schema=MODE==="BACKTEST"?"fih-backtest-fixture-v1":"fih-prediction-fixture-v1";
if(board.schema!==schema||board.mode&&board.mode!==MODE||board.date!==DATE||board.timezone!==TZ)throw new Error("STEP12_BOARD_IDENTITY_INVALID");
const stages=Array.isArray(board.payload?.Stages)?board.payload.Stages:[],events=stages.flatMap((s:any)=>(s.Events||[]).map((e:any)=>({e,s})));
if(!events.length||events.length!==board.fixtureCount)throw new Error("STEP12_BOARD_COUNT_INVALID");
const id=(e:any,s:any)=>String(e?.Eid??e?.Id??[s?.CompId,e?.T1?.[0]?.Nm,e?.T2?.[0]?.Nm,e?.Esd].filter(Boolean).join(":"));
const team=(x:any)=>String(x?.[0]?.Nm??"UNKNOWN");
const boardFetchedMs=Date.parse(String(board.fetchedAt||""));
function predictionKickoffMs(e:any){const raw=String(e?.Esd??e?.Epsd??e?.startTime??"");if(!/^\d{14}$/.test(raw))return NaN;return new Date(raw.slice(0,4)+"-"+raw.slice(4,6)+"-"+raw.slice(6,8)+"T"+raw.slice(8,10)+":"+raw.slice(10,12)+":"+raw.slice(12,14)+"+02:00").getTime()}
function baseExclusion(e:any,s:any){
 const status=String(e?.Eps??"").toUpperCase();
 if(MODE==="PREDICTION"&&status!=="NS")return "NOT_PREMATCH";
 if(MODE==="PREDICTION"){const km=predictionKickoffMs(e);if(!Number.isFinite(km))return "PREDICTION_KICKOFF_UNVERIFIED";if(!Number.isFinite(boardFetchedMs)||km<=boardFetchedMs)return "PREMATCH_WINDOW_CLOSED"}
 const text=[s?.CompN,s?.Snm,s?.Cnm,e?.T1?.[0]?.Nm,e?.T2?.[0]?.Nm].filter(Boolean).join(" ").toLowerCase();
 if(/women|\bw\b/.test(text))return "WOMEN";
 if(/\bu[- ]?\d{2}\b|under[- ]?\d{2}|youth/.test(text))return "YOUTH";
 const teams=[e?.T1?.[0]?.Nm,e?.T2?.[0]?.Nm].filter(Boolean).join(" ").toLowerCase();
 if(/reserve|reserves|\bu23\b|\bu21\b|\bu20\b|\bu19\b|\bu18\b|\bu17\b|\bii\b|(?:^|\s)2$/.test(teams))return "RESERVE_OR_DEVELOPMENT";
 if(/university|academia|academy|akatemia|juniors?/.test(text))return "NON_SENIOR";
 if(MODE==="BACKTEST"){
   const raw=String(e?.Esd??"");
   if(!/^\d{14}$/.test(raw))return "BACKTEST_KICKOFF_UNVERIFIED";
   const hhmm=Number(raw.slice(8,12));
   if(hhmm<=600)return "BACKTEST_KICKOFF_AT_OR_BEFORE_0600_SAST";
 }
 return null;
}
const timestamp=Date.parse(board.fetchedAt||"")||Date.now(),runId=`step12:${MODE.toLowerCase()}:${DATE}:${timestamp}`,researchRunId=`research:${DATE}:${timestamp}`;
const now=new Date().toISOString();
const fixtures=events.map(({e,s}:any)=>{const reason=baseExclusion(e,s);return {id:id(e,s),home:team(e.T1),away:team(e.T2),competition:String(s?.CompN??s?.Snm??"UNKNOWN"),kickoff:String(e?.Esd??""),eligible:!reason,exclusionReason:reason,state:reason?"EXCLUDED":"PENDING",updatedAt:now}});
const eligible=fixtures.filter((f:any)=>f.eligible).sort((a:any,b:any)=>String(a.kickoff).localeCompare(String(b.kickoff))||a.id.localeCompare(b.id));
if(!eligible.length)throw new Error("STEP12_NO_ELIGIBLE_FIXTURES");
const counts={boardTotal:fixtures.length,eligible:eligible.length,excluded:fixtures.length-eligible.length,PENDING:eligible.length,RESEARCH_VERIFIED:0,MODEL_VERIFIED:0,DECISION_VERIFIED:0,COMPLETE:0,EXCLUDED:fixtures.length-eligible.length};
const ledger={schema:"fih-daily-run-ledger-v1",date:DATE,mode:MODE,timezone:TZ,runId,researchRunId,runStatus:"RUNNING",heartbeatAt:now,recoveryCount:0,board:{fetchedAt:board.fetchedAt,fixtureCount:board.fixtureCount,stageCount:board.stageCount},createdAt:now,updatedAt:now,fixtures,counts,next:{fixtureId:eligible[0].id,state:"PENDING"}};
const cutoffAt=MODE==="BACKTEST"?DATE+"T04:00:00.000Z":null;
const queueFixtures=eligible.map((f:any)=>({fixtureId:f.id,home:f.home,away:f.away,competition:f.competition,kickoff:f.kickoff}));
const queue={schema:"fih-chatgpt-research-queue-v3",date:DATE,mode:MODE,cutoffAt,researchRunId,generatedAt:now,count:queueFixtures.length,executor:"CHATGPT_WEB_SEARCH",workingCheckpoint:`/mnt/data/fih/research-work/${DATE}.json`,canonicalCommitPolicy:"ONE_CANONICAL_COMMIT_AFTER_N_OF_N_VALIDATION_AND_PROMOTION",canonicalResearchSchema:"fih-daily-research-v5",researchRequirements:{overallForm:{count:5},venueForm:{count:5,homeTeam:"LAST_COMPLETED_HOME",awayTeam:"LAST_COMPLETED_AWAY"},standings:{factsOnly:true},headToHead:{count:5,verifiedRequiresExactCount:true},squadAvailability:{factsOnly:true},schedule:{factsOnly:true},competitionContext:{factsOnly:true},factsOnly:true},fixtures:queueFixtures};
const recoveryPath=path.join(ROOT,"data","recovery-requests",DATE+".json");
let priorSupersessions:any[]=[];
if(fs.existsSync(recoveryPath)){try{const prior=JSON.parse(fs.readFileSync(recoveryPath,"utf8"));if(Array.isArray(prior.priorSupersessions))priorSupersessions=prior.priorSupersessions;}catch{}}
const recovery={schema:"fih-recovery-request-v1",date:DATE,runId,researchRunId,requestedAt:now,reason:"STEP1_VERIFIED_CHATGPT_STEP2_HANDOFF",status:"CHATGPT_RESEARCH_REQUIRED",next:{fixtureId:eligible[0].id,state:"PENDING"},expectedFixtureCount:eligible.length,validatedCount:0,queuePath:`data/research-queue/${DATE}.json`,boardFetchedAt:board.fetchedAt,priorSupersessions};
for(const [rel,x] of [[`data/run-state/${DATE}.json`,ledger],[`data/research-queue/${DATE}.json`,queue],[`data/recovery-requests/${DATE}.json`,recovery]] as any){
 const p=path.join(ROOT,rel);fs.mkdirSync(path.dirname(p),{recursive:true});const t=p+".tmp";fs.writeFileSync(t,JSON.stringify(x,null,2)+"\n");fs.renameSync(t,p);const y=JSON.parse(fs.readFileSync(p,"utf8"));if(y.date!==DATE||y.researchRunId!==researchRunId)throw new Error("STEP12_PREPARE_REREAD_FAILED "+rel);
}
console.log(JSON.stringify({ok:true,date:DATE,mode:MODE,runId,researchRunId,boardTotal:fixtures.length,eligible:eligible.length,excluded:fixtures.length-eligible.length,cutoffAt,nextFixtureId:eligible[0].id},null,2));
