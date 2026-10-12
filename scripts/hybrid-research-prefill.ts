import fs from "node:fs";
import path from "node:path";
import {validateResearchArtifact} from "./research-canonical";

const root=process.cwd();
const tz="Africa/Johannesburg";
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const arg=(n:string)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:undefined};
const DATE=arg("--date")||process.env.FIH_DATE||today();
const LIMIT_RAW=Number(process.env.FIH_HYBRID_LIMIT||0);
const LIMIT=Number.isFinite(LIMIT_RAW)&&LIMIT_RAW>0?Math.max(1,Math.min(5000,LIMIT_RAW)):null;
const SITE="https://site.api.espn.com/apis/site/v2/sports/soccer";
const DATA="https://site.api.espn.com/apis/v2/sports/soccer";
const CORE="https://sports.core.api.espn.com/v2/sports/soccer/leagues";
const SEARCH="https://site.web.api.espn.com/apis/search/v2";
const queuePath=path.join(root,"data/research-queue",DATE+".json");
if(!fs.existsSync(queuePath))throw new Error("HYBRID_PROBE_QUEUE_MISSING "+queuePath);
const queue=JSON.parse(fs.readFileSync(queuePath,"utf8"));
if(queue.date!==DATE||!Array.isArray(queue.fixtures))throw new Error("HYBRID_PREFILL_QUEUE_INVALID");
if(queue.mode!=="PREDICTION")throw new Error("HYBRID_PREFILL_PREDICTION_ONLY");

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
const searchDiagnostics:any[]=[];
const cached=(key:string,fn:()=>Promise<any>)=>{if(!cache.has(key))cache.set(key,fn());return cache.get(key)!;};
const comp=(e:any)=>Array.isArray(e?.competitions)?e.competitions[0]:null;
const competitors=(e:any)=>Array.isArray(comp(e)?.competitors)?comp(e).competitors:[];
const side=(e:any,where:"home"|"away")=>competitors(e).find((x:any)=>String(x?.homeAway).toLowerCase()===where);
const teamName=(x:any)=>String(x?.team?.displayName||x?.team?.shortDisplayName||x?.team?.name||"");
const teamId=(x:any)=>String(x?.team?.id||"");
const completed=(e:any)=>{const s=e?.status||comp(e)?.status;return s?.type?.completed===true||String(s?.type?.state||"").toLowerCase()==="post";};
const eventDate=(e:any)=>typeof e?.date==="string"?e.date:null;
function score(x:any){
 const raw=x?.score;
 const n=Number(raw&&typeof raw==="object"?(raw.value??raw.displayValue):raw);
 return Number.isFinite(n)?n:null;
}
function eventLeagueId(e:any){
 for(const raw of [e?.uid,comp(e)?.uid]){
  const m=String(raw||"").match(/(?:^|~)l:(\d+)/);
  if(m)return m[1];
 }
 return String(e?.league?.id||comp(e)?.league?.id||"");
}
const COMPETITION_SLUGS=new Map<string,string>([
 ["laliga","esp.1"],["la liga","esp.1"],
 ["serie a","ita.1"],
 ["super lig","tur.1"],["süper lig","tur.1"],
 ["primeira liga","por.1"],
 ["bundesliga","ger.1"],
 ["ligue 1","fra.1"],
 ["eredivisie","ned.1"],
 ["mls","usa.1"],
 ["uefa champions league","uefa.champions"],
 ["uefa europa league","uefa.europa"]
]);
function inferredSlug(f:any,e:any){
 const direct=String(e?.league?.slug||comp(e)?.league?.slug||"");
 if(direct)return direct;
 const seasonSlug=normalize(String(e?.season?.slug||""));
 const seasonMap:[string,string][]=[
  ["laliga","esp.1"],["italian serie a","ita.1"],["turkish super lig","tur.1"],["portuguese primeira liga","por.1"],
  ["english premier league","eng.1"],["german bundesliga","ger.1"],["french ligue 1","fra.1"],["dutch eredivisie","ned.1"],
  ["major league soccer","usa.1"],["uefa champions league","uefa.champions"],["uefa europa league","uefa.europa"]
 ];
 for(const [needle,slug] of seasonMap)if(seasonSlug.includes(normalize(needle)))return slug;
 return COMPETITION_SLUGS.get(normalize(String(f?.competition||"")))||"";
}
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
function recent(events:any[],id:string,sourceBySeason:Map<string,string>,venue?:string){
 const out:any[]=[],seen=new Set<string>();
 const sorted=[...events].filter(completed).sort((a,b)=>String(eventDate(b)||"").localeCompare(String(eventDate(a)||"")));
 for(const e of sorted){
  const source=sourceBySeason.get(String(e?.season?.year||""))||[...sourceBySeason.values()][0]||"";
  const r=matchFact(e,id,source);if(!r||venue&&r.venue!==venue)continue;
  const k=[r.date,r.opponent,r.venue,r.goalsFor,r.goalsAgainst].join("|");
  if(seen.has(k))continue;seen.add(k);out.push(r);if(out.length===5)break;
 }
 return out;
}
function h2h(events:any[],homeId:string,awayId:string,sourceBySeason:Map<string,string>){
 const out:any[]=[],seen=new Set<string>();
 const sorted=[...events].filter(completed).sort((a,b)=>String(eventDate(b)||"").localeCompare(String(eventDate(a)||"")));
 for(const e of sorted){
  const h=side(e,"home"),a=side(e,"away"),ids=new Set([teamId(h),teamId(a)]);
  if(!ids.has(homeId)||!ids.has(awayId))continue;
  const hg=score(h),ag=score(a);if(hg===null||ag===null)continue;
  const source=sourceBySeason.get(String(e?.season?.year||""))||[...sourceBySeason.values()][0]||"";
  const r={date:eventDate(e),homeTeam:teamName(h),awayTeam:teamName(a),homeGoals:hg,awayGoals:ag,sourceRef:source};
  const k=[r.date,r.homeTeam,r.awayTeam,r.homeGoals,r.awayGoals].join("|");
  if(seen.has(k))continue;seen.add(k);out.push(r);if(out.length===5)break;
 }
 return out;
}
function statValue(entry:any,names:string[]){
 const stats=Array.isArray(entry?.stats)?entry.stats:[];
 for(const name of names){
  const s=stats.find((x:any)=>[x?.name,x?.abbreviation,x?.displayName].some(v=>String(v||"").toLowerCase()===name.toLowerCase()));
  const n=Number(s?.value??s?.displayValue);if(Number.isFinite(n))return n;
 }
 return null;
}
function standingsEntries(payload:any){
 const out:any[]=[];
 const visit=(x:any)=>{
  if(!x||typeof x!=="object")return;
  if(Array.isArray(x.entries))out.push(...x.entries);
  if(Array.isArray(x.children))for(const c of x.children)visit(c?.standings||c);
  if(x.standings&&x.standings!==x)visit(x.standings);
 };
 visit(payload);
 return out;
}
function standingRow(payload:any,id:string){
 const entry=standingsEntries(payload).find((x:any)=>String(x?.team?.id||"")===id);
 if(!entry)return null;
 const gf=statValue(entry,["pointsFor","goalsFor","GF"]);
 const ga=statValue(entry,["pointsAgainst","goalsAgainst","GA"]);
 return {
  position:statValue(entry,["rank","position"]),
  matches:statValue(entry,["gamesPlayed","matchesPlayed","GP"]),
  wins:statValue(entry,["wins","W"]),
  draws:statValue(entry,["ties","draws","D"]),
  losses:statValue(entry,["losses","L"]),
  points:statValue(entry,["points","PTS"]),
  goalsFor:gf,goalsAgainst:ga,
  goalDifference:statValue(entry,["pointDifferential","goalDifference","GD"])??(Number.isFinite(gf)&&Number.isFinite(ga)?Number(gf)-Number(ga):null)
 };
}
async function teamHistory(slug:string,id:string,currentSeason:number,errors:string[]){
 const all:any[]=[],sourceBySeason=new Map<string,string>(),meta:any[]=[],diagnostics:any[]=[];
 const add=(events:any[],url:string,retrievedAt:string)=>{
  for(const e of events){
   all.push(e);
   const sy=String(e?.season?.year||"");
   if(sy&&!sourceBySeason.has(sy))sourceBySeason.set(sy,url);
  }
  if(events.length)meta.push({url,retrievedAt,supports:["form","headToHead","schedule"]});
 };
 const allUrl=SITE+"/all/teams/"+id+"/schedule";
 try{
  const r=await cached("sched:all:"+id,()=>getJson(allUrl));
  diagnostics.push({url:allUrl,keys:Object.keys(r.json||{}),arrays:Object.fromEntries(Object.entries(r.json||{}).filter(([,v])=>Array.isArray(v)).map(([k,v]:any)=>[k,v.length]))});
  add(Array.isArray(r.json?.events)?r.json.events:[],allUrl,r.retrievedAt);
 }catch(e:any){errors.push("schedule:all:"+id+":"+String(e?.message||e));}
 if(slug)for(const season of [currentSeason,currentSeason-1,currentSeason-2]){
  const url=SITE+"/"+slug+"/teams/"+id+"/schedule?season="+season;
  try{
   const r=await cached("sched:"+slug+":"+id+":"+season,()=>getJson(url));
   diagnostics.push({url,keys:Object.keys(r.json||{}),arrays:Object.fromEntries(Object.entries(r.json||{}).filter(([,v])=>Array.isArray(v)).map(([k,v]:any)=>[k,v.length]))});
   add(Array.isArray(r.json?.events)?r.json.events:[],url,r.retrievedAt);
  }catch(e:any){errors.push("schedule:"+slug+":"+id+":"+season+":"+String(e?.message||e));}
 }
 return {events:all,sourceBySeason,meta,diagnostics};
}
async function pairHistory(homeId:string,awayId:string,currentSeason:number,errors:string[]){
 const matches:any[]=[],seen=new Set<string>(),meta:any[]=[];
 for(let season=currentSeason;season>=currentSeason-8&&matches.length<5;season--){
  const url=SITE+"/all/teams/"+homeId+"/schedule?season="+season;
  try{
   const r=await cached("pair:"+homeId+":"+season,()=>getJson(url));
   const events=Array.isArray(r.json?.events)?r.json.events:[];
   if(events.length)meta.push({url,retrievedAt:r.retrievedAt,supports:["headToHead"]});
   const map=new Map<string,string>([[String(season),url]]);
   for(const row of h2h(events,homeId,awayId,map)){
    const k=[row.date,row.homeTeam,row.awayTeam,row.homeGoals,row.awayGoals].join("|");
    if(seen.has(k))continue;seen.add(k);matches.push(row);if(matches.length===5)break;
   }
  }catch(e:any){errors.push("h2h:"+homeId+":"+season+":"+String(e?.message||e));}
 }
 matches.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
 return {matches:matches.slice(0,5),meta};
}


