import fs from "node:fs";
import path from "node:path";
import {REQUIRED,validateResearchArtifact} from "./research-canonical";

const ROOT=process.env.FIH_ROOT||process.cwd();
const BASE="https://www.fotmob.com/api/data";
const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const arg=(n:string)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:undefined};
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const DATE=arg("--date")||process.env.FIH_DATE||today();
const qp=path.join(ROOT,"data/research-queue",DATE+".json");
const pp=path.join(ROOT,"data/research-prefill",DATE+".json");
const gp=path.join(ROOT,"data/research-gap-queue",DATE+".json");
if(!fs.existsSync(qp)||!fs.existsSync(pp))throw new Error("FOTMOB_PREFILL_INPUT_MISSING");
const queue=JSON.parse(fs.readFileSync(qp,"utf8")),prefill=JSON.parse(fs.readFileSync(pp,"utf8"));
if(queue.date!==DATE||queue.mode!=="PREDICTION"||prefill.researchRunId!==queue.researchRunId||!Array.isArray(queue.fixtures)||!Array.isArray(prefill.fixtures))throw new Error("FOTMOB_PREFILL_IDENTITY_INVALID");

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const norm=(s:string)=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/\b(fc|cf|afc|sc|club|fk|ac|cd|ud|sk)\b/g," ").replace(/[^a-z0-9]+/g," ").trim();
function sim(a:string,b:string){const A=new Set(norm(a).split(" ").filter(Boolean)),B=new Set(norm(b).split(" ").filter(Boolean));if(!A.size||!B.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return 2*n/(A.size+B.size)}
function fixtureKickoffMs(raw:any){const s=String(raw||"");if(!/^\d{14}$/.test(s))return null;const iso=s.slice(0,4)+"-"+s.slice(4,6)+"-"+s.slice(6,8)+"T"+s.slice(8,10)+":"+s.slice(10,12)+":"+s.slice(12,14)+"+02:00";const n=new Date(iso).getTime();return Number.isFinite(n)?n:null}
async function getJson(url:string){
 let last:any;
 for(let i=1;i<=3;i++){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);
  try{
   const r=await fetch(url,{signal:c.signal,headers:{accept:"application/json","user-agent":UA}});
   const ct=String(r.headers.get("content-type")||"");
   if(r.ok&&ct.includes("json"))return {url,json:await r.json(),retrievedAt:new Date().toISOString()};
   last=new Error("HTTP_"+r.status+"_"+ct);
   if(r.status>=400&&r.status<500&&r.status!==429)break;
  }catch(e){last=e}finally{clearTimeout(t)}
  await sleep(350*i);
 }
 throw new Error("FOTMOB_FETCH_FAILED "+url+" "+String(last?.message||last));
}
const cache=new Map<string,Promise<any>>();
const cached=(k:string,fn:()=>Promise<any>)=>{if(!cache.has(k))cache.set(k,fn());return cache.get(k)!};
const uniq=(xs:any[])=>[...new Set(xs.filter((x:any)=>typeof x==="string"&&x))];
const meta=(url:string,retrievedAt:string,supports:string[])=>({url,retrievedAt,supports});
const dedupeMeta=(xs:any[])=>[...new Map(xs.map((x:any)=>[String(x.url),x])).values()];
const attempt=(q:string)=>[{query:q,attemptedAt:new Date().toISOString(),outcome:"FOTMOB_PUBLIC_SOURCE_FACTS_VERIFIED"}];

