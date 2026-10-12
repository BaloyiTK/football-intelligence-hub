import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const tz="Africa/Johannesburg";
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const DATE=process.env.FIH_DATE||today();
const LIMIT=Math.max(1,Math.min(50,Number(process.env.FIH_HYBRID_LIMIT||10)));
const BASE="https://www.sofascore.com/api/v1";
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
const source=(url:string)=>({url,retrievedAt:new Date().toISOString()});
async function getJson(pathname:string){
 const url=pathname.startsWith("http")?pathname:BASE+pathname;
 let last:any;
 for(let attempt=1;attempt<=3;attempt++){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);
  try{
   const r=await fetch(url,{signal:c.signal,headers:{"accept":"application/json","user-agent":"FootballIntelligenceHub/0.1 hybrid-research-probe"}});
   if(r.ok){
    const type=r.headers.get("content-type")||"";
    if(!type.includes("json"))throw new Error("NON_JSON_"+type);
    return {url,json:await r.json(),status:r.status};
   }
   last=new Error("HTTP_"+r.status);
   if(r.status!==429&&r.status<500)break;
  }catch(e){last=e}
  finally{clearTimeout(timer)}
  await sleep(750*attempt);
 }
 throw new Error("SOFASCORE_FETCH_FAILED "+url+" "+String(last?.message||last));
}
const cache=new Map<string,Promise<any>>();
const cached=(key:string,fn:()=>Promise<any>)=>{
 if(!cache.has(key))cache.set(key,fn());
 return cache.get(key)!;
};
function eventDate(e:any){
 const t=Number(e?.startTimestamp);
 return Number.isFinite(t)?new Date(t*1000).toISOString():null;
}
function isFinished(e:any){
 const t=String(e?.status?.type||"").toLowerCase();
 return t==="finished"||Number(e?.status?.code)===100;
}
function scoreFor(e:any,teamId:number){
 const home=Number(e?.homeTeam?.id)===teamId;
 const hf=Number(e?.homeScore?.current),af=Number(e?.awayScore?.current);
 if(!Number.isFinite(hf)||!Number.isFinite(af))return null;
 return {
  date:eventDate(e),
  opponent:String(home?e?.awayTeam?.name:e?.homeTeam?.name||""),
  venue:home?"HOME":"AWAY",
  goalsFor:home?hf:af,
  goalsAgainst:home?af:hf,
  sourceRef:BASE+"/event/"+String(e?.id)
 };
}
function recent(events:any[],teamId:number,venue?:string){
 const rows=events.filter(isFinished).map(e=>scoreFor(e,teamId)).filter(Boolean).filter((r:any)=>!venue||r.venue===venue);
 const seen=new Set<string>(),out:any[]=[];
 for(const r of rows){
  const k=[r.date,r.opponent,r.venue,r.goalsFor,r.goalsAgainst].join("|");
  if(seen.has(k))continue;seen.add(k);out.push(r);if(out.length===5)break;
 }
 return out;
}
function standingRow(payload:any,teamId:number){
 const groups=Array.isArray(payload?.standings)?payload.standings:[];
 for(const g of groups){
  for(const r of Array.isArray(g?.rows)?g.rows:[]){
   if(Number(r?.team?.id)!==teamId)continue;
   const gf=Number(r?.scoresFor),ga=Number(r?.scoresAgainst);
   return {
    position:Number(r?.position),matches:Number(r?.matches),wins:Number(r?.wins),draws:Number(r?.draws),losses:Number(r?.losses),
    points:Number(r?.points),goalsFor:gf,goalsAgainst:ga,goalDifference:Number.isFinite(Number(r?.scoreDiff))?Number(r.scoreDiff):(Number.isFinite(gf)&&Number.isFinite(ga)?gf-ga:null)
   };
  }
 }
 return null;
}
function h2hRows(payload:any){
 const out:any[]=[];
 for(const e of Array.isArray(payload?.events)?payload.events:[]){
  if(!isFinished(e))continue;
  const hg=Number(e?.homeScore?.current),ag=Number(e?.awayScore?.current);
  if(!Number.isFinite(hg)||!Number.isFinite(ag))continue;
  out.push({date:eventDate(e),homeTeam:String(e?.homeTeam?.name||""),awayTeam:String(e?.awayTeam?.name||""),homeGoals:hg,awayGoals:ag,sourceRef:BASE+"/event/"+String(e?.id)});
  if(out.length===5)break;
 }
 return out;
}
function bestFixtureEvent(f:any,events:any[]){
 let best:any=null,bestScore=0;
 for(const e of events){
  const hs=similarity(f.home,String(e?.homeTeam?.name||"")),as=similarity(f.away,String(e?.awayTeam?.name||""));
  const score=(hs+as)/2;
  if(hs>=.55&&as>=.55&&score>bestScore){best=e;bestScore=score;}
 }
 return best?{event:best,score:bestScore}:null;
}

