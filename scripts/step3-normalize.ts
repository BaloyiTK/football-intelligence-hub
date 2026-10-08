import {Match, TeamEvidence, FihV2Input} from "./fih-probability-v2";

type UsageStatus="USED"|"DERIVED"|"CONTEXT_ONLY"|"UNAVAILABLE";
type Usage={status:UsageStatus;source:string;detail:string;value?:number};
export type Step3Normalized={
  input:FihV2Input;
  usage:{
    home:Record<string,Usage>;
    away:Record<string,Usage>;
    shared:Record<string,Usage>;
  };
};

const finite=(v:any)=>{const n=Number(v);return Number.isFinite(n)?n:undefined};
const teamMatches=(team:string,rows:any[]):Match[]=>{
  if(!Array.isArray(rows))return [];
  return rows.filter(m=>m&&["HOME","AWAY"].includes(String(m.venue))&&finite(m.goalsFor)!==undefined&&finite(m.goalsAgainst)!==undefined)
    .map(m=>({
      home:m.venue==="HOME"?team:String(m.opponent||"UNKNOWN"),
      away:m.venue==="HOME"?String(m.opponent||"UNKNOWN"):team,
      homeGoals:m.venue==="HOME"?Number(m.goalsFor):Number(m.goalsAgainst),
      awayGoals:m.venue==="HOME"?Number(m.goalsAgainst):Number(m.goalsFor)
    }));
};

const profile=(team:string,ms:Match[])=>{
  if(!ms.length)return {};
  const gf=(m:Match)=>m.home===team?m.homeGoals:m.awayGoals;
  const ga=(m:Match)=>m.home===team?m.awayGoals:m.homeGoals;
  const n=ms.length;
  return {
    scoringRate:ms.filter(m=>gf(m)>0).length/n,
    concedingRate:ms.filter(m=>ga(m)>0).length/n,
    bttsRate:ms.filter(m=>gf(m)>0&&ga(m)>0).length/n,
    over25Rate:ms.filter(m=>gf(m)+ga(m)>=3).length/n
  };
};

const standingMetrics=(node:any)=>{
  if(!node||typeof node!=="object")return {};
  const played=finite(node.matches??node.matchesPlayed);
  const points=finite(node.points);
  const directGd=finite(node.goalDifference);
  const gf=finite(node.goalsFor),ga=finite(node.goalsAgainst);
  const totalGd=directGd!==undefined?directGd:(gf!==undefined&&ga!==undefined?gf-ga:undefined);
  return {
    ppg:played!==undefined&&played>0&&points!==undefined?points/played:undefined,
    goalDifferencePerGame:played!==undefined&&played>0&&totalGd!==undefined?totalGd/played:undefined
  };
};

const parseKickoff=(raw:any)=>{
  const s=String(raw||"");
  const m=s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if(!m)return NaN;
  return Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]));
};
const restDays=(rows:any[],kickoff:any)=>{
  const ko=parseKickoff(kickoff);
  if(!Number.isFinite(ko)||!Array.isArray(rows))return undefined;
  const ts=rows.map(m=>Date.parse(String(m?.date||""))).filter(t=>Number.isFinite(t)&&t<ko);
  if(!ts.length)return undefined;
  const last=Math.max(...ts);
  return Math.max(0,(ko-last)/86400000);
};


const usage=(status:UsageStatus,source:string,detail:string,value?:number):Usage=>
  value===undefined?{status,source,detail}:{status,source,detail,value};

