import fs from "node:fs";
import path from "node:path";

const date=process.argv[2]||new Date().toISOString().slice(0,10);
const file=path.join(process.cwd(),"data","predictions",date+".json");
if(!fs.existsSync(file)) throw new Error("Missing published prediction artifact: "+file);

const data=JSON.parse(fs.readFileSync(file,"utf8"));
if(data.date!==date) throw new Error("Prediction artifact date mismatch");
if(!Array.isArray(data.fixtures)) throw new Error("Prediction artifact fixtures must be an array");

const seen=new Set<string>();
const requiredBetV23=["market","pick","probability","rawProbability","reliability","rating"];
const requiredBetLegacy=["market","pick","probability","rating"];
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
  if(model.modelVersion==="v2.3-backtest-calibrated-selector"){
    for(const field of ["home","draw","away"]) if(model[field]===undefined||model[field]===null) throw new Error("V2.3 fixture missing required 1X2 output "+field+": "+x.fixtureKey);
  }
  const supportedModelVersions=new Set(["v2.1-dixon-coles-market-selector","v2.2-backtest-calibrated-selector","v2.3-backtest-calibrated-selector"]);
  if(!supportedModelVersions.has(model.modelVersion)) throw new Error("Unexpected modelVersion: "+x.fixtureKey);
  if(date>="2026-10-05"&&model.modelVersion!=="v2.3-backtest-calibrated-selector") throw new Error("Current publication must use V2.3: "+x.fixtureKey);
  if(!model.modelLevel) throw new Error("Published model missing modelLevel: "+x.fixtureKey);
  const bet=model.recommendedBet;
  const requiredBet=model.modelVersion==="v2.3-backtest-calibrated-selector"?requiredBetV23:requiredBetLegacy;
  for(const field of requiredBet) if(bet[field]===undefined||bet[field]===null||bet[field]==="") throw new Error(`recommendedBet missing ${field}: ${x.fixtureKey}`);
  if(typeof bet.probability!=="number"||!Number.isFinite(bet.probability)) throw new Error("recommendedBet invalid probability: "+x.fixtureKey);
  if(bet.probability<0||bet.probability>100) throw new Error("recommendedBet probability out of range: "+x.fixtureKey);
  if(model.modelVersion==="v2.3-backtest-calibrated-selector"){
    for(const field of ["rawProbability","reliability"]) if(typeof bet[field]!=="number"||!Number.isFinite(bet[field])) throw new Error(`recommendedBet invalid ${field}: ${x.fixtureKey}`);
    if(bet.probability<68||bet.rawProbability<0||bet.rawProbability>100||bet.reliability<=0||bet.reliability>1) throw new Error("recommendedBet probability/reliability out of range: "+x.fixtureKey);
    if(bet.market!=="1X2") throw new Error("Only 1X2 recommendations are approved: "+x.fixtureKey);
    if(!["Home","Draw","Away"].includes(bet.pick)) throw new Error("Unapproved 1X2 pick: "+bet.pick+" "+x.fixtureKey);
  }
  if(!["Elite","Strong","Good"].includes(bet.rating)) throw new Error("Invalid recommendation rating: "+x.fixtureKey);
  if(x.recommendedBet&&JSON.stringify(x.recommendedBet)!==JSON.stringify(bet)) throw new Error("Top-level/model recommendedBet mismatch: "+x.fixtureKey);
}
console.log(JSON.stringify({date,fixtures:data.fixtures.length,recommended:data.fixtures.length,status:"publish-verified",market:"1X2"}));
