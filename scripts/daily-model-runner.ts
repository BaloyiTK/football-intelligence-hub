import fs from "node:fs";
import path from "node:path";
import { fihV2, Match, TeamEvidence } from "./fih-probability-v2";
import { validateDailyResearch } from "./research-canonical";

const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),root=process.cwd();

const finite=(v:any)=>{const n=Number(v);return Number.isFinite(n)?n:undefined};
const rate=(v:any)=>{const n=finite(v);return n===undefined?undefined:(n>1?n/100:n)};
const parseMatch=(s:any):Match|null=>{
 if(typeof s!=="string")return null;
 const m=s.trim().match(/^(.+?)\s+(\d+)\s*[-–]\s*(\d+)\s+(.+)$/);
 if(!m)return null;
 return {home:m[1].trim(),homeGoals:Number(m[2]),awayGoals:Number(m[3]),away:m[4].trim()};
};
const matches=(v:any):Match[]=>Array.isArray(v)?v.map(x=>typeof x==="string"?parseMatch(x):x).filter((m:any)=>m&&typeof m.home==="string"&&typeof m.away==="string"&&Number.isFinite(Number(m.homeGoals))&&Number.isFinite(Number(m.awayGoals))).map((m:any)=>({home:m.home,away:m.away,homeGoals:Number(m.homeGoals),awayGoals:Number(m.awayGoals),...(Number.isFinite(Number(m.opponentStrength))?{opponentStrength:Number(m.opponentStrength)}:{})})):[];

export function researchRecordToV2(r:any){
 const e=r.evidence||{}, overallData=e.overallForm?.data||{}, verifiedOverall=r.verifiedInputs?.overallMatchSeries||{}, overall={home:overallData.home??e.overallForm?.homeMatches??verifiedOverall.home??[],away:overallData.away??e.overallForm?.awayMatches??verifiedOverall.away??[]}, venue=e.venueForm?.data||{}, table=e.leaguePosition?.data||{}, xg=e.xgXga?.data||{}, goals=e.goalsProfile?.data||{}, rest=e.restSchedule?.data||{};
 const homeTeam=r.fixture.home,awayTeam=r.fixture.away;
 const home:TeamEvidence={team:homeTeam,overall:matches(overall.home),venue:matches(venue.homeLast5)};
 const away:TeamEvidence={team:awayTeam,overall:matches(overall.away),venue:matches(venue.awayLast5)};
 const h=table.HJK||table.home||table[homeTeam],a=table.VPS||table.away||table[awayTeam];
 if(h){home.ppg=finite(h.ppg);if(finite(h.gd)!==undefined&&finite(h.matches))home.goalDifferencePerGame=finite(h.gd)!/finite(h.matches)!}
 if(a){away.ppg=finite(a.ppg);if(finite(a.gd)!==undefined&&finite(a.matches))away.goalDifferencePerGame=finite(a.gd)!/finite(a.matches)!}
 home.xgFor=finite(xg.home?.xgFor??xg[homeTeam]?.xgFor??xg.HJK_xGF_perGame);home.xgAgainst=finite(xg.home?.xgAgainst??xg[homeTeam]?.xgAgainst??xg.HJK_xGA_perGame);
 away.xgFor=finite(xg.away?.xgFor??xg[awayTeam]?.xgFor??xg.VPS_xGF_perGame);away.xgAgainst=finite(xg.away?.xgAgainst??xg[awayTeam]?.xgAgainst??xg.VPS_xGA_perGame);
 const hg=goals.home||goals[homeTeam]||goals.HJK,ag=goals.away||goals[awayTeam]||goals.VPS;
 if(hg){home.scoringRate=rate(hg.scoringRate??hg.scoringPct);home.concedingRate=rate(hg.concedingRate??hg.concedingPct);home.bttsRate=rate(hg.bttsRate??hg.bttsPct);home.over25Rate=rate(hg.over25Rate??hg.over25Pct)}
 if(ag){away.scoringRate=rate(ag.scoringRate??ag.scoringPct);away.concedingRate=rate(ag.concedingRate??ag.concedingPct);away.bttsRate=rate(ag.bttsRate??ag.bttsPct);away.over25Rate=rate(ag.over25Rate??ag.over25Pct)}
 home.restDays=finite(rest.home?.days??rest[homeTeam]?.days);away.restDays=finite(rest.away?.days??rest[awayTeam]?.days);
 return {home,away,h2h:matches(e.h2h?.data)};
}

export function modelFixture(r:any){const input=researchRecordToV2(r),result:any=fihV2(input);return {fixtureId:String(r.fixtureId),fixture:r.fixture,modelVersion:result.version,status:result.status,generatedAt:new Date().toISOString(),inputCounts:{homeOverall:input.home.overall.length,awayOverall:input.away.overall.length,homeVenue:input.home.venue?.length||0,awayVenue:input.away.venue?.length||0},inputCoverage:{home:{ppg:Number.isFinite(input.home.ppg),gd:Number.isFinite(input.home.goalDifferencePerGame),xgFor:Number.isFinite(input.home.xgFor),xgAgainst:Number.isFinite(input.home.xgAgainst),goalsProfile:Number.isFinite(input.home.over25Rate)||Number.isFinite(input.home.bttsRate),rest:Number.isFinite(input.home.restDays)},away:{ppg:Number.isFinite(input.away.ppg),gd:Number.isFinite(input.away.goalDifferencePerGame),xgFor:Number.isFinite(input.away.xgFor),xgAgainst:Number.isFinite(input.away.xgAgainst),goalsProfile:Number.isFinite(input.away.over25Rate)||Number.isFinite(input.away.bttsRate),rest:Number.isFinite(input.away.restDays)}},...result}};

if(process.env.FIH_MODEL_TEST_CHECKPOINT){
 const cp=JSON.parse(fs.readFileSync(path.join(root,process.env.FIH_MODEL_TEST_CHECKPOINT),"utf8")),id=String(process.env.FIH_FIXTURE_ID||""),r=cp.workingRecords?.[id];
 if(!r)throw new Error("MODEL_TEST_FIXTURE_NOT_FOUND "+id);
 console.log(JSON.stringify({testOnly:true,canonical:false,...modelFixture(r)},null,2));
}else{
 const ledger=JSON.parse(fs.readFileSync(path.join(root,"data/run-state",DATE+".json"),"utf8")),ids=ledger.fixtures.filter((f:any)=>f.eligible).map((f:any)=>String(f.id)),v=validateDailyResearch(root,DATE,ids,"PREDICTION");
 const fixtures=v.artifact.fixtures.map(modelFixture),out=path.join(root,"data/model",DATE+".json"),artifact={schema:"fih-daily-model-v2",date:DATE,model:"FIH-V2-RESEARCH",generatedAt:new Date().toISOString(),fixtureCount:fixtures.length,fixtures};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(artifact,null,2)+"\n");const check=JSON.parse(fs.readFileSync(out,"utf8"));if(check.date!==DATE||check.fixtureCount!==ids.length||check.fixtures.length!==ids.length)throw new Error("DAILY_MODEL_PERSIST_VERIFY_FAILED");console.log(JSON.stringify({ok:true,date:DATE,fixtures:fixtures.length,canonical:out},null,2));
}
