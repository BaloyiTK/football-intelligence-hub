import fs from "node:fs";
import path from "node:path";
import {REQUIRED,validateResearchArtifact} from "./research-canonical";

const ROOT=process.env.FIH_ROOT||process.cwd();
const BASE="https://api.sofascore.com/api/v1";
const arg=(n:string)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:undefined};
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const DATE=arg("--date")||process.env.FIH_DATE||today();
const qp=path.join(ROOT,"data/research-queue",DATE+".json");
const pp=path.join(ROOT,"data/research-prefill",DATE+".json");
const gp=path.join(ROOT,"data/research-gap-queue",DATE+".json");
if(!fs.existsSync(qp)||!fs.existsSync(pp))throw new Error("SOFASCORE_PREFILL_INPUT_MISSING");
const queue=JSON.parse(fs.readFileSync(qp,"utf8")),prefill=JSON.parse(fs.readFileSync(pp,"utf8"));
if(queue.date!==DATE||queue.mode!=="PREDICTION"||prefill.researchRunId!==queue.researchRunId||!Array.isArray(queue.fixtures)||!Array.isArray(prefill.fixtures))throw new Error("SOFASCORE_PREFILL_IDENTITY_INVALID");

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const norm=(s:string)=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/\b(fc|cf|afc|sc|club|fk|ac|cd|ud|sk)\b/g," ").replace(/[^a-z0-9]+/g," ").trim();
function sim(a:string,b:string){const A=new Set(norm(a).split(" ").filter(Boolean)),B=new Set(norm(b).split(" ").filter(Boolean));if(!A.size||!B.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return 2*n/(A.size+B.size)}
async function getJson(url:string){
 let last:any;
 const candidates=[url,...(url.startsWith("https://api.sofascore.com/")?[url.replace("https://api.sofascore.com/","https://www.sofascore.com/")]:[])];
 for(const candidate of candidates){
  for(let i=1;i<=3;i++){
   const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);
   try{
    const r=await fetch(candidate,{signal:c.signal,headers:{accept:"application/json","accept-language":"en-US,en;q=0.9","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",referer:"https://www.sofascore.com/"}});
    if(r.ok)return {url:candidate,json:await r.json(),retrievedAt:new Date().toISOString()};
    last=new Error("HTTP_"+r.status);
    if(r.status===401||r.status===403||r.status===404)break;
    if(r.status!==429&&r.status<500)break;
   }catch(e){last=e}finally{clearTimeout(t)}
   await sleep(400*i);
  }
 }
 throw new Error("SOFASCORE_FETCH_FAILED "+url+" "+String(last?.message||last));
}
const cache=new Map<string,Promise<any>>();
const cached=(k:string,fn:()=>Promise<any>)=>{if(!cache.has(k))cache.set(k,fn());return cache.get(k)!};
const uniq=(xs:any[])=>[...new Set(xs.filter((x:any)=>typeof x==="string"&&x))];
const meta=(url:string,retrievedAt:string,supports:string[])=>({url,retrievedAt,supports});
const dedupeMeta=(xs:any[])=>[...new Map(xs.map((x:any)=>[String(x.url),x])).values()];
const attempt=(q:string)=>[{query:q,attemptedAt:new Date().toISOString(),outcome:"SOFASCORE_PUBLIC_SOURCE_FACTS_VERIFIED"}];
const tname=(t:any)=>String(t?.name||t?.shortName||"");
const finished=(e:any)=>["finished","afterpenalties","afterextra"].includes(String(e?.status?.type||"").toLowerCase());
const score=(e:any,k:"home"|"away")=>{const s=k==="home"?e?.homeScore:e?.awayScore,n=Number(s?.current??s?.normaltime);return Number.isFinite(n)?n:null};
const date=(e:any)=>Number.isFinite(Number(e?.startTimestamp))?new Date(Number(e.startTimestamp)*1000).toISOString():null;
function fixtureKickoffMs(raw:any){
 const s=String(raw||"");if(!/^\\d{14}$/.test(s))return null;
 const iso=s.slice(0,4)+"-"+s.slice(4,6)+"-"+s.slice(6,8)+"T"+s.slice(8,10)+":"+s.slice(10,12)+":"+s.slice(12,14)+"+02:00";
 const n=new Date(iso).getTime();return Number.isFinite(n)?n:null;
}
function matchEvent(f:any,events:any[]){
 let best:any=null,bestScore=0;const wantedKickoff=fixtureKickoffMs(f.kickoff);
 for(const e of events){
  const eventKickoff=Number(e?.startTimestamp)*1000;
  if(wantedKickoff!==null&&Number.isFinite(eventKickoff)&&Math.abs(eventKickoff-wantedKickoff)>120*60*1000)continue;
  const h=sim(f.home,tname(e.homeTeam)),a=sim(f.away,tname(e.awayTeam)),s=(h+a)/2;
  if(h>=.55&&a>=.55&&s>bestScore){best=e;bestScore=s}
 }
 return best?{event:best,score:Number(bestScore.toFixed(3))}:null;
}
function formRow(e:any,id:string){
 if(!finished(e))return null;const hi=String(e?.homeTeam?.id||""),ai=String(e?.awayTeam?.id||"");if(id!==hi&&id!==ai)return null;
 const home=id===hi,hg=score(e,"home"),ag=score(e,"away"),d=date(e),sourceRef=String(e.__sourceUrl||"");if(hg===null||ag===null||!d||!sourceRef)return null;
 return {date:d,opponent:tname(home?e.awayTeam:e.homeTeam),venue:home?"HOME":"AWAY",goalsFor:home?hg:ag,goalsAgainst:home?ag:hg,sourceRef};
}
function recent(events:any[],id:string,venue?:string){
 const out:any[]=[],seen=new Set<string>();for(const e of [...events].sort((a,b)=>Number(b.startTimestamp||0)-Number(a.startTimestamp||0))){const r=formRow(e,id);if(!r||venue&&r.venue!==venue)continue;const k=[r.date,r.opponent,r.venue,r.goalsFor,r.goalsAgainst].join("|");if(seen.has(k))continue;seen.add(k);out.push(r);if(out.length===5)break}return out;
}
async function history(id:string,errors:string[]){
 const events:any[]=[],metadata:any[]=[];
 for(let p=0;p<6;p++){const url=BASE+"/team/"+id+"/events/last/"+p;try{const r=await cached("team:"+id+":"+p,()=>getJson(url)),rows=Array.isArray(r.json?.events)?r.json.events:[];if(rows.length)metadata.push(meta(r.url,r.retrievedAt,["form","schedule"]));for(const e of rows)events.push({...e,__sourceUrl:r.url});if(recent(events,id).length===5&&recent(events,id,"HOME").length===5&&recent(events,id,"AWAY").length===5)break;if(!r.json?.hasNextPage)break}catch(e:any){errors.push("team:"+id+":"+String(e?.message||e));break}}
 return {events,metadata};
}
async function h2h(eventId:string,errors:string[]){
 const url=BASE+"/event/"+eventId+"/h2h/events";try{const r=await cached("h2h:"+eventId,()=>getJson(url)),rows:any[]=[],seen=new Set<string>();for(const e0 of (Array.isArray(r.json?.events)?r.json.events:[])){const e={...e0,__sourceUrl:url};if(!finished(e))continue;const hg=score(e,"home"),ag=score(e,"away"),d=date(e);if(hg===null||ag===null||!d)continue;const x={date:d,homeTeam:tname(e.homeTeam),awayTeam:tname(e.awayTeam),homeGoals:hg,awayGoals:ag,sourceRef:r.url},k=[x.date,x.homeTeam,x.awayTeam,x.homeGoals,x.awayGoals].join("|");if(seen.has(k))continue;seen.add(k);rows.push(x);if(rows.length===5)break}return {rows,metadata:[meta(r.url,r.retrievedAt,["headToHead"])]}}catch(e:any){errors.push("h2h:"+String(e?.message||e));return {rows:[],metadata:[]}}
}
function standing(payload:any,id:string){
 const groups=Array.isArray(payload?.standings)?payload.standings:[],rows=groups.flatMap((g:any)=>Array.isArray(g?.rows)?g.rows:[]),r=rows.find((x:any)=>String(x?.team?.id||"")===id);if(!r)return null;
 const n=(v:any)=>Number.isFinite(Number(v))?Number(v):null,gf=n(r.scoresFor??r.goalsFor),ga=n(r.scoresAgainst??r.goalsAgainst);
 return {position:n(r.position),matches:n(r.matches??r.matchesPlayed),wins:n(r.wins),draws:n(r.draws),losses:n(r.losses),points:n(r.points),goalsFor:gf,goalsAgainst:ga,goalDifference:n(r.scoreDiff??r.goalDifference)??(gf!==null&&ga!==null?gf-ga:null)};
}
const standingOk=(r:any)=>r&&Number.isFinite(Number(r.position))&&Number(r.position)>=1&&Number.isFinite(Number(r.matches))&&Number(r.matches)>=1&&Number.isFinite(Number(r.points));
async function standings(e:any,hi:string,ai:string,errors:string[]){
 const sid=String(e?.season?.id||""),uid=String(e?.tournament?.uniqueTournament?.id||""),tid=String(e?.tournament?.id||"");
 for(const url of [uid&&sid?BASE+"/unique-tournament/"+uid+"/season/"+sid+"/standings/total":"",tid&&sid?BASE+"/tournament/"+tid+"/season/"+sid+"/standings/total":""].filter(Boolean)){try{const r=await cached("st:"+url,()=>getJson(url)),home=standing(r.json,hi),away=standing(r.json,ai);if(standingOk(home)&&standingOk(away))return {home,away,metadata:[meta(r.url,r.retrievedAt,["standings"])]}}catch(err:any){errors.push("standings:"+String(err?.message||err))}}
 return {home:null,away:null,metadata:[]};
}
function baseRecord(item:any,f:any){const r=item?.prefillRecord&&item.prefillRecord.researchRunId===queue.researchRunId?JSON.parse(JSON.stringify(item.prefillRecord)):{fixtureId:String(f.fixtureId),researchedAt:new Date().toISOString(),researchRunId:queue.researchRunId,sourceMetadata:[],facts:{}};r.fixture={home:f.home,away:f.away,competition:f.competition,kickoff:f.kickoff};r.sourceMetadata=Array.isArray(r.sourceMetadata)?r.sourceMetadata:[];r.facts=r.facts||{};return r}
async function augment(item:any,f:any,events:any[],scoreMeta:any){
 if(item.validatedRecord)return item;const m=matchEvent(f,events),complete=new Set<string>(item.completeCategories||[]),r=baseRecord(item,f),errors=[...(item.errors||[])];if(!m)return {...item,prefillRecord:r,errors:[...errors,"SOFASCORE_FIXTURE_NOT_MATCHED"]};
 const e=m.event,hi=String(e.homeTeam?.id||""),ai=String(e.awayTeam?.id||""),eid=String(e.id||""),missing=REQUIRED.filter(k=>!complete.has(k)),metadata:any[]=[];
 let hh:any=null,ah:any=null;
 if(missing.includes("form")||missing.includes("schedule")){[hh,ah]=await Promise.all([history(hi,errors),history(ai,errors)]);metadata.push(...hh.metadata,...ah.metadata)}
 if(missing.includes("form")&&hh&&ah){const ho=recent(hh.events,hi),hv=recent(hh.events,hi,"HOME"),ao=recent(ah.events,ai),av=recent(ah.events,ai,"AWAY");if(ho.length===5&&hv.length===5&&ao.length===5&&av.length===5){r.facts.form={status:"VERIFIED",data:{homeTeam:{overallLast5:ho,homeLast5:hv},awayTeam:{overallLast5:ao,awayLast5:av}},sourceRefs:uniq([...ho,...hv,...ao,...av].map((x:any)=>x.sourceRef)),attempts:attempt(f.home+" "+f.away+" last five overall and venue form")};complete.add("form")}}
 if(missing.includes("schedule")&&hh&&ah){const ho=recent(hh.events,hi),ao=recent(ah.events,ai);if(ho[0]?.date&&ao[0]?.date){r.facts.schedule={status:"VERIFIED",data:{homeTeam:{latestCompletedMatchDate:ho[0].date},awayTeam:{latestCompletedMatchDate:ao[0].date}},sourceRefs:uniq([ho[0].sourceRef,ao[0].sourceRef]),attempts:attempt(f.home+" "+f.away+" recent schedule")};complete.add("schedule")}}
 if(missing.includes("headToHead")){const x=await h2h(eid,errors);metadata.push(...x.metadata);if(x.rows.length===5){r.facts.headToHead={status:"VERIFIED",data:{matches:x.rows},sourceRefs:uniq(x.rows.map((z:any)=>z.sourceRef)),attempts:attempt(f.home+" vs "+f.away+" exact last five head to head")};complete.add("headToHead")}}
 if(missing.includes("standings")){const x=await standings(e,hi,ai,errors);metadata.push(...x.metadata);if(standingOk(x.home)&&standingOk(x.away)){r.facts.standings={status:"VERIFIED",data:{homeTeam:x.home,awayTeam:x.away},sourceRefs:uniq(x.metadata.map((z:any)=>z.url)),attempts:attempt(f.competition+" current standings")};complete.add("standings")}}
 metadata.push(meta(scoreMeta.url,scoreMeta.retrievedAt,["fixtureMatch"]));r.sourceMetadata=dedupeMeta([...r.sourceMetadata,...metadata]);r.researchedAt=new Date().toISOString();
 const completeCategories=REQUIRED.filter(k=>complete.has(k));let validatedRecord:any=null;
 if(completeCategories.length===REQUIRED.length){try{validateResearchArtifact({schema:"fih-daily-research-v5",date:DATE,mode:"PREDICTION",generatedAt:new Date().toISOString(),researchRunId:queue.researchRunId,fixtures:[r]},DATE,[String(f.fixtureId)],"PREDICTION");validatedRecord=r}catch(err:any){errors.push("SOFASCORE_CANONICAL_REJECTED:"+String(err?.message||err))}}
 const unresolved=REQUIRED.filter(k=>!complete.has(k));return {...item,matched:true,matchConfidence:Math.max(Number(item.matchConfidence||0),m.score),providerEventId:eid,completeCategories,missingCategories:validatedRecord?[]:(unresolved.length?unresolved:[...REQUIRED]),validatedRecord,prefillRecord:r,errors};
}
function write(p:string,x:any){fs.mkdirSync(path.dirname(p),{recursive:true});const t=p+".tmp";fs.writeFileSync(t,JSON.stringify(x,null,2)+"\n");fs.renameSync(t,p);JSON.parse(fs.readFileSync(p,"utf8"))}
async function main(){
 const scoreUrl=BASE+"/sport/football/scheduled-events/"+DATE,scoreMeta=await getJson(scoreUrl),events=Array.isArray(scoreMeta.json?.events)?scoreMeta.json.events:[],byId=new Map<string,any>(queue.fixtures.map((f:any)=>[String(f.fixtureId),f])),results:any[]=[];
 for(const item of prefill.fixtures){const f=byId.get(String(item.fixtureId));if(!f)throw new Error("SOFASCORE_ORPHAN_FIXTURE "+item.fixtureId);results.push(await augment(item,f,events,scoreMeta));await sleep(50)}
 const gaps=results.filter((x:any)=>!x.validatedRecord).map((x:any)=>{const f=byId.get(String(x.fixtureId));return {fixtureId:String(x.fixtureId),home:f.home,away:f.away,competition:f.competition,kickoff:f.kickoff,missingCategories:x.missingCategories,prefillAvailable:(x.completeCategories||[]).length>0}});
 const full=results.filter((x:any)=>x.validatedRecord).length,anyUseful=results.filter((x:any)=>(x.completeCategories||[]).length>0).length,categoryComplete=Object.fromEntries(REQUIRED.map(k=>[k,results.filter((x:any)=>x.completeCategories?.includes(k)).length])),generatedAt=new Date().toISOString();
 const out={...prefill,generatedAt,provider:"ESPN_PUBLIC_JSON+SOFASCORE_PUBLIC_JSON",purpose:"DETERMINISTIC_MULTI_SOURCE_PREFILL_ONLY",summary:{...(prefill.summary||{}),fixturesWithAnyCompleteCategory:anyUseful,fullyValidatedFixtures:full,gapFixtures:gaps.length,categoryComplete,sofascore:{scheduledEventCount:events.length,matched:results.filter((x:any)=>x.providerEventId).length,cacheEntries:cache.size}},fixtures:results};
 const gap={schema:"fih-chatgpt-gap-queue-v1",date:DATE,mode:"PREDICTION",researchRunId:queue.researchRunId,generatedAt,count:gaps.length,sourcePrefillPath:"data/research-prefill/"+DATE+".json",fixtures:gaps};write(pp,out);write(gp,gap);
 const rp=path.join(ROOT,"data/recovery-requests",DATE+".json");if(fs.existsSync(rp)){const x=JSON.parse(fs.readFileSync(rp,"utf8"));x.reason=gaps.length?"HYBRID_MULTI_SOURCE_PREFILL_COMPLETE_CHATGPT_GAP_RESEARCH_REQUIRED":"HYBRID_MULTI_SOURCE_PREFILL_COMPLETE_PROMOTION_REQUIRED";x.status="CHATGPT_RESEARCH_REQUIRED";x.prefilledFixtureCount=full;x.gapFixtureCount=gaps.length;x.updatedAt=generatedAt;write(rp,x)}
 console.log(JSON.stringify({ok:true,date:DATE,researchRunId:queue.researchRunId,fullyValidated:full,gaps:gaps.length,sofaMatched:out.summary.sofascore.matched,categoryComplete,cacheEntries:cache.size},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
