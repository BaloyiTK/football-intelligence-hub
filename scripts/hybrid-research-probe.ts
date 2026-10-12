import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const tz="Africa/Johannesburg";
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const DATE=process.env.FIH_DATE||today();
const LIMIT=Math.max(1,Math.min(50,Number(process.env.FIH_HYBRID_LIMIT||10)));
const BASE="https://site.api.espn.com/apis/site/v2/sports/soccer/all";
const queuePath=path.join(root,"data/research-queue",DATE+".json");
if(!fs.existsSync(queuePath))throw new Error("HYBRID_PROBE_QUEUE_MISSING "+queuePath);
const queue=JSON.parse(fs.readFileSync(queuePath,"utf8"));
if(queue.date!==DATE||!Array.isArray(queue.fixtures))throw new Error("HYBRID_PROBE_QUEUE_INVALID");

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const normalize=(s:string)=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/\b(fc|cf|afc|sc|club|calcio|fk|ac|cd|ud|deportivo)\b/g," ").replace(/[^a-z0-9]+/g," ").trim();
function similarity(a:string,b:string){
 const A=new Set(normalize(a).split(" ").filter(Boolean)),B=new Set(normalize(b).split(" ").filter(Boolean));
 if(!A.size||!B.size)return 0; let hit=0; for(const x of A)if(B.has(x))hit++;
 return (2*hit)/(A.size+B.size);
}
async function getJson(url:string){
 let last:any;
 for(let attempt=1;attempt<=3;attempt++){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);
  try{
   const r=await fetch(url,{signal:c.signal,headers:{"accept":"application/json","user-agent":"Mozilla/5.0 (compatible; FootballIntelligenceHub/0.1)"}});
   if(r.ok)return {url,json:await r.json(),status:r.status,retrievedAt:new Date().toISOString()};
   last=new Error("HTTP_"+r.status);
   if(r.status!==429&&r.status<500)break;
  }catch(e){last=e}
  finally{clearTimeout(timer)}
  await sleep(500*attempt);
 }
 throw new Error("ESPN_FETCH_FAILED "+url+" "+String(last?.message||last));
}
const cache=new Map<string,Promise<any>>();
const cached=(key:string,fn:()=>Promise<any>)=>{if(!cache.has(key))cache.set(key,fn());return cache.get(key)!;};
const comp=(e:any)=>Array.isArray(e?.competitions)?e.competitions[0]:null;
const competitors=(e:any)=>Array.isArray(comp(e)?.competitors)?comp(e).competitors:[];
const side=(e:any,where:"home"|"away")=>competitors(e).find((x:any)=>String(x?.homeAway).toLowerCase()===where);
const teamName=(x:any)=>String(x?.team?.displayName||x?.team?.shortDisplayName||x?.team?.name||"");
const teamId=(x:any)=>String(x?.team?.id||"");
const completed=(e:any)=>e?.status?.type?.completed===true||String(e?.status?.type?.state||"").toLowerCase()==="post";
const eventDate=(e:any)=>typeof e?.date==="string"?e.date:null;
function score(x:any){
 const n=Number(x?.score?.value??x?.score);
 return Number.isFinite(n)?n:null;
}
function sourceRef(url:string){return url}
function bestFixtureEvent(f:any,events:any[]){
 let best:any=null,bestScore=0;
 for(const e of events){
  const h=side(e,"home"),a=side(e,"away");
  const hs=similarity(f.home,teamName(h)),as=similarity(f.away,teamName(a));
  const s=(hs+as)/2;
  if(hs>=.55&&as>=.55&&s>bestScore){best=e;bestScore=s;}
 }
 return best?{event:best,score:bestScore}:null;
}
function matchFact(e:any,id:string,source:string){
 const h=side(e,"home"),a=side(e,"away"),isHome=teamId(h)===id,isAway=teamId(a)===id;
 if(!isHome&&!isAway)return null;
 const gf=isHome?score(h):score(a),ga=isHome?score(a):score(h);
 if(!completed(e)||gf===null||ga===null)return null;
 return {date:eventDate(e),opponent:teamName(isHome?a:h),venue:isHome?"HOME":"AWAY",goalsFor:gf,goalsAgainst:ga,sourceRef:source};
}
function recent(events:any[],id:string,source:string,venue?:string){
 const out:any[]=[],seen=new Set<string>();
 const sorted=[...events].filter(completed).sort((a,b)=>String(eventDate(b)||"").localeCompare(String(eventDate(a)||"")));
 for(const e of sorted){
  const r=matchFact(e,id,source);if(!r||venue&&r.venue!==venue)continue;
  const k=[r.date,r.opponent,r.venue,r.goalsFor,r.goalsAgainst].join("|");
  if(seen.has(k))continue;seen.add(k);out.push(r);if(out.length===5)break;
 }
 return out;
}
function h2h(events:any[],homeId:string,awayId:string,source:string){
 const out:any[]=[],seen=new Set<string>();
 const sorted=[...events].filter(completed).sort((a,b)=>String(eventDate(b)||"").localeCompare(String(eventDate(a)||"")));
 for(const e of sorted){
  const h=side(e,"home"),a=side(e,"away"),ids=new Set([teamId(h),teamId(a)]);
  if(!ids.has(homeId)||!ids.has(awayId))continue;
  const hg=score(h),ag=score(a);if(hg===null||ag===null)continue;
  const r={date:eventDate(e),homeTeam:teamName(h),awayTeam:teamName(a),homeGoals:hg,awayGoals:ag,sourceRef:source};
  const k=[r.date,r.homeTeam,r.awayTeam,r.homeGoals,r.awayGoals].join("|");
  if(seen.has(k))continue;seen.add(k);out.push(r);if(out.length===5)break;
 }
 return out;
}
function nextEvent(events:any[],id:string){
 const now=Date.now();
 return [...events].filter(e=>!completed(e)&&competitors(e).some((x:any)=>teamId(x)===id)&&Date.parse(String(eventDate(e)||""))>=now)
   .sort((a,b)=>String(eventDate(a)||"").localeCompare(String(eventDate(b)||"")))[0]||null;
}

