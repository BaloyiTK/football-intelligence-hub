import fs from "node:fs";
import path from "node:path";
const date=process.argv[2]||new Date().toISOString().slice(0,10);
const file=path.join(process.cwd(),"data","predictions",date+".json");
if(!fs.existsSync(file)) throw new Error("Missing published prediction artifact: "+file);
const data=JSON.parse(fs.readFileSync(file,"utf8"));
if(data.date!==date) throw new Error("Prediction artifact date mismatch");
if(!Array.isArray(data.fixtures)) throw new Error("Prediction artifact fixtures must be an array");
const recommended=data.fixtures.filter((x:any)=>x?.model?.recommendedBet);
for(const x of recommended){if(!x.fixtureKey||!x.homeTeam||!x.awayTeam||!x.model?.recommendedBet?.pick)throw new Error("Malformed published recommendation");}
console.log(JSON.stringify({date,fixtures:data.fixtures.length,recommended:recommended.length,status:"publish-verified"}));
