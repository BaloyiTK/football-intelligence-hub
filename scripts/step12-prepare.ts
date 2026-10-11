import fs from "node:fs";
import path from "node:path";
import {fixtureExclusion} from "./fixture-eligibility";

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
function baseExclusion(e:any,s:any){return fixtureExclusion(e,s,{mode:MODE as "PREDICTION"|"BACKTEST",boardFetchedAt:board.fetchedAt})}
const timestamp=Date.parse(board.fetchedAt||"")||Date.now(),runId=`step12:${MODE.toLowerCase()}:${DATE}:${timestamp}`,researchRunId=`research:${DATE}:${timestamp}`;
const now=new Date().toISOString();
const fixtures=events.map(({e,s}:any)=>{const reason=baseExclusion(e,s);return {id:id(e,s),home:team(e.T1),away:team(e.T2),competition:String(s?.CompN??s?.Snm??"UNKNOWN"),kickoff:String(e?.Esd??""),eligible:!reason,exclusionReason:reason,state:reason?"EXCLUDED":"PENDING",updatedAt:now}});
const eligible=fixtures.filter((f:any)=>f.eligible).sort((a:any,b:any)=>String(a.kickoff).localeCompare(String(b.kickoff))||a.id.localeCompare(b.id));
if(!eligible.length)throw new Error("STEP12_NO_ELIGIBLE_FIXTURES");
const counts={boardTotal:fixtures.length,eligible:eligible.length,excluded:fixtures.length-eligible.length,PENDING:eligible.length,RESEARCH_VERIFIED:0,MODEL_VERIFIED:0,DECISION_VERIFIED:0,COMPLETE:0,EXCLUDED:fixtures.length-eligible.length};
const ledger={schema:"fih-daily-run-ledger-v1",date:DATE,mode:MODE,timezone:TZ,runId,researchRunId,runStatus:"RUNNING",heartbeatAt:now,recoveryCount:0,board:{fetchedAt:board.fetchedAt,fixtureCount:board.fixtureCount,stageCount:board.stageCount},createdAt:now,updatedAt:now,fixtures,counts,next:{fixtureId:eligible[0].id,state:"PENDING"}};
const cutoffAt=MODE==="BACKTEST"?DATE+"T04:00:00.000Z":null;
const queueFixtures=eligible.map((f:any)=>({fixtureId:f.id,home:f.home,away:f.away,competition:f.competition,kickoff:f.kickoff}));
const queue={schema:"fih-chatgpt-research-queue-v3",date:DATE,mode:MODE,cutoffAt,researchRunId,generatedAt:now,count:queueFixtures.length,executor:"CHATGPT_WEB_SEARCH",workingCheckpoint:`/mnt/data/fih/research-work/${DATE}.json`,canonicalCommitPolicy:"ONE_CANONICAL_COMMIT_AFTER_N_OF_N_VALIDATION_AND_PROMOTION",canonicalResearchSchema:"fih-daily-research-v5",researchExecutionPlan:{atomicUnit:"FIXTURE",fixtureOrder:"FROZEN_KICKOFF_ASC_THEN_ID",categoryPasses:[{id:"RESULTS_TABLE",categories:["form","standings"],mode:"BOUNDED_PARALLEL_SEARCH",sourceReuse:"REUSE_SOURCE_ACROSS_SUPPORTED_CATEGORIES"},{id:"H2H",categories:["headToHead"],mode:"DEDICATED_SEARCH",sourceReuse:"REUSE_SOURCE_ACROSS_SUPPORTED_CATEGORIES"},{id:"PREMATCH_CONTEXT",categories:["squadAvailability","schedule","competitionContext"],mode:"BOUNDED_PARALLEL_SEARCH",sourceReuse:"REUSE_SOURCE_ACROSS_SUPPORTED_CATEGORIES"}],recovery:"TARGET_ONLY_MISSING_OR_INVALID_CATEGORIES",checkpoint:"VALIDATE_FIXTURE_ONCE_THEN_ATOMIC_ACCUMULATOR_WRITE",sourceHierarchy:["OFFICIAL","STRUCTURED_FOOTBALL_SOURCE","REPUTABLE_SPORTS_NEWS","BROAD_WEB_RECOVERY"]},researchRequirements:{overallForm:{count:5},venueForm:{count:5,homeTeam:"LAST_COMPLETED_HOME",awayTeam:"LAST_COMPLETED_AWAY"},standings:{factsOnly:true},headToHead:{count:5,verifiedRequiresExactCount:true},squadAvailability:{factsOnly:true},schedule:{factsOnly:true},competitionContext:{factsOnly:true},factsOnly:true},fixtures:queueFixtures};
const recoveryPath=path.join(ROOT,"data","recovery-requests",DATE+".json");
let priorSupersessions:any[]=[];
if(fs.existsSync(recoveryPath)){try{const prior=JSON.parse(fs.readFileSync(recoveryPath,"utf8"));if(Array.isArray(prior.priorSupersessions))priorSupersessions=prior.priorSupersessions;}catch{}}
const recovery={schema:"fih-recovery-request-v1",date:DATE,runId,researchRunId,requestedAt:now,reason:"STEP1_VERIFIED_CHATGPT_STEP2_HANDOFF",status:"CHATGPT_RESEARCH_REQUIRED",next:{fixtureId:eligible[0].id,state:"PENDING"},expectedFixtureCount:eligible.length,validatedCount:0,queuePath:`data/research-queue/${DATE}.json`,boardFetchedAt:board.fetchedAt,priorSupersessions};
for(const [rel,x] of [[`data/run-state/${DATE}.json`,ledger],[`data/research-queue/${DATE}.json`,queue],[`data/recovery-requests/${DATE}.json`,recovery]] as any){
 const p=path.join(ROOT,rel);fs.mkdirSync(path.dirname(p),{recursive:true});const t=p+".tmp";fs.writeFileSync(t,JSON.stringify(x,null,2)+"\n");fs.renameSync(t,p);const y=JSON.parse(fs.readFileSync(p,"utf8"));if(y.date!==DATE||y.researchRunId!==researchRunId)throw new Error("STEP12_PREPARE_REREAD_FAILED "+rel);
}
console.log(JSON.stringify({ok:true,date:DATE,mode:MODE,runId,researchRunId,boardTotal:fixtures.length,eligible:eligible.length,excluded:fixtures.length-eligible.length,cutoffAt,nextFixtureId:eligible[0].id},null,2));
