import fs from "node:fs";
import path from "node:path";

const runFile=process.argv[2];
if(!runFile) throw new Error("Usage: tsx scripts/publish-from-run.ts <run-file>");
const absolute=path.resolve(process.cwd(),runFile);
if(!absolute.startsWith(path.resolve(process.cwd(),"data","runs")+path.sep)) throw new Error("run-file must be under data/runs");
const run=JSON.parse(fs.readFileSync(absolute,"utf8"));
if(run.status!=="complete") throw new Error("Run must be strictly complete before publication");
if(!/^\d{4}-\d{2}-\d{2}$/.test(run.date)) throw new Error("Invalid run date");
const fixtures=(run.fixtures??[]).filter((x:any)=>x.status==="BET"&&x.model?.recommendedBet?.publishable===true).map((x:any)=>({
  date:run.date,
  fixtureKey:x.fixtureKey,
  leagueId:x.leagueId,
  homeTeam:x.homeTeam,
  awayTeam:x.awayTeam,
  status:"prematch",
  sources:x.sources,
  researchedAt:x.researchedAt,
  model:x.model
}));
if(run.metrics?.recommendedBets!=null&&fixtures.length!==run.metrics.recommendedBets) throw new Error(`Publishable BET count mismatch: run=${run.metrics.recommendedBets}, artifact=${fixtures.length}`);
const artifact={
  date:run.date,
  timezone:run.timezone??"Africa/Johannesburg",
  runId:run.runId,
  modelVersion:run.modelVersion,
  generatedFrom:"strict-finalized-run",
  publishedAt:new Date().toISOString(),
  scan:{configuredLeagues:run.metrics?.configuredLeagues,leaguesComplete:run.metrics?.leaguesComplete,fixturesDiscovered:run.metrics?.fixturesDiscovered,fixturesProcessed:run.metrics?.fixturesProcessed,modelled:run.metrics?.modelled,noModel:run.metrics?.noModel,recommendedBets:fixtures.length},
  fixtures
};
const out=path.join(process.cwd(),"data","predictions",run.date+".json");
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(artifact,null,2)+"\n");
console.log(JSON.stringify({status:"artifact-created",date:run.date,fixtures:fixtures.length,file:path.relative(process.cwd(),out)}));