function flattenBoard(j:any){
 const out:any[]=[];
 for(const l of (Array.isArray(j?.leagues)?j.leagues:[]))for(const m of (Array.isArray(l?.matches)?l.matches:[]))out.push({...m,__league:l});
 return out;
}
function matchEvent(f:any,events:any[]){
 let best:any=null,bestScore=0;const wanted=fixtureKickoffMs(f.kickoff);
 for(const e of events){
  const eventKickoff=Number(e?.timeTS)||new Date(e?.status?.utcTime||0).getTime();
  if(wanted!==null&&Number.isFinite(eventKickoff)&&Math.abs(eventKickoff-wanted)>120*60*1000)continue;
  const h=sim(f.home,String(e?.home?.longName||e?.home?.name||"")),a=sim(f.away,String(e?.away?.longName||e?.away?.name||"")),s=(h+a)/2;
  if(h>=.55&&a>=.55&&s>bestScore){best=e;bestScore=s}
 }
 return best?{event:best,score:Number(bestScore.toFixed(3))}:null;
}
function scorePair(x:any){
 const h=Number(x?.home?.score),a=Number(x?.away?.score);
 if(Number.isFinite(h)&&Number.isFinite(a))return [h,a];
 const z=String(x?.status?.scoreStr||"").match(/(-?\d+)\s*-\s*(-?\d+)/);return z?[Number(z[1]),Number(z[2])]:[null,null];
}
function formRow(e:any,id:string,sourceRef:string){
 if(e?.status?.finished!==true||e?.status?.cancelled===true)return null;
 const hi=String(e?.home?.id||""),ai=String(e?.away?.id||"");if(id!==hi&&id!==ai)return null;
 const [hg,ag]=scorePair(e),d=String(e?.status?.utcTime||"");if(hg===null||ag===null||!d)return null;
 const home=id===hi;
 return {date:new Date(d).toISOString(),opponent:String((home?e?.away:e?.home)?.name||""),venue:home?"HOME":"AWAY",goalsFor:home?hg:ag,goalsAgainst:home?ag:hg,sourceRef};
}
function recent(items:{event:any,sourceRef:string}[],id:string,venue?:string){
 const out:any[]=[],seen=new Set<string>();
 for(const x of [...items].sort((a,b)=>new Date(b.event?.status?.utcTime||0).getTime()-new Date(a.event?.status?.utcTime||0).getTime())){
  const r=formRow(x.event,id,x.sourceRef);if(!r||venue&&r.venue!==venue)continue;
  const k=[r.date,r.opponent,r.venue,r.goalsFor,r.goalsAgainst].join("|");if(seen.has(k))continue;seen.add(k);out.push(r);if(out.length===5)break;
 }
 return out;
}
function extractFixtureRows(j:any){
 if(Array.isArray(j))return j;
 for(const candidate of [j?.fixtures,j?.allFixtures?.fixtures,j?.data?.fixtures,j?.matches])if(Array.isArray(candidate))return candidate;
 return [];
}
async function teamHistory(id:string,errors:string[]){
 const url=BASE+"/teams?id="+encodeURIComponent(id);
 try{
  const r=await cached("team:"+id,()=>getJson(url)),items:{event:any,sourceRef:string}[]=[],metadata:any[]=[];
  const rows=extractFixtureRows(r.json?.fixtures?.allFixtures||r.json?.fixtures);
  if(rows.length)metadata.push(meta(r.url,r.retrievedAt,["form","schedule"]));
  for(const e of rows)items.push({event:e,sourceRef:r.url});
  let next=String(r.json?.fixtures?.previousFixturesUrl||r.json?.overview?.previousFixturesUrl||"");
  for(let page=0;page<3&&(recent(items,id).length<5||recent(items,id,"HOME").length<5||recent(items,id,"AWAY").length<5)&&next;page++){
   try{
    const p=await cached("prev:"+next,()=>getJson(next)),more=extractFixtureRows(p.json);
    if(more.length)metadata.push(meta(p.url,p.retrievedAt,["form","schedule"]));
    for(const e of more)items.push({event:e,sourceRef:p.url});
    next=String(p.json?.previousFixturesUrl||p.json?.nextPage||"");
   }catch(e:any){errors.push("team-history-page:"+id+":"+String(e?.message||e));break}
  }
  return {items,metadata};
 }catch(e:any){errors.push("team:"+id+":"+String(e?.message||e));return {items:[],metadata:[]}}
}
async function h2h(matchId:string,errors:string[]){
 const url=BASE+"/matchDetails?matchId="+encodeURIComponent(matchId);
 try{
  const r=await cached("match:"+matchId,()=>getJson(url)),rows:any[]=[],seen=new Set<string>(),raw=Array.isArray(r.json?.content?.h2h?.matches)?r.json.content.h2h.matches:[];
  for(const x of raw){
   if(x?.status?.finished!==true||x?.status?.cancelled===true)continue;
   const h=Number(x?.home?.score),a=Number(x?.away?.score),z=String(x?.status?.scoreStr||"").match(/(-?\d+)\s*-\s*(-?\d+)/),hg=Number.isFinite(h)?h:(z?Number(z[1]):null),ag=Number.isFinite(a)?a:(z?Number(z[2]):null);
   const d=String(x?.time?.utcTime||x?.status?.utcTime||"");if(hg===null||ag===null||!d)continue;
   const row={date:new Date(d).toISOString(),homeTeam:String(x?.home?.name||""),awayTeam:String(x?.away?.name||""),homeGoals:hg,awayGoals:ag,sourceRef:r.url},k=[row.date,row.homeTeam,row.awayTeam,row.homeGoals,row.awayGoals].join("|");
   if(seen.has(k))continue;seen.add(k);rows.push(row);
  }
  rows.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());
  return {rows:rows.slice(0,5),metadata:[meta(r.url,r.retrievedAt,["headToHead"])]};
 }catch(e:any){errors.push("h2h:"+String(e?.message||e));return {rows:[],metadata:[]}}
}
function standingFromGroups(groups:any,id:string){
 for(const g of (Array.isArray(groups)?groups:[])){
  const tables=[g?.data?.table?.all,...(Array.isArray(g?.data?.tables)?g.data.tables.map((x:any)=>x?.table?.all):[])].filter(Array.isArray);
  for(const rows of tables){
   const r=rows.find((x:any)=>String(x?.id||x?.team?.id||"")===id);if(!r)continue;
   const n=(v:any)=>Number.isFinite(Number(v))?Number(v):null,parts=String(r?.scoresStr||"").match(/(\d+)\s*-\s*(\d+)/),gf=parts?Number(parts[1]):n(r?.goalsFor),ga=parts?Number(parts[2]):n(r?.goalsAgainst);
   return {position:n(r?.idx??r?.position),matches:n(r?.played??r?.matches),wins:n(r?.wins),draws:n(r?.draws),losses:n(r?.losses),points:n(r?.pts??r?.points),goalsFor:gf,goalsAgainst:ga,goalDifference:n(r?.goalConDiff??r?.goalDifference)??(gf!==null&&ga!==null?gf-ga:null)};
  }
 }
 return null;
}
const standingOk=(r:any)=>r&&Number.isFinite(Number(r.position))&&Number(r.position)>=1&&Number.isFinite(Number(r.matches))&&Number(r.matches)>=1&&Number.isFinite(Number(r.points));
async function standings(leagueId:string,hi:string,ai:string,errors:string[]){
 const url=BASE+"/tltable?leagueId="+encodeURIComponent(leagueId);
 try{
  const r=await cached("table:"+leagueId,()=>getJson(url)),home=standingFromGroups(r.json,hi),away=standingFromGroups(r.json,ai);
  return {home,away,metadata:[meta(r.url,r.retrievedAt,["standings"])]};
 }catch(e:any){errors.push("standings:"+String(e?.message||e));return {home:null,away:null,metadata:[]}}
}
function baseRecord(item:any,f:any){
 const r=item?.prefillRecord&&item.prefillRecord.researchRunId===queue.researchRunId?JSON.parse(JSON.stringify(item.prefillRecord)):{fixtureId:String(f.fixtureId),researchedAt:new Date().toISOString(),researchRunId:queue.researchRunId,sourceMetadata:[],facts:{}};
 r.fixture={home:f.home,away:f.away,competition:f.competition,kickoff:f.kickoff};r.sourceMetadata=Array.isArray(r.sourceMetadata)?r.sourceMetadata:[];r.facts=r.facts||{};return r;
}
async function augment(item:any,f:any,events:any[],boardMeta:any){
 if(item.validatedRecord)return item;
 const m=matchEvent(f,events),complete=new Set<string>(item.completeCategories||[]),r=baseRecord(item,f),errors=[...(item.errors||[])];
 if(!m)return {...item,prefillRecord:r,errors:[...errors,"FOTMOB_FIXTURE_NOT_MATCHED"]};
 const e=m.event,hi=String(e?.home?.id||""),ai=String(e?.away?.id||""),mid=String(e?.id||""),leagueId=String(e?.leagueId||e?.__league?.id||""),missing=REQUIRED.filter(k=>!complete.has(k)),metadata:any[]=[];
 let hh:any=null,ah:any=null;
 if(missing.includes("form")||missing.includes("schedule")){[hh,ah]=await Promise.all([teamHistory(hi,errors),teamHistory(ai,errors)]);metadata.push(...hh.metadata,...ah.metadata)}
 if(missing.includes("form")&&hh&&ah){
  const ho=recent(hh.items,hi),hv=recent(hh.items,hi,"HOME"),ao=recent(ah.items,ai),av=recent(ah.items,ai,"AWAY");
  if(ho.length===5&&hv.length===5&&ao.length===5&&av.length===5){r.facts.form={status:"VERIFIED",data:{homeTeam:{overallLast5:ho,homeLast5:hv},awayTeam:{overallLast5:ao,awayLast5:av}},sourceRefs:uniq([...ho,...hv,...ao,...av].map((x:any)=>x.sourceRef)),attempts:attempt(f.home+" "+f.away+" last five overall and venue form")};complete.add("form")}
 }
 if(missing.includes("schedule")&&hh&&ah){
  const ho=recent(hh.items,hi),ao=recent(ah.items,ai);
  if(ho[0]?.date&&ao[0]?.date){r.facts.schedule={status:"VERIFIED",data:{homeTeam:{latestCompletedMatchDate:ho[0].date},awayTeam:{latestCompletedMatchDate:ao[0].date}},sourceRefs:uniq([ho[0].sourceRef,ao[0].sourceRef]),attempts:attempt(f.home+" "+f.away+" recent schedule")};complete.add("schedule")}
 }
 if(missing.includes("headToHead")){
  const x=await h2h(mid,errors);metadata.push(...x.metadata);
  if(x.rows.length===5){r.facts.headToHead={status:"VERIFIED",data:{matches:x.rows},sourceRefs:uniq(x.rows.map((z:any)=>z.sourceRef)),attempts:attempt(f.home+" vs "+f.away+" exact last five head to head")};complete.add("headToHead")}
 }
 if(missing.includes("standings")&&leagueId){
  const x=await standings(leagueId,hi,ai,errors);metadata.push(...x.metadata);
  if(standingOk(x.home)&&standingOk(x.away)){r.facts.standings={status:"VERIFIED",data:{homeTeam:x.home,awayTeam:x.away},sourceRefs:uniq(x.metadata.map((z:any)=>z.url)),attempts:attempt(f.competition+" current standings")};complete.add("standings")}
 }
 metadata.push(meta(boardMeta.url,boardMeta.retrievedAt,["fixtureMatch"]));r.sourceMetadata=dedupeMeta([...r.sourceMetadata,...metadata]);r.researchedAt=new Date().toISOString();
 const completeCategories=REQUIRED.filter(k=>complete.has(k));let validatedRecord:any=null;
 if(completeCategories.length===REQUIRED.length){try{validateResearchArtifact({schema:"fih-daily-research-v5",date:DATE,mode:"PREDICTION",generatedAt:new Date().toISOString(),researchRunId:queue.researchRunId,fixtures:[r]},DATE,[String(f.fixtureId)],"PREDICTION");validatedRecord=r}catch(err:any){errors.push("FOTMOB_CANONICAL_REJECTED:"+String(err?.message||err))}}
 const unresolved=REQUIRED.filter(k=>!complete.has(k));
 return {...item,matched:true,matchConfidence:Math.max(Number(item.matchConfidence||0),m.score),fotmobMatchId:mid,completeCategories,missingCategories:validatedRecord?[]:(unresolved.length?unresolved:[...REQUIRED]),validatedRecord,prefillRecord:r,errors};
}
function write(p:string,x:any){fs.mkdirSync(path.dirname(p),{recursive:true});const t=p+".tmp";fs.writeFileSync(t,JSON.stringify(x,null,2)+"\n");fs.renameSync(t,p);JSON.parse(fs.readFileSync(p,"utf8"))}
async function main(){
 const boardUrl=BASE+"/matches?date="+DATE.replaceAll("-",""),boardMeta=await getJson(boardUrl),events=flattenBoard(boardMeta.json),byId=new Map<string,any>(queue.fixtures.map((f:any)=>[String(f.fixtureId),f])),results:any[]=[];
 for(const item of prefill.fixtures){const f=byId.get(String(item.fixtureId));if(!f)throw new Error("FOTMOB_ORPHAN_FIXTURE "+item.fixtureId);results.push(await augment(item,f,events,boardMeta));await sleep(25)}
 const gaps=results.filter((x:any)=>!x.validatedRecord).map((x:any)=>{const f=byId.get(String(x.fixtureId));return {fixtureId:String(x.fixtureId),home:f.home,away:f.away,competition:f.competition,kickoff:f.kickoff,missingCategories:x.missingCategories,prefillAvailable:(x.completeCategories||[]).length>0}});
 const full=results.filter((x:any)=>x.validatedRecord).length,anyUseful=results.filter((x:any)=>(x.completeCategories||[]).length>0).length,categoryComplete=Object.fromEntries(REQUIRED.map(k=>[k,results.filter((x:any)=>x.completeCategories?.includes(k)).length])),generatedAt=new Date().toISOString();
 const out={...prefill,generatedAt,provider:"ESPN_PUBLIC_JSON+FOTMOB_PUBLIC_JSON",purpose:"DETERMINISTIC_MULTI_SOURCE_PREFILL_ONLY",summary:{...(prefill.summary||{}),fixturesWithAnyCompleteCategory:anyUseful,fullyValidatedFixtures:full,gapFixtures:gaps.length,categoryComplete,fotmob:{scheduledEventCount:events.length,matched:results.filter((x:any)=>x.fotmobMatchId).length,cacheEntries:cache.size}},fixtures:results};
 const gap={schema:"fih-chatgpt-gap-queue-v1",date:DATE,mode:"PREDICTION",researchRunId:queue.researchRunId,generatedAt,count:gaps.length,sourcePrefillPath:"data/research-prefill/"+DATE+".json",fixtures:gaps};write(pp,out);write(gp,gap);
 const rp=path.join(ROOT,"data/recovery-requests",DATE+".json");if(fs.existsSync(rp)){const x=JSON.parse(fs.readFileSync(rp,"utf8"));x.reason=gaps.length?"HYBRID_MULTI_SOURCE_PREFILL_COMPLETE_CHATGPT_GAP_RESEARCH_REQUIRED":"HYBRID_MULTI_SOURCE_PREFILL_COMPLETE_PROMOTION_REQUIRED";x.status="CHATGPT_RESEARCH_REQUIRED";x.prefilledFixtureCount=full;x.gapFixtureCount=gaps.length;x.updatedAt=generatedAt;write(rp,x)}
 console.log(JSON.stringify({ok:true,date:DATE,researchRunId:queue.researchRunId,fullyValidated:full,gaps:gaps.length,fotmobMatched:out.summary.fotmob.matched,categoryComplete,cacheEntries:cache.size},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