async function main(){
 const scheduled=await getJson("/sport/football/scheduled-events/"+DATE);
 const allEvents=Array.isArray(scheduled.json?.events)?scheduled.json.events:[];
 const fixtures=queue.fixtures.slice(0,LIMIT);
 const results:any[]=[];
 for(const f of fixtures){
  const matched=bestFixtureEvent(f,allEvents);
  if(!matched){
   results.push({fixtureId:String(f.fixtureId),fixture:f,matched:false,gaps:["fixtureMatch","form","standings","headToHead","schedule"],errors:[]});
   continue;
  }
  const e=matched.event,homeId=Number(e?.homeTeam?.id),awayId=Number(e?.awayTeam?.id),eventId=Number(e?.id);
  const utid=Number(e?.tournament?.uniqueTournament?.id),seasonId=Number(e?.season?.id);
  const errors:string[]=[];
  const safe=async(label:string,p:Promise<any>)=>{try{return await p}catch(err:any){errors.push(label+":"+String(err?.message||err));return null}};
  const homeLast=await safe("homeLast",cached("last:"+homeId,()=>getJson("/team/"+homeId+"/events/last/0")));
  const awayLast=await safe("awayLast",cached("last:"+awayId,()=>getJson("/team/"+awayId+"/events/last/0")));
  const homeNext=await safe("homeNext",cached("next:"+homeId,()=>getJson("/team/"+homeId+"/events/next/0")));
  const awayNext=await safe("awayNext",cached("next:"+awayId,()=>getJson("/team/"+awayId+"/events/next/0")));
  const h2h=await safe("h2h",getJson("/event/"+eventId+"/h2h/0"));
  const standings=(Number.isFinite(utid)&&Number.isFinite(seasonId))?await safe("standings",cached("standings:"+utid+":"+seasonId,()=>getJson("/unique-tournament/"+utid+"/season/"+seasonId+"/standings/total"))):null;

  const homeEvents=Array.isArray(homeLast?.json?.events)?homeLast.json.events:[];
  const awayEvents=Array.isArray(awayLast?.json?.events)?awayLast.json.events:[];
  const homeOverall=recent(homeEvents,homeId),homeVenue=recent(homeEvents,homeId,"HOME");
  const awayOverall=recent(awayEvents,awayId),awayVenue=recent(awayEvents,awayId,"AWAY");
  const formOk=homeOverall.length===5&&homeVenue.length===5&&awayOverall.length===5&&awayVenue.length===5;
  const homeStanding=standings?standingRow(standings.json,homeId):null,awayStanding=standings?standingRow(standings.json,awayId):null;
  const standingsOk=!!homeStanding&&!!awayStanding;
  const h2hMatches=h2h?h2hRows(h2h.json):[],h2hOk=h2hMatches.length===5;
  const latestHome=homeOverall[0]?.date||null,latestAway=awayOverall[0]?.date||null;
  const nextHome=(homeNext?.json?.events||[])[0],nextAway=(awayNext?.json?.events||[])[0];
  const scheduleOk=!!latestHome&&!!latestAway;
  const gaps=[...(!formOk?["form"]:[]),...(!standingsOk?["standings"]:[]),...(!h2hOk?["headToHead"]:[]),...(!scheduleOk?["schedule"]:[])];
  const sourceMetadata=[
   source(scheduled.url),
   ...(homeLast?[source(homeLast.url)]:[]),...(awayLast?[source(awayLast.url)]:[]),
   ...(homeNext?[source(homeNext.url)]:[]),...(awayNext?[source(awayNext.url)]:[]),
   ...(h2h?[source(h2h.url)]:[]),...(standings?[source(standings.url)]:[])
  ];
  results.push({
   fixtureId:String(f.fixtureId),fixture:f,matched:true,matchConfidence:Number(matched.score.toFixed(3)),providerEventId:eventId,
   teamIds:{home:homeId,away:awayId},tournament:{uniqueTournamentId:utid,seasonId},
   categories:{
    form:{complete:formOk,homeOverall,homeVenue,awayOverall,awayVenue},
    standings:{complete:standingsOk,homeTeam:homeStanding,awayTeam:awayStanding},
    headToHead:{complete:h2hOk,matches:h2hMatches},
    schedule:{complete:scheduleOk,homeTeam:{latestCompletedMatchDate:latestHome,nextScheduledMatchDate:eventDate(nextHome)},awayTeam:{latestCompletedMatchDate:latestAway,nextScheduledMatchDate:eventDate(nextAway)}}
   },
   sourceMetadata,gaps,errors
  });
  await sleep(250);
 }
 const matched=results.filter(r=>r.matched).length;
 const full=results.filter(r=>r.matched&&r.gaps.length===0).length;
 const categoryCounts=Object.fromEntries(["form","standings","headToHead","schedule"].map(k=>[k,results.filter(r=>r.matched&&r.categories?.[k]?.complete).length]));
 const out={schema:"fih-hybrid-research-probe-v1",date:DATE,researchRunId:queue.researchRunId,generatedAt:new Date().toISOString(),limit:fixtures.length,provider:"SOFASCORE_PUBLIC_JSON",nonCanonical:true,summary:{attempted:fixtures.length,matched,fullEvidenceReady:full,needsGapResearch:fixtures.length-full,categoryComplete:categoryCounts,cacheEntries:cache.size},results};
 const outPath=path.join(root,"data/research-probe",DATE+".json");
 fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(out,null,2)+"\n");
 console.log(JSON.stringify({outPath,...out.summary},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
