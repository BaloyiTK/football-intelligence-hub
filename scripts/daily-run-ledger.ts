import fs from "node:fs";
import path from "node:path";
import {validateDailyResearch} from "./research-canonical";

type State="PENDING"|"RESEARCH_VERIFIED"|"MODEL_VERIFIED"|"DECISION_VERIFIED"|"COMPLETE"|"EXCLUDED";
type Item={id:string;home:string;away:string;competition:string;kickoff:string|null;eligible:boolean;exclusionReason:string|null;state:State;updatedAt:string|null};
type RunStatus="RUNNING"|"RECOVERING"|"WAITING"|"COMPLETE";
type Ledger={schema:string;date:string;timezone:string;runId:string;runStatus:RunStatus;heartbeatAt:string;recoveryCount:number;board:{fetchedAt:string;fixtureCount:number;stageCount:number};createdAt:string;updatedAt:string;fixtures:Item[];counts:Record<string,number>;next:{fixtureId:string;state:State}|null};

const ROOT=process.env.FIH_ROOT||process.cwd(), TZ="Africa/Johannesburg";
const arg=(name:string)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined};
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const now=()=>new Date().toISOString();
const ledgerPath=(d:string)=>path.join(ROOT,"data","run-state",d+".json");
const readJson=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
function eventId(e:any,s:any){return String(e?.Eid??e?.Id??[s?.CompId,e?.T1?.[0]?.Nm,e?.T2?.[0]?.Nm,e?.Esd].filter(Boolean).join(":"))}
function name(x:any){return String(x?.[0]?.Nm??x?.[0]?.name??"UNKNOWN")}
function kickoff(e:any){const raw=e?.Esd??e?.Epsd??e?.startTime??null;return raw==null?null:String(raw)}
function exclusion(e:any,s:any){const status=String(e?.Eps??"").toUpperCase();if(status!=="NS")return "NOT_PREMATCH";const text=[s?.CompN,s?.Snm,s?.Cnm,e?.T1?.[0]?.Nm,e?.T2?.[0]?.Nm].filter(Boolean).join(" ").toLowerCase();if(/women|\bw\b/.test(text))return "WOMEN";if(/\bu[- ]?\d{2}\b|under[- ]?\d{2}|youth/.test(text))return "YOUTH";const teams=[e?.T1?.[0]?.Nm,e?.T2?.[0]?.Nm].filter(Boolean).join(" ").toLowerCase();if(/reserve|reserves|\bu23\b|\bu21\b|\bu20\b|\bu19\b|\bu18\b|\bu17\b|\bii\b|(?:^|\s)2$/.test(teams))return "RESERVE_OR_DEVELOPMENT";if(/university|academia|academy|akatemia|juniors?/.test(text))return "NON_SENIOR";return null}
function counts(items:Item[]){const out:any={boardTotal:items.length,eligible:0,excluded:0,PENDING:0,RESEARCH_VERIFIED:0,MODEL_VERIFIED:0,DECISION_VERIFIED:0,COMPLETE:0,EXCLUDED:0};for(const x of items){if(x.eligible)out.eligible++;else out.excluded++;out[x.state]=(out[x.state]||0)+1}return out}
function next(items:Item[]){const x=items.find(f=>f.eligible&&f.state!=="COMPLETE");return x?{fixtureId:x.id,state:x.state}:null}
function board(d:string){
 const todayDate=today();
 const candidates=d===todayDate
  ? [path.join(ROOT,"data","today_fixture.json"),path.join(ROOT,"data","prediction-fixtures",d+".json")]
  : [path.join(ROOT,"data","prediction-fixtures",d+".json")];
 const p=candidates.find(x=>fs.existsSync(x));
 if(!p)throw new Error("MISSING prediction fixture board for "+d);
 const x=readJson(p);
 const validSchema=x.schema==="fih-today-fixture-v1"||x.schema==="fih-prediction-fixture-v1";
 if(!validSchema||x.date!==d||x.timezone!==TZ)throw new Error("fixture board date/schema/timezone invalid");const stages=Array.isArray(x.payload?.Stages)?x.payload.Stages:[];const events=stages.flatMap((s:any)=>(Array.isArray(s.Events)?s.Events:[]).map((e:any)=>({e,s})));if(!events.length||events.length!==x.fixtureCount)throw new Error("fixture board count mismatch");return {x,events}}
