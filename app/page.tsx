import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import DatePicker from "./DatePicker";
import KickoffTime from "./KickoffTime";

type PF={date:string;fixtures:any[];modelVersion?:string;scan?:any;results?:{graded?:number;wins?:number;losses?:number;winRate?:number}};
const dir=()=>path.join(process.cwd(),"data","predictions");
const dates=()=>fs.existsSync(dir())?fs.readdirSync(dir()).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x)).map(x=>x.slice(0,10)).sort().reverse():[];
const read=(date:string):PF=>JSON.parse(fs.readFileSync(path.join(dir(),date+".json"),"utf8"));
const leagueRegistry=JSON.parse(fs.readFileSync(path.join(process.cwd(),"data","leagues.json"),"utf8")).leagues as {id:string;country:string;name:string}[];
const leagueMeta=new Map(leagueRegistry.map(l=>[l.id,l]));
const fmt=(date?:string)=>date?new Intl.DateTimeFormat("en-ZA",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Africa/Johannesburg"}).format(new Date(date+"T12:00:00+02:00")):"No slate";
const modelLabel=(value?:string)=>value?.match(/v\\d+(?:\\.\\d+)*/)?.[0]?.toUpperCase()??"Model";
export default async function Home({searchParams}:{searchParams:Promise<{date?:string}>}){
 const q=await searchParams,available=dates(),selected=q.date&&available.includes(q.date)?q.date:available[0];
 const predictions=selected?read(selected):{date:"No published slate",fixtures:[]};
 const matches=predictions.fixtures,past=!!selected&&selected!==available[0],rr=predictions.results;
 const activeModelVersion=predictions.modelVersion??matches.find((m:any)=>m.model?.modelVersion)?.model?.modelVersion;
 const rated=(rating:string)=>matches.filter((m:any)=>m.model?.recommendedBet?.rating===rating).length;
 return <main>
  <nav className="topbar"><Link className="brand" href="/"><span>FIH</span><small>Football Intelligence Hub</small></Link><div className="navmeta"><span className="liveDot"/>{modelLabel(activeModelVersion)} <b>Verified selections</b></div></nav>
  <section className="dashboard">
   <header className="dashboardHead"><div><p className="kicker">{past?"ARCHIVE":"TODAY'S INTELLIGENCE"}</p><h1>{fmt(selected)}</h1><p className="lede">{past?"Frozen forecasts with verified outcomes.":"Verified model selections from today's worldwide football research."}</p></div><DatePicker selected={selected}/></header>
   <div className="metrics">
    <article><small>Selections</small><b>{matches.length}</b><span>published picks</span></article>
    <article><small>Strong + Elite</small><b>{rated("Strong")+rated("Elite")}</b><span>{rated("Elite")} elite</span></article>
    <article><small>{rr?"Win rate":"Leagues scanned"}</small><b>{rr?rr.winRate+"%":predictions.scan?.leagueEntriesChecked??0}</b><span>{rr?((rr.wins??0)+"W · "+(rr.losses??0)+"L"):"worldwide coverage"}</span></article>
   </div>
   <div className="dateRail">{available.slice(0,7).map(d=><Link className={d===selected?"active":""} key={d} href={"/?date="+d}>{new Intl.DateTimeFormat("en-ZA",{day:"2-digit",month:"short",timeZone:"Africa/Johannesburg"}).format(new Date(d+"T12:00:00+02:00"))}</Link>)}</div>
   <div className="sectionTitle"><div><p className="kicker">{past?"HISTORICAL RESULTS":"VERIFIED PICKS"}</p><h2>{past?"How the model performed":"Today's 1X2 edge"}</h2></div><span>{matches.length} matches</span></div>
   <section className="matchGrid">{matches.map((m:any)=>{const x=m.model,b=x?.recommendedBet,r=m.result;const meta=leagueMeta.get(m.leagueId);return <article className="matchCard" key={m.fixtureKey}>
    <div className="matchTop"><div className="competition"><span className="country">{m.country??meta?.country??"International"}</span><span className="league">{m.league??meta?.name??m.leagueId}</span></div><div className="matchMeta"><span className="kickoffLabel">KICKOFF</span><KickoffTime value={m.kickoff} date={m.date??selected}/>{past&&<span className={"outcome "+(r?.outcome==="WIN"?"win":r?.outcome==="LOSS"?"loss":"pending")}>{r?.outcome??"PENDING"}</span>}</div></div>
    <div className="fixture"><strong>{m.homeTeam}</strong><span>vs</span><strong>{m.awayTeam}</strong></div>
    <div className="pick"><div><small>MODEL PICK</small><strong>{b?.pick??"NO BET"}</strong><span>{b?.market??"No qualifying market"}</span></div><div className={"rating "+String(b?.rating??"").toLowerCase()}><b>{b?b.probability+"%":"—"}</b><small>{b?.rating??"—"}</small></div></div>
    <div className="probabilities"><span><small>HOME</small><b>{x?.home??x?.homeWin??"—"}%</b></span><span><small>DRAW</small><b>{x?.draw??"—"}%</b></span><span><small>AWAY</small><b>{x?.away??x?.awayWin??"—"}%</b></span></div>
    {past&&<div className="cardFoot"><span>Actual <b>{r?.actualScore?r.actualScore.home+"–"+r.actualScore.away:"Pending"}</b></span></div>}
   </article>})}</section>
   {matches.length===0&&<div className="empty"><b>No published selections</b><span>There are no verified model picks for this date.</span></div>}
  </section>
  <footer>FIH · Frozen predictions stay immutable. Results are independently verified and added after matches finish.</footer>
 </main>
}