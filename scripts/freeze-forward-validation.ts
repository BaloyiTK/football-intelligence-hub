import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MODEL_VERSION="v2.9-market-specific-quality-selector";
const date=process.argv[2]||new Date().toISOString().slice(0,10);
const predictionFile=path.join(process.cwd(),"data","predictions",date+".json");
const evidenceDir=path.join(process.cwd(),"data","forward-validation");
const evidenceFile=path.join(evidenceDir,date+".json");
if(!fs.existsSync(predictionFile)) throw new Error("Missing published prediction artifact: "+predictionFile);

const raw=fs.readFileSync(predictionFile);
const data=JSON.parse(raw.toString("utf8"));
const immutableProjection=(d:any)=>({date:d.date,timezone:d.timezone??null,fixtures:(d.fixtures??[]).map((x:any)=>({
  fixtureKey:x.fixtureKey,date:x.date??d.date,competition:x.competition??null,leagueId:x.leagueId??null,
  kickoff:x.kickoff??x.kickoffTime??null,homeTeam:x.homeTeam,awayTeam:x.awayTeam,
  sources:x.sources??null,model:x.model
}))});
const sha256=crypto.createHash("sha256").update(JSON.stringify(immutableProjection(data))).digest("hex");
if(data.date!==date||!Array.isArray(data.fixtures)) throw new Error("Invalid prediction artifact for "+date);

const frozen=data.fixtures.map((x:any)=>{
  if(!x.fixtureKey||!x.model?.recommendedBet) throw new Error("Cannot freeze malformed published fixture");
  if(x.model.modelVersion!==MODEL_VERSION) throw new Error("Forward validation only accepts locked V2.9");
  return {
    fixtureKey:x.fixtureKey,date:x.date??date,competition:x.competition??null,
    kickoff:x.kickoff??x.kickoffTime??null,homeTeam:x.homeTeam,awayTeam:x.awayTeam,
    modelVersion:x.model.modelVersion,
    prediction:{home:x.model.home,draw:x.model.draw,away:x.model.away,over15:x.model.over15,over25:x.model.over25,doubleChance:x.model.doubleChance,recommendedBet:x.model.recommendedBet}
  };
});

if(fs.existsSync(evidenceFile)){
  const existing=JSON.parse(fs.readFileSync(evidenceFile,"utf8"));
  const existingHash=existing.immutablePredictionSha256??existing.predictionArtifactSha256;
  if(existingHash!==sha256) throw new Error("IMMUTABILITY VIOLATION: frozen prediction fields changed after forward-validation freeze for "+date);
  console.log(JSON.stringify({date,status:"forward-validation-already-frozen",fixtures:frozen.length,sha256}));
  process.exit(0);
}

fs.mkdirSync(evidenceDir,{recursive:true});
const record={
  schemaVersion:"1.0",date,modelVersion:MODEL_VERSION,
  frozenAt:new Date().toISOString(),predictionArtifact:"data/predictions/"+date+".json",
  predictionArtifactSha256:sha256,immutablePredictionSha256:sha256,hashScope:"prediction-fields-only-results-may-be-appended",fixtureCount:frozen.length,fixtures:frozen
};
fs.writeFileSync(evidenceFile,JSON.stringify(record,null,2)+"\n");
console.log(JSON.stringify({date,status:"forward-validation-frozen",fixtures:frozen.length,sha256,evidenceFile}));
