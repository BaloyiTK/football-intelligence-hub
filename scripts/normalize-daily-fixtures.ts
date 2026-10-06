import fs from "node:fs";
import path from "node:path";

const date=process.argv[2];
if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Usage: npm run daily:normalize -- YYYY-MM-DD");
const root=process.cwd(), sourcePath=path.join(root,"data/today_fixture.json");
if(!fs.existsSync(sourcePath)) throw new Error("FRESH_DATA_GATE: data/today_fixture.json is missing");
const snapshot=JSON.parse(fs.readFileSync(sourcePath,"utf8"));
if(snapshot.schema!=="fih-today-fixture-v1"||snapshot.date!==date) throw new Error("FRESH_DATA_GATE: today_fixture is not today's validated schema");
const stages=Array.isArray(snapshot?.payload?.Stages)?snapshot.payload.Stages:[];
const norm=(v:any)=>String(v??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const kickoff=(v:any)=>{const s=String(v??"");if(!/^\d{14}$/.test(s))return null;return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}+02:00`;};
const fixtures:any[]=[];
for(const s of stages) for(const e of Array.isArray(s?.Events)?s.Events:[]){
 const home=e?.T1?.[0]?.Nm, away=e?.T2?.[0]?.Nm, ko=kickoff(e?.Esd);
 if(!home||!away||!ko) continue;
 const league=String(s?.CompN??s?.Cnm??s?.Snm??"Unknown competition");
 const country=String(s?.CompD??s?.CompCnmt??"International");
 const competitionId=String(s?.CompId??s?.Sid??norm(country+"-"+league));
 const status=String(e?.Eps??"").toUpperCase();
 const prematch=["NS","SCHEDULED","NOT STARTED",""].includes(status);
 fixtures.push({
   date,providerFixtureId:String(e?.Eid??""),competitionId,leagueId:competitionId,
   country,league,stage:String(s?.Snm??""),homeTeam:String(home),awayTeam:String(away),kickoff:ko,
   providerStatus:status,eligibility:prematch?"pending-review":"excluded",
   ...(prematch?{}:{exclusionReason:"Not a pre-match fixture at normalization time"}),
   sources:["data/today_fixture.json"],researchComplete:false
 });
}
const out={schema:"fih-daily-evidence-v1",date,timezone:"Africa/Johannesburg",source:"data/today_fixture.json",sourceFetchedAt:snapshot.fetchedAt,sourceStageCount:stages.length,sourceFixtureCount:snapshot.fixtureCount,normalizedFixtureCount:fixtures.length,fixtures};
const outPath=path.join(root,"data/daily-evidence",date+".json");fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({file:path.relative(root,outPath),date,sourceFixtureCount:snapshot.fixtureCount,normalizedFixtureCount:fixtures.length,prematch:fixtures.filter(x=>x.eligibility==="pending-review").length,excluded:fixtures.filter(x=>x.eligibility==="excluded").length},null,2));
