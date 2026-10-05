import fs from "node:fs";
import path from "node:path";

const date=process.argv[2]||new Date().toISOString().slice(0,10);
const file=path.join(process.cwd(),"data","predictions",date+".json");
if(!fs.existsSync(file)) throw new Error("Missing published prediction artifact: "+file);

const data=JSON.parse(fs.readFileSync(file,"utf8"));
if(data.date!==date) throw new Error("Prediction artifact date mismatch");
if(!Array.isArray(data.fixtures)) throw new Error("Prediction artifact fixtures must be an array");

const seen=new Set<string>();
for(const x of data.fixtures as any[]){
  if(!x.fixtureKey||!x.homeTeam||!x.awayTeam) throw new Error("Malformed published fixture identity");
  if(seen.has(x.fixtureKey)) throw new Error("Duplicate published fixtureKey: "+x.fixtureKey);
  seen.add(x.fixtureKey);
  if(x.date&&x.date!==date) throw new Error("Published fixture date mismatch: "+x.fixtureKey);
  if(["live","started","completed","finished","cancelled","canceled","abandoned"].includes(String(x.status??"").toLowerCase())) throw new Error("Non-prematch fixture published: "+x.fixtureKey);
  if(!Array.isArray(x.sources)||x.sources.length===0) throw new Error("Published fixture missing sources: "+x.fixtureKey);
  const model=x.model;
  if(!model||!model.recommendedBet) throw new Error("Public prediction fixture missing recommendedBet: "+x.fixtureKey);
  if(model.modelVersion!=="v2.3.1-supported-selector") throw new Error("Current publication must use v2.3.1-supported-selector: "+x.fixtureKey);
  for(const field of ["home","draw","away","over15","over25","doubleChance"]) if(model[field]===undefined||model[field]===null) throw new Error("Missing required support output "+field+": "+x.fixtureKey);
  const bet=model.recommendedBet;
  for(const field of ["market","pick","probability","rawProbability","reliability","rating"]) if(bet[field]===undefined||bet[field]===null||bet[field]==="") throw new Error("recommendedBet missing "+field+": "+x.fixtureKey);
  if(typeof bet.probability!=="number"||bet.probability<68) throw new Error("Adjusted probability below floor: "+x.fixtureKey);
  const allowed={
    "1X2":new Set(["Home","Draw","Away"]),
    "Total Goals":new Set(["Over 1.5"]),
    "Double Chance":new Set(["1X","X2"])
  } as Record<string,Set<string>>;
  if(!allowed[bet.market]?.has(bet.pick)) throw new Error("Unapproved market/pick: "+bet.market+" / "+bet.pick+" "+x.fixtureKey);
  if(bet.market==="Total Goals"&&bet.pick==="Over 1.5"){
    if(bet.rawProbability<72) throw new Error("Over 1.5 raw below floor: "+x.fixtureKey);
    if(!bet.support||bet.support.pick!=="Over 2.5"||bet.support.rawProbability<68) throw new Error("Over 1.5 lacks strong Over 2.5 support: "+x.fixtureKey);
  }
  if(bet.market==="Double Chance"&&bet.pick==="1X"){
    if(bet.rawProbability<72) throw new Error("1X raw below floor: "+x.fixtureKey);
    if(!bet.support||bet.support.pick!=="Home"||bet.support.rawProbability<62) throw new Error("1X lacks strong Home support: "+x.fixtureKey);
  }
  if(bet.market==="Double Chance"&&bet.pick==="X2"){
    if(bet.rawProbability<72) throw new Error("X2 raw below floor: "+x.fixtureKey);
    if(!bet.support||bet.support.pick!=="Away"||bet.support.rawProbability<62) throw new Error("X2 lacks strong Away support: "+x.fixtureKey);
  }
  if(bet.market==="1X2"&&bet.rawProbability<62) throw new Error("1X2 raw below floor: "+x.fixtureKey);
  if(!["Elite","Strong","Good"].includes(bet.rating)) throw new Error("Invalid recommendation rating: "+x.fixtureKey);
}
console.log(JSON.stringify({date,fixtures:data.fixtures.length,recommended:data.fixtures.length,status:"publish-verified",model:"v2.3.1-supported-selector"}));