function extractLeagueSlugs(payload:any){
 const out=new Set<string>(),seen=new Set<any>();
 const visit=(x:any)=>{
  if(!x||typeof x!=="object"||seen.has(x))return;seen.add(x);
  const direct=String(x.slug||"").trim();
  if(/^[a-z0-9.-]{2,80}$/i.test(direct))out.add(direct);
  const ref=String(x.$ref||x.ref||"");
  const m=ref.match(/\/leagues\/([^/?#]+)/i);
  if(m&&/^[a-z0-9.-]{2,80}$/i.test(m[1]))out.add(m[1]);
  if(Array.isArray(x)){for(const v of x)visit(v);return;}
  for(const v of Object.values(x))visit(v);
 };
 visit(payload);
 return [...out].filter(s=>s!=="all").sort();
}
async function expandEventPool(ymd:string,baseEvents:any[],leagueMap:Map<string,string>){
 let catalogCount=0,attempted=0,withEvents=0;
 const byId=new Map<string,any>();
 for(const e of baseEvents){
  const id=String(e?.id||"");
  if(id)byId.set(id,e);
 }
 try{
  const catalog=await getJson(CORE+"?limit=1000");
  const slugs=extractLeagueSlugs(catalog.json);
  catalogCount=slugs.length;
  const batchSize=8;
  for(let i=0;i<slugs.length;i+=batchSize){
   const batch=slugs.slice(i,i+batchSize);
   const rows=await Promise.all(batch.map(async slug=>{
    attempted++;
    const url=SITE+"/"+slug+"/scoreboard?dates="+ymd+"&limit=1000";
    try{
     const s=await getJson(url);
     return {slug,url,retrievedAt:s.retrievedAt,json:s.json};
    }catch{return null;}
   }));
   for(const row of rows){
    if(!row)continue;
    const evs=Array.isArray(row.json?.events)?row.json.events:[];
    if(evs.length)withEvents++;
    for(const l of Array.isArray(row.json?.leagues)?row.json.leagues:[]){
     if(l?.id&&l?.slug)leagueMap.set(String(l.id),String(l.slug));
    }
    for(const e of evs){
     const id=String(e?.id||"");if(!id)continue;
     const prior=byId.get(id)||{};
     byId.set(id,{...prior,...e,__fihLeagueSlug:row.slug,__fihScoreboardUrl:row.url,__fihScoreboardRetrievedAt:row.retrievedAt});
    }
   }
   if(i+batchSize<slugs.length)await sleep(125);
  }
 }catch{}
 return {events:[...byId.values()],catalogCount,attempted,withEvents};
}



function searchTeamCandidates(payload:any,query:string){
 const out:any[]=[],seen=new Set<string>(),visited=new Set<any>();
 const visit=(x:any)=>{
  if(!x||typeof x!=="object"||visited.has(x))return;visited.add(x);
  if(Array.isArray(x)){for(const v of x)visit(v);return;}
  const uid=String(x.uid||x.team?.uid||"");
  const id=String(x.id||x.team?.id||uid.match(/(?:^|~)t:(\d+)/)?.[1]||"");
  const name=String(x.displayName||x.shortDisplayName||x.name||x.title||x.team?.displayName||x.team?.shortDisplayName||x.team?.name||"");
  const hrefs:any[]=[];
  for(const k of ["href","url"]){if(typeof x[k]==="string")hrefs.push(x[k]);if(typeof x.team?.[k]==="string")hrefs.push(x.team[k]);}
  for(const l of [...(Array.isArray(x.links)?x.links:[]),...(Array.isArray(x.team?.links)?x.team.links:[])])if(typeof l?.href==="string")hrefs.push(l.href);
  const teamLike=/~t:\d+/.test(uid)||hrefs.some(h=>/\/soccer\/team\//i.test(h)||/\/teams?\/\d+/i.test(h))||/team|club/i.test(String(x.type||x.typeName||x.category||""));
  if(id&&name&&teamLike){
   let leagueSlug=String(x.league?.slug||x.team?.league?.slug||"");
   if(!leagueSlug)for(const href of hrefs){
    const m=href.match(/\/soccer\/league\/_\/name\/([^/?#]+)/i)||href.match(/\/soccer\/([^/?#]+)\/(?:team|teams|scoreboard|standings|schedule)/i);
    if(m?.[1]&&m[1]!=="all"){leagueSlug=m[1];break;}
   }
   const s=similarity(query,name);
   if(s>=.45&&!seen.has(id)){seen.add(id);out.push({id,name,uid,leagueSlug,score:s});}
  }
  for(const v of Object.values(x))if(v&&typeof v==="object")visit(v);
 };
 visit(payload);
 return out.sort((a,b)=>b.score-a.score).slice(0,8);
}
async function searchTeam(name:string){
 const key="search:"+normalize(name);
 return cached(key,async()=>{
  const urls=[
   SEARCH+"?query="+encodeURIComponent(name)+"&sport=soccer&limit=50",
   SEARCH+"?query="+encodeURIComponent(name)+"&limit=100"
  ];
  let last:any=null;
  for(const url of urls){
   try{
    const r=await getJson(url),candidates=searchTeamCandidates(r.json,name);
    if(searchDiagnostics.length<12)searchDiagnostics.push({name,url,topKeys:Object.keys(r.json||{}),candidateCount:candidates.length,candidates:candidates.slice(0,5).map((x:any)=>({id:x.id,name:x.name,score:Number(x.score.toFixed(3)),leagueSlug:x.leagueSlug||null}))});
    last={url,retrievedAt:r.retrievedAt,candidates};
    if(candidates.length)return last;
   }catch(e:any){
    if(searchDiagnostics.length<12)searchDiagnostics.push({name,url,error:String(e?.message||e)});
   }
  }
  return last||{url:urls[urls.length-1],retrievedAt:new Date().toISOString(),candidates:[]};
 });
}
function eventNearDate(e:any){
 const t=Date.parse(String(eventDate(e)||""));
 const target=Date.parse(DATE+"T12:00:00.000Z");
 return Number.isFinite(t)&&Number.isFinite(target)&&Math.abs(t-target)<=36*60*60*1000;
}
function bestScheduledFixture(f:any,events:any[]){
 let best:any=null,bestScore=0;
 for(const e of events){
  if(!eventNearDate(e))continue;
  const h=side(e,"home"),a=side(e,"away");
  const hs=similarity(f.home,teamName(h)),as=similarity(f.away,teamName(a));
  const reversed=(similarity(f.home,teamName(a))+similarity(f.away,teamName(h)))/2;
  const direct=(hs+as)/2;
  const s=Math.max(direct,reversed*.75);
  if(hs>=.55&&as>=.55&&s>bestScore){best=e;bestScore=s;}
 }
 return best?{event:best,score:bestScore}:null;
}
async function resolveFixtureViaTeamSearch(f:any){
 const errors:string[]=[];
 let hs:any=null,as:any=null;
 try{hs=await searchTeam(f.home);}catch(e:any){errors.push("SEARCH_HOME:"+String(e?.message||e));}
 try{as=await searchTeam(f.away);}catch(e:any){errors.push("SEARCH_AWAY:"+String(e?.message||e));}
 const homeCandidates=Array.isArray(hs?.candidates)?hs.candidates.slice(0,4):[];
 const awayCandidates=Array.isArray(as?.candidates)?as.candidates.slice(0,4):[];
 const awayIds=new Set(awayCandidates.map((x:any)=>String(x.id)));
 for(const hc of homeCandidates){
  for(const season of [Number(DATE.slice(0,4)),Number(DATE.slice(0,4))-1]){
   const url=SITE+"/all/teams/"+hc.id+"/schedule?season="+season;
   try{
    const r=await cached("search-schedule:"+hc.id+":"+season,()=>getJson(url));
    const evs=Array.isArray(r.json?.events)?r.json.events:[];
    const m=bestScheduledFixture(f,evs);
    if(!m)continue;
    const eh=side(m.event,"home"),ea=side(m.event,"away");
    const ids=new Set([teamId(eh),teamId(ea)]);
    if(awayIds.size&&![...awayIds].some(id=>ids.has(id)))continue;
    let slug=String(hc.leagueSlug||"");
    if(!slug){
     for(const l of Array.isArray(r.json?.leagues)?r.json.leagues:[])if(l?.slug){slug=String(l.slug);break;}
    }
    return {event:{...m.event,__fihLeagueSlug:slug,__fihScoreboardUrl:url,__fihScoreboardRetrievedAt:r.retrievedAt},score:m.score,errors,searchMeta:[
     ...(hs?[{url:hs.url,retrievedAt:hs.retrievedAt,supports:["fixtureMatch"]}]:[]),
     ...(as?[{url:as.url,retrievedAt:as.retrievedAt,supports:["fixtureMatch"]}]:[]),
     {url,retrievedAt:r.retrievedAt,supports:["fixtureMatch","schedule"]}
    ]};
   }catch(e:any){errors.push("SEARCH_SCHEDULE:"+hc.id+":"+season+":"+String(e?.message||e));}
  }
 }
 return {event:null,score:0,errors,searchMeta:[
  ...(hs?[{url:hs.url,retrievedAt:hs.retrievedAt,supports:["fixtureMatch"]}]:[]),
  ...(as?[{url:as.url,retrievedAt:as.retrievedAt,supports:["fixtureMatch"]}]:[])
 ]};
}

async function main(){
 const ymd=DATE.replaceAll("-","");
 const scoreboardUrl=SITE+"/all/scoreboard?dates="+ymd+"&limit=1000";
 const scoreboard=await getJson(scoreboardUrl);
 const leagueMap=new Map<string,string>();
 for(const l of Array.isArray(scoreboard.json?.leagues)?scoreboard.json.leagues:[]){
  if(l?.id&&l?.slug)leagueMap.set(String(l.id),String(l.slug));
 }
 const selected:any[]=LIMIT===null?[...queue.fixtures]:queue.fixtures.slice(0,LIMIT);
 if(LIMIT===null&&selected.length!==Number(queue.count))throw new Error("HYBRID_PREFILL_QUEUE_COUNT_MISMATCH");
 const globalEvents=Array.isArray(scoreboard.json?.events)?scoreboard.json.events:[];
 let events=globalEvents.map((e:any)=>({...e,__fihScoreboardUrl:scoreboard.url,__fihScoreboardRetrievedAt:scoreboard.retrievedAt}));
 let leagueDiscovery={events,catalogCount:0,attempted:0,withEvents:0};
 if(selected.some((f:any)=>!bestFixtureEvent(f,events))){
  leagueDiscovery=await expandEventPool(ymd,events,leagueMap);
  events=leagueDiscovery.events;
 }
 const results:any[]=[];
 let searchFallbackAttempted=0,searchFallbackMatched=0;
 for(const f of selected){
  let matched:any=bestFixtureEvent(f,events);
  let fallbackMeta:any[]=[],discoveryErrors:string[]=[];
  if(!matched){
   searchFallbackAttempted++;
   const recovered=await resolveFixtureViaTeamSearch(f);
   discoveryErrors=recovered.errors||[];
   fallbackMeta=recovered.searchMeta||[];
   if(recovered.event){matched={event:recovered.event,score:recovered.score};searchFallbackMatched++;}
  }
  if(!matched){
   results.push({fixtureId:String(f.fixtureId),fixture:f,matched:false,gaps:["fixtureMatch","form","standings","headToHead","schedule"],errors:discoveryErrors,sourceMetadata:fallbackMeta});
   continue;
  }
  const e=matched.event,h=side(e,"home"),a=side(e,"away"),homeId=teamId(h),awayId=teamId(a);
  const leagueId=eventLeagueId(e),slug=String(e?.__fihLeagueSlug||"")||leagueMap.get(leagueId)||inferredSlug(f,e);
  const errors:string[]=[...discoveryErrors];
  const seasonRaw=Number(e?.season?.year);
  const seasonYear=Number.isFinite(seasonRaw)?seasonRaw:Number(DATE.slice(0,4));
  if(!slug)errors.push("ESPN_LEAGUE_IDENTITY_MISSING_STANDINGS_ONLY");

  const homeHistory=await teamHistory(slug,homeId,seasonYear,errors);
  const awayHistory=await teamHistory(slug,awayId,seasonYear,errors);
  const homeOverall=recent(homeHistory.events,homeId,homeHistory.sourceBySeason);
  const homeVenue=recent(homeHistory.events,homeId,homeHistory.sourceBySeason,"HOME");
  const awayOverall=recent(awayHistory.events,awayId,awayHistory.sourceBySeason);
  const awayVenue=recent(awayHistory.events,awayId,awayHistory.sourceBySeason,"AWAY");
  const formOk=homeOverall.length===5&&homeVenue.length===5&&awayOverall.length===5&&awayVenue.length===5;
  const pair=await pairHistory(homeId,awayId,seasonYear,errors);
  const h2hMatches=pair.matches;
  const h2hOk=h2hMatches.length===5;
  const scheduleOk=!!homeOverall[0]?.date&&!!awayOverall[0]?.date;

  const standingsUrl=slug?DATA+"/"+slug+"/standings?season="+seasonYear:"";
  let standings:any=null,standingsMeta:any[]=[];
  if(slug)try{
   const s=await cached("standings:"+slug+":"+seasonYear,()=>getJson(standingsUrl));
   standings=s.json;standingsMeta=[{url:standingsUrl,retrievedAt:s.retrievedAt,supports:["standings"]}];
  }catch(err:any){errors.push("standings:"+slug+":"+String(err?.message||err));}
  const homeStanding=standings?standingRow(standings,homeId):null;
  const awayStanding=standings?standingRow(standings,awayId):null;
  const standingsOk=!!homeStanding&&!!awayStanding&&[homeStanding.position,homeStanding.matches,homeStanding.points,awayStanding.position,awayStanding.matches,awayStanding.points].every(Number.isFinite);

  const gaps=[...(!formOk?["form"]:[]),...(!standingsOk?["standings"]:[]),...(!h2hOk?["headToHead"]:[]),...(!scheduleOk?["schedule"]:[])];
  const sourceMetadata=[
   {url:String(e?.__fihScoreboardUrl||scoreboard.url),retrievedAt:String(e?.__fihScoreboardRetrievedAt||scoreboard.retrievedAt),supports:["fixtureMatch"]},
   ...fallbackMeta,...homeHistory.meta,...awayHistory.meta,...pair.meta,...standingsMeta
  ];
  results.push({
   fixtureId:String(f.fixtureId),fixture:f,matched:true,matchConfidence:Number(matched.score.toFixed(3)),
   providerEventId:String(e?.id||""),leagueId,leagueSlug:slug,
   providerTeams:{home:{id:homeId,name:teamName(h)},away:{id:awayId,name:teamName(a)}},season:e?.season||null,
   categories:{
    form:{complete:formOk,homeOverall,homeVenue,awayOverall,awayVenue},
    standings:{complete:standingsOk,homeTeam:homeStanding,awayTeam:awayStanding},
    headToHead:{complete:h2hOk,matches:h2hMatches},
    schedule:{complete:scheduleOk,homeTeam:{latestCompletedMatchDate:homeOverall[0]?.date||null},awayTeam:{latestCompletedMatchDate:awayOverall[0]?.date||null}}
   },
   sourceMetadata,gaps,errors
  });
  await sleep(150);
 }
 const generatedAt=new Date().toISOString();
 const uniq=(xs:any[])=>[...new Set(xs.filter((x:any)=>typeof x==="string"&&x))];
 const attempt=(query:string,outcome:string)=>[{query,attemptedAt:generatedAt,outcome}];
 const prefillFixtures=results.map((r:any)=>{
  const facts:any={},completeCategories:string[]=[];
  const sm=[...new Map((r.sourceMetadata||[]).map((x:any)=>[String(x.url),x])).values()];
  if(r.categories?.form?.complete){
   const d=r.categories.form;
   const refs=uniq([...d.homeOverall,...d.homeVenue,...d.awayOverall,...d.awayVenue].map((m:any)=>m.sourceRef));
   facts.form={status:"VERIFIED",data:{homeTeam:{overallLast5:d.homeOverall,homeLast5:d.homeVenue},awayTeam:{overallLast5:d.awayOverall,awayLast5:d.awayVenue}},sourceRefs:refs,attempts:attempt(r.fixture.home+" "+r.fixture.away+" last five overall and venue form","GITHUB_PUBLIC_SOURCE_FACTS_VERIFIED")};
   completeCategories.push("form");
  }
  if(r.categories?.standings?.complete){
   const refs=uniq(sm.filter((x:any)=>(x.supports||[]).includes("standings")).map((x:any)=>x.url));
   facts.standings={status:"VERIFIED",data:{homeTeam:r.categories.standings.homeTeam,awayTeam:r.categories.standings.awayTeam},sourceRefs:refs,attempts:attempt(r.fixture.competition+" current standings","GITHUB_PUBLIC_SOURCE_FACTS_VERIFIED")};
   completeCategories.push("standings");
  }
  if(r.categories?.headToHead?.complete){
   const refs=uniq((r.categories.headToHead.matches||[]).map((m:any)=>m.sourceRef));
   facts.headToHead={status:"VERIFIED",data:{matches:r.categories.headToHead.matches},sourceRefs:refs,attempts:attempt(r.fixture.home+" vs "+r.fixture.away+" last five head to head","GITHUB_PUBLIC_SOURCE_FACTS_VERIFIED")};
   completeCategories.push("headToHead");
  }
  if(r.categories?.schedule?.complete){
   const formRefs=uniq([...(facts.form?.sourceRefs||[])]);
   facts.schedule={status:"VERIFIED",data:{homeTeam:{latestCompletedMatchDate:r.categories.schedule.homeTeam.latestCompletedMatchDate},awayTeam:{latestCompletedMatchDate:r.categories.schedule.awayTeam.latestCompletedMatchDate}},sourceRefs:formRefs,attempts:attempt(r.fixture.home+" "+r.fixture.away+" recent schedule","GITHUB_PUBLIC_SOURCE_FACTS_VERIFIED")};
   completeCategories.push("schedule");
  }
  const missingCategories=["form","standings","headToHead","schedule"].filter(k=>!completeCategories.includes(k));
  const partialRecord={fixtureId:String(r.fixtureId),fixture:{home:r.fixture.home,away:r.fixture.away,competition:r.fixture.competition,kickoff:r.fixture.kickoff},researchedAt:generatedAt,researchRunId:queue.researchRunId,sourceMetadata:sm,facts};
  let validatedRecord:any=null,validationError:string|null=null;
  if(missingCategories.length===0){
   try{
    validateResearchArtifact({schema:"fih-daily-research-v5",date:DATE,mode:"PREDICTION",generatedAt,researchRunId:queue.researchRunId,fixtures:[partialRecord]},DATE,[String(r.fixtureId)],"PREDICTION");
    validatedRecord=partialRecord;
   }catch(e:any){
    validationError=String(e?.message||e);
    missingCategories.push("form","standings","headToHead","schedule");
   }
  }
  return {fixtureId:String(r.fixtureId),matched:r.matched===true,completeCategories,missingCategories,validatedRecord,prefillRecord:partialRecord,errors:[...(r.errors||[]),...(validationError?["CANONICAL_PREFILL_REJECTED:"+validationError]:[])]};
 });
 const gapFixtures=prefillFixtures.filter((r:any)=>!r.validatedRecord).map((r:any)=>{
  const q=queue.fixtures.find((f:any)=>String(f.fixtureId)===String(r.fixtureId));
  return {fixtureId:r.fixtureId,home:q?.home,away:q?.away,competition:q?.competition,kickoff:q?.kickoff,missingCategories:r.missingCategories,prefillAvailable:r.completeCategories.length>0};
 });
 const matchedCount=results.filter((r:any)=>r.matched).length;
 const full=prefillFixtures.filter((r:any)=>r.validatedRecord).length;
 const categoryCounts=Object.fromEntries(["form","standings","headToHead","schedule"].map(k=>[k,prefillFixtures.filter((r:any)=>r.completeCategories.includes(k)).length]));
 const anyUseful=prefillFixtures.filter((r:any)=>r.completeCategories.length>0).length;
 const out={schema:"fih-hybrid-research-prefill-v1",date:DATE,mode:"PREDICTION",researchRunId:queue.researchRunId,generatedAt,provider:"ESPN_PUBLIC_JSON",nonCanonical:true,purpose:"DETERMINISTIC_PREFILL_ONLY",fixtureCount:selected.length,summary:{attempted:selected.length,matched:matchedCount,fixturesWithAnyCompleteCategory:anyUseful,fullyValidatedFixtures:full,gapFixtures:gapFixtures.length,categoryComplete:categoryCounts,cacheEntries:cache.size,eventPool:events.length,globalEventPool:globalEvents.length,leagueCatalogCount:leagueDiscovery.catalogCount,leagueScoreboardsAttempted:leagueDiscovery.attempted,leagueScoreboardsWithEvents:leagueDiscovery.withEvents,searchFallbackAttempted,searchFallbackMatched,searchDiagnostics},fixtures:prefillFixtures};
 const gap={schema:"fih-chatgpt-gap-queue-v1",date:DATE,mode:"PREDICTION",researchRunId:queue.researchRunId,generatedAt,count:gapFixtures.length,sourcePrefillPath:"data/research-prefill/"+DATE+".json",fixtures:gapFixtures};
 const outPath=path.join(root,"data/research-prefill",DATE+".json"),gapPath=path.join(root,"data/research-gap-queue",DATE+".json");
 fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.mkdirSync(path.dirname(gapPath),{recursive:true});
 for(const [p,x] of [[outPath,out],[gapPath,gap]] as any){const t=p+".tmp";fs.writeFileSync(t,JSON.stringify(x,null,2)+"\n");fs.renameSync(t,p);JSON.parse(fs.readFileSync(p,"utf8"));}
 const recoveryPath=path.join(root,"data/recovery-requests",DATE+".json");
 if(fs.existsSync(recoveryPath)){
  const recovery=JSON.parse(fs.readFileSync(recoveryPath,"utf8"));
  recovery.reason=gapFixtures.length?"HYBRID_PREFILL_COMPLETE_CHATGPT_GAP_RESEARCH_REQUIRED":"HYBRID_PREFILL_COMPLETE_PROMOTION_REQUIRED";
  recovery.status="CHATGPT_RESEARCH_REQUIRED";
  recovery.prefillPath="data/research-prefill/"+DATE+".json";
  recovery.gapQueuePath="data/research-gap-queue/"+DATE+".json";
  recovery.prefilledFixtureCount=full;
  recovery.gapFixtureCount=gapFixtures.length;
  recovery.updatedAt=generatedAt;
  const t=recoveryPath+".tmp";fs.writeFileSync(t,JSON.stringify(recovery,null,2)+"\n");fs.renameSync(t,recoveryPath);
 }
 console.log(JSON.stringify({outPath,gapPath,...out.summary},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