function dailyHas(d:string,kind:"research"|"model"|"decisions",id:string){const p=path.join(ROOT,"data",kind,d+".json");if(!validArtifact(p))return false;const x=readJson(p);if(kind==="research"){try{const l=fs.existsSync(ledgerPath(d))?readJson(ledgerPath(d)):null;const ids=l?.fixtures?.filter((f:any)=>f.eligible).map((f:any)=>String(f.id))||x.fixtures?.map((r:any)=>String(r.fixtureId))||[];validateDailyResearch(ROOT,d,ids,"PREDICTION")}catch{return false}}return Array.isArray(x.fixtures)&&x.fixtures.some((r:any)=>String(r.fixtureId)===id)}
function inferredState(d:string,id:string):State{
 const has=(s:State)=>artifactCandidates(d,id,s).some(p=>validArtifact(path.join(ROOT,p)));
 const research=dailyHas(d,"research",id),model=dailyHas(d,"model",id),decision=dailyHas(d,"decisions",id);
 if(decision&&model&&research)return "COMPLETE";
 if(model&&research)return "MODEL_VERIFIED";
 if(research)return "RESEARCH_VERIFIED";
 return "PENDING";
}
function init(d:string){const {x,events}=board(d),p=ledgerPath(d);fs.mkdirSync(path.dirname(p),{recursive:true});let old:Ledger|null=null;if(fs.existsSync(p)){try{old=readJson(p)}catch{}}
 const oldMap=new Map((old?.fixtures||[]).map(f=>[f.id,f]));const fixtures:Item[]=events.map(({e,s}:any)=>{const id=eventId(e,s),o=oldMap.get(id);const reason=exclusion(e,s),eligible=!reason,oldState=o?.state;const inferred=eligible?inferredState(d,id):"EXCLUDED";const order:State[]=["PENDING","RESEARCH_VERIFIED","MODEL_VERIFIED","DECISION_VERIFIED","COMPLETE"];const state:State=eligible?inferred:"EXCLUDED";return {id,home:name(e.T1),away:name(e.T2),competition:String(s?.CompN??s?.Snm??"UNKNOWN"),kickoff:kickoff(e),eligible,exclusionReason:reason,state,updatedAt:o?.updatedAt??null}});
 const ts=now();const out:Ledger={schema:"fih-daily-run-ledger-v1",date:d,timezone:TZ,runId:old?.runId??("daily:"+d),runStatus:next(fixtures) ? (old?"RECOVERING":"RUNNING") : "COMPLETE",heartbeatAt:ts,recoveryCount:(old?.recoveryCount??0)+(old&&old.runStatus!=="COMPLETE"?1:0),board:{fetchedAt:x.fetchedAt,fixtureCount:x.fixtureCount,stageCount:x.stageCount},createdAt:old?.createdAt??ts,updatedAt:ts,fixtures,counts:counts(fixtures),next:next(fixtures)};fs.writeFileSync(p,JSON.stringify(out,null,2)+"\n");return out}
function verify(d:string){const {x,events}=board(d),p=ledgerPath(d);if(!fs.existsSync(p))throw new Error("MISSING run ledger");const l:Ledger=readJson(p);if(l.schema!=="fih-daily-run-ledger-v1"||l.date!==d||l.timezone!==TZ)throw new Error("ledger identity invalid");const ids=new Set(events.map(({e,s}:any)=>eventId(e,s)));if(l.fixtures.length!==ids.size||l.board.fixtureCount!==x.fixtureCount)throw new Error("ledger/board fixture count mismatch");if(!l.runId||!l.runStatus||!l.heartbeatAt)throw new Error("ledger reliability metadata missing");for(const f of l.fixtures){if(!ids.has(f.id))throw new Error("orphan ledger fixture "+f.id);if(f.eligible&&f.state==="EXCLUDED")throw new Error("eligible fixture incorrectly excluded "+f.id);if(!f.eligible&&f.state!=="EXCLUDED")throw new Error("excluded fixture has active state "+f.id)}const c=counts(l.fixtures);for(const k of Object.keys(c))if(c[k]!==l.counts[k])throw new Error("ledger count mismatch "+k);return l}
function artifactCandidates(d:string,id:string,to:State){const m:Record<string,string[]>={RESEARCH_VERIFIED:[`data/research/${d}.json`],MODEL_VERIFIED:[`data/model/${d}.json`],DECISION_VERIFIED:[`data/decisions/${d}.json`]};return m[to]||[]}
function validArtifact(p:string){if(!fs.existsSync(p))return false;try{const x=readJson(p);return x&&typeof x==="object"&&Object.keys(x).length>0}catch{return false}}
function requireArtifact(d:string,id:string,to:State){if(to==="PENDING"||to==="COMPLETE")return;const c=artifactCandidates(d,id,to);if(!c.some(p=>{const full=path.join(ROOT,p);if(!validArtifact(full))return false;if(to==="RESEARCH_VERIFIED"||to==="MODEL_VERIFIED"||to==="DECISION_VERIFIED"){const x=readJson(full);return Array.isArray(x.fixtures)&&x.fixtures.some((r:any)=>String(r.fixtureId)===id)}return true}))throw new Error("canonical artifact missing/invalid for "+to+" fixture "+id)}
function advance(d:string){const id=arg("--fixture"),to=arg("--to") as State;if(!id||!to)throw new Error("advance requires --fixture ID --to STATE");const order:State[]=["PENDING","RESEARCH_VERIFIED","MODEL_VERIFIED","DECISION_VERIFIED","COMPLETE"];if(!order.includes(to))throw new Error("invalid state");const l=verify(d),f=l.fixtures.find(x=>x.id===id);if(!f)throw new Error("fixture not in authoritative board");if(!f.eligible||f.state==="EXCLUDED")throw new Error("excluded fixture cannot advance");const fromIndex=order.indexOf(f.state),toIndex=order.indexOf(to);if(toIndex<fromIndex)throw new Error("state regression refused");if(toIndex>fromIndex+1)throw new Error("state skipping refused: "+f.state+" -> "+to);requireArtifact(d,id,to);if(to==="COMPLETE"&&f.state!=="DECISION_VERIFIED")throw new Error("COMPLETE requires DECISION_VERIFIED");f.state=to;f.updatedAt=now();l.updatedAt=now();l.heartbeatAt=l.updatedAt;l.counts=counts(l.fixtures);l.next=next(l.fixtures);l.runStatus=l.next?"RUNNING":"COMPLETE";fs.writeFileSync(ledgerPath(d),JSON.stringify(l,null,2)+"\n");return l}
const cmd=process.argv[2]||"verify",d=arg("--date")||today();let result:any;
if(cmd==="init"||cmd==="reconcile")result=init(d);
else if(cmd==="verify")result=verify(d);
else if(cmd==="advance")result=advance(d);
else throw new Error("unknown command "+cmd);
console.log(JSON.stringify({ok:true,command:cmd,date:d,runId:result.runId,runStatus:result.runStatus,heartbeatAt:result.heartbeatAt,recoveryCount:result.recoveryCount,counts:result.counts,next:result.next},null,2));