import fs from "node:fs";
import path from "node:path";

const date=process.argv[2]||new Date().toISOString().slice(0,10);
const file=path.join(process.cwd(),"data","predictions",date+".json");
if(!fs.existsSync(file)) throw new Error("Missing published prediction artifact: "+file);

const data=JSON.parse(fs.readFileSync(file,"utf8"));
if(data.date!==date) throw new Error("Prediction artifact date mismatch");
if(!Array.isArray(data.fixtures)) throw new Error("Prediction artifact fixtures must be an array");

const seen=new Set<string>();
const requiredBet=["market","pick","probability","rawProbability","reliability","rating"];
for(const x of data.fixtures as any[]){
  if(!x.fixtureKey||!x.homeTeam||!x.awayTeam) throw new Error("Malformed published fixture identity");
  if(seen.has(x.fixtureKey)) throw new Error("Duplicate published fixtureKey: "+x.fixtureKey);
  seen.add(x.fixtureKey);
  if(x.date&&x.date!==date) throw new Error("Published fixture date mismatch: "+x.fixtureKey);
  if(["live","started","completed","finished","cancelled","canceled","abandoned"].includes(String(x.status??"").toLowerCase())) throw new Error("Non-prematch fixture published: "+x.fixtureKey);
  if(!Array.isArray(x.sources)||x.sources.length===0) throw new Error("Published fixture missing sources: "+x.fixtureKey);
  if(!x.researchedAt&&!data.generatedAt) throw new Error("Published fixture missing evidence timestamp: "+x.fixtureKey);
  const model=x.model;
  if(!model||!model.recommendedBet) throw new Error("Public prediction fixture missing recommendedBet: "+x.fixtureKey);
  if(model.modelVersion!=="v2.3-backtest-calibrated-selector") throw new Error("Unexpected modelVersion: "+x.fixtureKey);
  if(!model.modelLevel) throw new Error("Published model missing modelLevel: "+x.fixtureKey);
  const bet=model.recommendedBet;
  for(const field of requiredBet) if(bet[field]===undefined||bet[field]===null||bet[field]==="") throw new Error(`recommendedBet missing ${field}: ${x.fixtureKey}`);
  for(const field of ["probability","rawProbability","reliability"]) if(typeof bet[field]!=="number"||!Number.isFinite(bet[field])) throw new Error(`recommendedBet invalid ${field}: ${x.fixtureKey}`);
  if(bet.probability<68||bet.probability>100||bet.rawProbability<0||bet.rawProbability>100||bet.reliability<=0||bet.reliability>1) throw new Error("recommendedBet probability/reliability out of range: "+x.fixtureKey);
  if(!["Elite","Strong","Good"].includes(bet.rating)) throw new Error("Invalid recommendation rating: "+x.fixtureKey);
  if(x.recommendedBet&&JSON.stringify(x.recommendedBet)!==JSON.stringify(bet)) throw new Error("Top-level/model recommendedBet mismatch: "+x.fixtureKey);
}
console.log(JSON.stringify({date,fixtures:data.fixtures.length,recommended:data.fixtures.length,status:"publish-verified"}));