async function main(){
 const ymd=DATE.replaceAll("-","");
 const scoreboard=await getJson(BASE+"/scoreboard?dates="+ymd+"&limit=1000");
 const events=Array.isArray(scoreboard.json?.events)?scoreboard.json.events:[];
 const selected=queue.fixtures.slice(0,LIMIT);
 const results:any[]=[];
 for(const f of selected){
  const matched=bestFixtureEvent(f,events);
  if(!matched){
   results.push({fixtureId:String(f.fixtureId),fixture:f,matched:false,gaps:["fixtureMatch","form","standings","headToHead","schedule"],errors:[]});
   continue;
  }
  const e=matched.event,h=side(e,"home"),a=side(e,"away"),homeId=teamId(h),awayId=teamId(a);
  const errors:string[]=[];
  const safe=async(label:string,p:Promise<any>)=>{try{return await p}catch(err:any){errors.push(label+":"+String(err?.message||err));return null}};
  const homeScheduleUrl=BASE+"/teams/"+homeId+"/schedule";
  const awayScheduleUrl=BASE+"/teams/"+awayId+"/schedule";
  const homeFixtureUrl=BASE+"/teams/"+homeId+"/schedule?fixture=true";
  const awayFixtureUrl=BASE+"/teams/"+awayId+"/schedule?fixture=true";
  const homeSchedule=await safe("homeSchedule",cached("sched:"+homeId,()=>getJson(homeScheduleUrl)));
  const awaySchedule=await safe("awaySchedule",cached("sched:"+awayId,()=>getJson(awayScheduleUrl)));
  const homeFuture=await safe("homeFuture",cached("future:"+homeId,()=>getJson(homeFixtureUrl)));
  const awayFuture=await safe("awayFuture",cached("future:"+awayId,()=>getJson(awayFixtureUrl)));
  const he=Array.isArray(homeSchedule?.json?.events)?homeSchedule.json.events:[];
  const ae=Array.isArray(awaySchedule?.json?.events)?awaySchedule.json.events:[];
  const hf=Array.isArray(homeFuture?.json?.events)?homeFuture.json.events:[];
  const af=Array.isArray(awayFuture?.json?.events)?awayFuture.json.events:[];

  const homeOverall=recent(he,homeId,homeScheduleUrl),homeVenue=recent(he,homeId,homeScheduleUrl,"HOME");
  const awayOverall=recent(ae,awayId,awayScheduleUrl),awayVenue=recent(ae,awayId,awayScheduleUrl,"AWAY");
  const formOk=homeOverall.length===5&&homeVenue.length===5&&awayOverall.length===5&&awayVenue.length===5;
  const h2hMatches=h2h(he,homeId,awayId,homeScheduleUrl),h2hOk=h2hMatches.length===5;
  const homeNext=nextEvent(hf,homeId),awayNext=nextEvent(af,awayId);
  const scheduleOk=!!homeOverall[0]?.date&&!!awayOverall[0]?.date;
  const standingsOk=false;
  const gaps=[...(!formOk?["form"]:[]),...(!standingsOk?["standings"]:[]),...(!h2hOk?["headToHead"]:[]),...(!scheduleOk?["schedule"]:[])];
  const sourceMetadata=[
   {url:scoreboard.url,retrievedAt:scoreboard.retrievedAt,supports:["fixtureMatch"]},
   ...(homeSchedule?[{url:homeScheduleUrl,retrievedAt:homeSchedule.retrievedAt,supports:["form","headToHead","schedule"]}]:[]),
   ...(awaySchedule?[{url:awayScheduleUrl,retrievedAt:awaySchedule.retrievedAt,supports:["form","schedule"]}]:[]),
   ...(homeFuture?[{url:homeFixtureUrl,retrievedAt:homeFuture.retrievedAt,supports:["schedule"]}]:[]),
   ...(awayFuture?[{url:awayFixtureUrl,retrievedAt:awayFuture.retrievedAt,supports:["schedule"]}]:[])
  ];
  results.push({
   fixtureId:String(f.fixtureId),fixture:f,matched:true,matchConfidence:Number(matched.score.toFixed(3)),
   providerEventId:String(e?.id||""),providerTeams:{home:{id:homeId,name:teamName(h)},away:{id:awayId,name:teamName(a)}},
   season:e?.season||null,
   categories:{
    form:{complete:formOk,homeOverall,homeVenue,awayOverall,awayVenue},
    standings:{complete:false,reason:"ESPN_GLOBAL_STANDINGS_NEEDS_LEAGUE_SLUG"},
    headToHead:{complete:h2hOk,matches:h2hMatches},
    schedule:{complete:scheduleOk,homeTeam:{latestCompletedMatchDate:homeOverall[0]?.date||null,nextScheduledMatchDate:eventDate(homeNext)},awayTeam:{latestCompletedMatchDate:awayOverall[0]?.date||null,nextScheduledMatchDate:eventDate(awayNext)}}
   },
   sourceMetadata,gaps,errors
  });
  await sleep(150);
 }
 const matched=results.filter(r=>r.matched).length,full=results.filter(r=>r.matched&&r.gaps.length===0).length;
 const categoryCounts=Object.fromEntries(["form","standings","headToHead","schedule"].map(k=>[k,results.filter(r=>r.matched&&r.categories?.[k]?.complete).length]));
 const out={schema:"fih-hybrid-research-probe-v1",date:DATE,researchRunId:queue.researchRunId,generatedAt:new Date().toISOString(),limit:selected.length,provider:"ESPN_PUBLIC_JSON",nonCanonical:true,summary:{attempted:selected.length,matched,fullEvidenceReady:full,needsGapResearch:selected.length-full,categoryComplete:categoryCounts,cacheEntries:cache.size},results};
 const outPath=path.join(root,"data/research-probe",DATE+".json");
 fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(out,null,2)+"\n");
 console.log(JSON.stringify({outPath,...out.summary},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