export function normalizeResearchRecord(r:any):Step3Normalized{
  if(!r?.fixture?.home||!r?.fixture?.away)throw new Error("STEP3_NORMALIZE_FIXTURE_IDENTITY_MISSING "+String(r?.fixtureId||""));
  const facts=r.facts||{},form=facts.form?.data||{},homeTeam=String(r.fixture.home),awayTeam=String(r.fixture.away);
  const homeOverall=teamMatches(homeTeam,form.homeTeam?.overallLast5||[]);
  const homeVenueRaw=teamMatches(homeTeam,form.homeTeam?.homeLast5||[]);
  const homeVenue=homeVenueRaw.length===5?homeVenueRaw:[];
  const awayOverall=teamMatches(awayTeam,form.awayTeam?.overallLast5||[]);
  const awayVenueRaw=teamMatches(awayTeam,form.awayTeam?.awayLast5||[]);
  const awayVenue=awayVenueRaw.length===5?awayVenueRaw:[];

  const hs=standingMetrics(facts.standings?.data?.homeTeam);
  const as=standingMetrics(facts.standings?.data?.awayTeam);
  const hp=profile(homeTeam,homeOverall),ap=profile(awayTeam,awayOverall);
  const hr=restDays(form.homeTeam?.overallLast5||[],r.fixture.kickoff);
  const ar=restDays(form.awayTeam?.overallLast5||[],r.fixture.kickoff);

  const home:TeamEvidence={team:homeTeam,overall:homeOverall,venue:homeVenue,...hs,...hp,...(hr!==undefined?{restDays:hr}:{})};
  const away:TeamEvidence={team:awayTeam,overall:awayOverall,venue:awayVenue,...as,...ap,...(ar!==undefined?{restDays:ar}:{})};

  const metric=(v:number|undefined,source:string,detail:string,derived=true)=>
    v===undefined?usage("UNAVAILABLE",source,detail):usage(derived?"DERIVED":"USED",source,detail,v);

  return {
    input:{home,away},
    usage:{
      home:{
        overallForm:usage(homeOverall.length?"USED":"UNAVAILABLE","facts.form.homeTeam.overallLast5",homeOverall.length+" verified matches"),
        venueForm:usage(homeVenue.length===5?"USED":"UNAVAILABLE","facts.form.homeTeam.homeLast5",homeVenue.length===5?"5 verified home matches":homeVenueRaw.length+" of 5 home matches; partial venue form not used"),
        ppg:metric(hs.ppg,"facts.standings.homeTeam.points/matches","points per game is derived in Step 3"),
        goalDifferencePerGame:metric(hs.goalDifferencePerGame,"facts.standings.homeTeam","goal difference per game is derived in Step 3"),
        goalsProfile:usage(homeOverall.length?"DERIVED":"UNAVAILABLE","facts.form.homeTeam.overallLast5","scoring/conceding/BTTS/Over2.5 rates derived in Step 3"),
        resultProfileOverall:usage(homeOverall.length?"DERIVED":"UNAVAILABLE","facts.form.homeTeam.overallLast5","W/D/L, points, PPG and result rates derived in Step 3 from scorelines"),
        resultProfileVenue:usage(homeVenue.length===5?"DERIVED":"UNAVAILABLE","facts.form.homeTeam.homeLast5",homeVenue.length===5?"venue W/D/L, points, PPG and result rates derived from 5 HOME matches":"venue result profile requires exactly 5 HOME matches"),
        restDays:metric(hr,"facts.form.homeTeam.overallLast5 + fixture.kickoff","days since latest verified match")
      },
      away:{
        overallForm:usage(awayOverall.length?"USED":"UNAVAILABLE","facts.form.awayTeam.overallLast5",awayOverall.length+" verified matches"),
        venueForm:usage(awayVenue.length===5?"USED":"UNAVAILABLE","facts.form.awayTeam.awayLast5",awayVenue.length===5?"5 verified away matches":awayVenueRaw.length+" of 5 away matches; partial venue form not used"),
        ppg:metric(as.ppg,"facts.standings.awayTeam.points/matches","points per game is derived in Step 3"),
        goalDifferencePerGame:metric(as.goalDifferencePerGame,"facts.standings.awayTeam","goal difference per game is derived in Step 3"),
        goalsProfile:usage(awayOverall.length?"DERIVED":"UNAVAILABLE","facts.form.awayTeam.overallLast5","scoring/conceding/BTTS/Over2.5 rates derived in Step 3"),
        resultProfileOverall:usage(awayOverall.length?"DERIVED":"UNAVAILABLE","facts.form.awayTeam.overallLast5","W/D/L, points, PPG and result rates derived in Step 3 from scorelines"),
        resultProfileVenue:usage(awayVenue.length===5?"DERIVED":"UNAVAILABLE","facts.form.awayTeam.awayLast5",awayVenue.length===5?"venue W/D/L, points, PPG and result rates derived from 5 AWAY matches":"venue result profile requires exactly 5 AWAY matches"),
        restDays:metric(ar,"facts.form.awayTeam.overallLast5 + fixture.kickoff","days since latest verified match")
      },
      shared:{
        headToHead:usage(facts.headToHead?.status&&facts.headToHead.status!=="UNAVAILABLE"?"CONTEXT_ONLY":"UNAVAILABLE","facts.headToHead","supporting context; not numerically scored by FIH V2"),
        squadAvailability:usage(facts.squadAvailability?.status&&facts.squadAvailability.status!=="UNAVAILABLE"?"CONTEXT_ONLY":"UNAVAILABLE","facts.squadAvailability","retained for audit; no uncalibrated injury-severity score is invented"),
        competitionContext:usage(facts.competitionContext?.status&&facts.competitionContext.status!=="UNAVAILABLE"?"CONTEXT_ONLY":"UNAVAILABLE","facts.competitionContext","retained for audit; no uncalibrated motivation score is invented"),
        teamQuality:usage(facts.teamQuality?.status&&facts.teamQuality.status!=="UNAVAILABLE"?"CONTEXT_ONLY":"UNAVAILABLE","facts.teamQuality","retained for audit; no uncalibrated team-quality score is invented"),
        opponentStrength:usage(facts.opponentStrength?.status&&facts.opponentStrength.status!=="UNAVAILABLE"?"CONTEXT_ONLY":"UNAVAILABLE","facts.opponentStrength","retained for audit; no numeric opponent-strength score without a verified/calibrated mapping")
      }
    }
  };
}
