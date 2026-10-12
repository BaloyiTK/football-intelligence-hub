import fs from "node:fs";
import path from "node:path";
import {validateResearchArtifact} from "./research-canonical";

const root=process.cwd();
const tz="Africa/Johannesburg";
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const DATE=process.env.FIH_DATE||today();
const LIMIT=Math.max(1,Math.min(50,Number(process.env.FIH_HYBRID_LIMIT||10)));
const SITE="https://site.api.espn.com/apis/site/v2/sports/soccer";
const DATA="https://site.api.espn.com/apis/v2/sports/soccer";
const queuePath=path.join(root,"data/research-queue",DATE+".json");
if(!fs.existsSync(queuePath))throw new Error("HYBRID_PROBE_QUEUE_MISSING "+queuePath);
const queue=JSON.parse(fs.readFileSync(queuePath,"utf8"));
if(queue.date!==DATE||!Array.isArray(queue.fixtures))throw new Error("HYBRID_PROBE_QUEUE_INVALID");

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const normalize=(s:string)=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/\b(fc|cf|afc|sc|club|calcio|fk|ac|cd|ud|deportivo)/g," ").replace(/[^a-z0-9]+/g," ").trim();
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
 const linkObjects=[...(Array.isArray(e?.links)?e.links:[]),...(Array.isArray(comp(e)?.links)?comp(e).links:[])];
 for(const link of linkObjects){
  const href=String(link?.href||"");
  const m=href.match(/\/soccer\/league\/_\/name\/([^/?#]+)/i)||href.match(/\/soccer\/([^/?#]+)\/(?:scoreboard|standings|schedule)/i);
  if(m?.[1]&&m[1]!=="all")return m[1];
 }
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
function teamDirectoryEntries(payload:any){
 const out:any[]=[],seen=new Set<string>();
 const visit=(x:any)=>{
  if(!x||typeof x!=="object")return;
  const t=x?.team&&typeof x.team==="object"?x.team:x;
  const id=String(t?.id||""),name=String(t?.displayName||t?.shortDisplayName||t?.name||"");
  if(id&&name&&!seen.has(id)){seen.add(id);out.push({id,name,raw:t});}
  for(const v of Object.values(x)){
   if(Array.isArray(v))for(const y of v)visit(y);
   else if(v&&typeof v==="object"&&v!==t)visit(v);
  }
 };
 visit(payload);
 return out;
}
function bestTeam(name:string,teams:any[]){
 let best:any=null,bestScore=0;
 for(const t of teams){const s=similarity(name,t.name);if(s>bestScore){best=t;bestScore=s;}}
 return bestScore>=.62?{...best,score:bestScore}:null;
}
async function fallbackFixtureFromTeams(f:any,teams:any[],errors:string[]){
 const h=bestTeam(f.home,teams),a=bestTeam(f.away,teams);
 if(!h||!a){errors.push("TEAM_DIRECTORY_MATCH_FAILED");return null;}
 const url=SITE+"/all/teams/"+h.id+"/schedule";
 try{
  const r=await cached("fallback-team-schedule:"+h.id,()=>getJson(url));
  const events=Array.isArray(r.json?.events)?r.json.events:[];
  let best:any=null,bestScore=0;
  for(const e of events){
   const eh=side(e,"home"),ea=side(e,"away");
   const hs=similarity(f.home,teamName(eh)),as=similarity(f.away,teamName(ea));
   const sameDate=String(eventDate(e)||"").slice(0,10)===DATE;
   const s=(hs+as)/2+(sameDate?.25:0);
   if(hs>=.55&&as>=.55&&s>bestScore){best=e;bestScore=s;}
  }
  return best?{event:best,score:Math.min(1,bestScore),directory:{home:h,away:a},source:url}:null;
 }catch(e:any){errors.push("TEAM_DIRECTORY_SCHEDULE_FAILED:"+String(e?.message||e));return null;}
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


const uniq=(xs:any[])=>[...new Set(xs.filter((x:any)=>typeof x==="string"&&x.trim()))];
function canonicalRecordFromProbe(r:any){
 const attemptedAt=new Date().toISOString();
 const attempt=(category:string,outcome:string)=>({query:[r.fixture?.home,r.fixture?.away,category,"GitHub public-source research"].filter(Boolean).join(" "),attemptedAt,outcome});
 const exhausted=(category:string)=>[attempt(category,"SEARCH_EXHAUSTED_GITHUB_PUBLIC_SOURCES")];
 const metadata=Array.isArray(r.sourceMetadata)?r.sourceMetadata:[];
 const refsBy=(category:string)=>uniq(metadata.filter((m:any)=>Array.isArray(m?.supports)&&m.supports.includes(category)).map((m:any)=>String(m.url||"")));
 const formData=r.categories?.form||{};
 const formRows=[...(formData.homeOverall||[]),...(formData.homeVenue||[]),...(formData.awayOverall||[]),...(formData.awayVenue||[])];
 const formRefs=uniq(formRows.map((x:any)=>String(x?.sourceRef||"")));
 const form=formData.complete?{
  status:"VERIFIED",data:{homeTeam:{overallLast5:formData.homeOverall,homeLast5:formData.homeVenue},awayTeam:{overallLast5:formData.awayOverall,awayLast5:formData.awayVenue}},
  sourceRefs:formRefs,attempts:[attempt("form","GITHUB_PUBLIC_SOURCE_FACTS_VERIFIED")]
 }:(formRows.length?{
  status:"PARTIAL",data:{homeTeam:{overallLast5:formData.homeOverall||[],homeLast5:formData.homeVenue||[]},awayTeam:{overallLast5:formData.awayOverall||[],awayLast5:formData.awayVenue||[]}},
  sourceRefs:formRefs,attempts:exhausted("form"),searchExhausted:true
 }:{
  status:"UNAVAILABLE",sourceRefs:[],attempts:exhausted("form"),searchExhausted:true
 });
 const standingsData=r.categories?.standings||{};
 const standings=standingsData.complete?{
  status:"VERIFIED",data:{homeTeam:standingsData.homeTeam,awayTeam:standingsData.awayTeam},sourceRefs:refsBy("standings"),attempts:[attempt("standings","GITHUB_PUBLIC_SOURCE_FACTS_VERIFIED")]
 }:{
  status:"UNAVAILABLE",sourceRefs:[],attempts:exhausted("standings"),searchExhausted:true
 };
 const h2hData=r.categories?.headToHead||{},h2hMatches=Array.isArray(h2hData.matches)?h2hData.matches:[];
 const h2hRefs=uniq(h2hMatches.map((x:any)=>String(x?.sourceRef||"")));
 const headToHead=h2hData.complete?{
  status:"VERIFIED",data:{matches:h2hMatches},sourceRefs:h2hRefs,attempts:[attempt("headToHead","GITHUB_PUBLIC_SOURCE_FACTS_VERIFIED")]
 }:(h2hMatches.length?{
  status:"PARTIAL",data:{matches:h2hMatches},sourceRefs:h2hRefs,attempts:exhausted("headToHead"),searchExhausted:true
 }:{
  status:"UNAVAILABLE",data:{matches:[]},sourceRefs:[],attempts:exhausted("headToHead"),searchExhausted:true
 });
 const scheduleData=r.categories?.schedule||{};
 const scheduleRefs=refsBy("schedule");
 const anySchedule=!!scheduleData?.homeTeam?.latestCompletedMatchDate||!!scheduleData?.awayTeam?.latestCompletedMatchDate;
 const schedule=scheduleData.complete?{
  status:"VERIFIED",data:{homeTeam:scheduleData.homeTeam,awayTeam:scheduleData.awayTeam},sourceRefs:scheduleRefs,attempts:[attempt("schedule","GITHUB_PUBLIC_SOURCE_FACTS_VERIFIED")]
 }:(anySchedule&&scheduleRefs.length?{
  status:"PARTIAL",data:{homeTeam:scheduleData.homeTeam||{},awayTeam:scheduleData.awayTeam||{}},sourceRefs:scheduleRefs,attempts:exhausted("schedule"),searchExhausted:true
 }:{
  status:"UNAVAILABLE",sourceRefs:[],attempts:exhausted("schedule"),searchExhausted:true
 });
 return {
  fixtureId:String(r.fixtureId),
  fixture:{home:r.fixture.home,away:r.fixture.away,competition:r.fixture.competition,kickoff:r.fixture.kickoff},
  researchedAt:attemptedAt,
  researchRunId:String(queue.researchRunId),
  sourceMetadata:metadata,
  facts:{form,standings,headToHead,schedule},
  evidenceStatus:"GITHUB_HYBRID_PUBLIC_RESEARCH",
  requiredModelMatchSeries:form.status==="VERIFIED"?"VERIFIED":"UNAVAILABLE",
  verifiedInputs:{},
  integrity:"Only source-backed facts retained; missing or incomplete categories are explicitly exhausted and never fabricated."
 };
}


async function main(){
 const ymd=DATE.replaceAll("-","");
 const scoreboardUrl=SITE+"/all/scoreboard?dates="+ymd+"&limit=1000";
 const scoreboard=await getJson(scoreboardUrl);
 const events=Array.isArray(scoreboard.json?.events)?scoreboard.json.events:[];
 let teamDirectory:any[]=[];
 try{
  const td=await getJson(SITE+"/all/teams?limit=2000");
  teamDirectory=teamDirectoryEntries(td.json);
 }catch{}
 const leagueMap=new Map<string,string>();
 for(const l of Array.isArray(scoreboard.json?.leagues)?scoreboard.json.leagues:[]){
  if(l?.id&&l?.slug)leagueMap.set(String(l.id),String(l.slug));
 }
 const preferred=["LaLiga","Serie A","Süper Lig","Primeira Liga","AFC Champions League Elite"];
 const selected:any[]=[];
 for(const competition of preferred){
  for(const f of queue.fixtures.filter((x:any)=>x.competition===competition).slice(0,2)){
   if(selected.length<LIMIT&&!selected.some(x=>String(x.fixtureId)===String(f.fixtureId)))selected.push(f);
  }
 }
 for(const f of queue.fixtures){
  if(selected.length>=LIMIT)break;
  if(!selected.some(x=>String(x.fixtureId)===String(f.fixtureId)))selected.push(f);
 }
 const results:any[]=[];
 for(const f of selected){
  const discoveryErrors:string[]=[];
  let matched=bestFixtureEvent(f,events);
  if(!matched&&teamDirectory.length)matched=await fallbackFixtureFromTeams(f,teamDirectory,discoveryErrors);
  if(!matched){
   results.push({fixtureId:String(f.fixtureId),fixture:f,matched:false,gaps:["fixtureMatch","form","standings","headToHead","schedule"],errors:discoveryErrors});
   continue;
  }
  const e=matched.event,h=side(e,"home"),a=side(e,"away"),homeId=teamId(h),awayId=teamId(a);
  const leagueId=eventLeagueId(e),slug=leagueMap.get(leagueId)||inferredSlug(f,e);
  const errors:string[]=[...discoveryErrors];
  const seasonYearRaw=Number(e?.season?.year),seasonYear=Number.isFinite(seasonYearRaw)?seasonYearRaw:Number(DATE.slice(0,4));
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
   {url:scoreboard.url,retrievedAt:scoreboard.retrievedAt,supports:["fixtureMatch"]},
   ...homeHistory.meta,...awayHistory.meta,...pair.meta,...standingsMeta
  ];
  results.push({
   fixtureId:String(f.fixtureId),fixture:f,matched:true,matchConfidence:Number(matched.score.toFixed(3)),
   providerEventId:String(e?.id||""),leagueId,leagueSlug:slug,
   providerTeams:{home:{id:homeId,name:teamName(h)},away:{id:awayId,name:teamName(a)}},season:e?.season||null,
   historyDiagnostics:{home:homeHistory.diagnostics,away:awayHistory.diagnostics},
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
 let validatorReady=0;
 for(const r of results){
  try{
   const record=canonicalRecordFromProbe(r);
   validateResearchArtifact({schema:"fih-daily-research-v5",date:DATE,mode:queue.mode,generatedAt:new Date().toISOString(),researchRunId:queue.researchRunId,fixtureCount:1,fixtures:[record]},DATE,[String(r.fixtureId)],queue.mode);
   r.validatorReady=true;r.canonicalRecord=record;validatorReady++;
  }catch(e:any){r.validatorReady=false;r.validatorError=String(e?.message||e);}
 }
 const matchedCount=results.filter(r=>r.matched).length,full=results.filter(r=>r.matched&&r.gaps.length===0).length;
 const categoryCounts=Object.fromEntries(["form","standings","headToHead","schedule"].map(k=>[k,results.filter(r=>r.matched&&r.categories?.[k]?.complete).length]));
 const anyUseful=results.filter(r=>r.matched&&Object.values(r.categories||{}).some((c:any)=>c?.complete)).length;
 const out={schema:"fih-hybrid-research-probe-v3",date:DATE,researchRunId:queue.researchRunId,generatedAt:new Date().toISOString(),limit:selected.length,provider:"ESPN_PUBLIC_JSON",nonCanonical:true,summary:{attempted:selected.length,matched:matchedCount,fixturesWithAnyCompleteCategory:anyUseful,fullEvidenceReady:full,validatorReady,needsGapResearch:selected.length-full,categoryComplete:categoryCounts,cacheEntries:cache.size},results};
 const outPath=path.join(root,"data/research-probe",DATE+".json");
 fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(out,null,2)+"\n");
 console.log(JSON.stringify({outPath,...out.summary},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
