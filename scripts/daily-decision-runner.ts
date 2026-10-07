import fs from "node:fs";
import path from "node:path";

const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const root=process.cwd(),modelDir=path.join(root,`data/model/${DATE}`),researchDir=path.join(root,`data/research/${DATE}`),marketDir=path.join(root,`data/market/${DATE}`),outDir=path.join(root,`data/decisions/${DATE}`);
fs.mkdirSync(outDir,{recursive:true});
if(!fs.existsSync(modelDir)){console.log("DECISION_RUNNER_NO_MODELS");process.exit(0);}
let written=0,noModel=0,noBet=0,rejected=0;
for(const file of fs.readdirSync(modelDir).filter(x=>x.endsWith(".json"))){
 const m=JSON.parse(fs.readFileSync(path.join(modelDir,file),"utf8"));
 if(m.schema!=="fih-model-v1"||m.date!==DATE||!m.fixtureId){rejected++;continue;}
 const id=String(m.fixtureId),target=path.join(outDir,`${id}.json`);
 let decision:any;
 if(m.status==="INSUFFICIENT_DATA"){
  decision={schema:"fih-decision-v1",date:DATE,fixtureId:id,decision:"NO_MODEL",publishable:false,reason:"INSUFFICIENT_VERIFIED_MODEL_INPUT",modelVersion:m.modelVersion||m.version,decidedAt:new Date().toISOString()}; noModel++;
 }else if(m.status==="CALCULATED"){
  const marketPath=path.join(marketDir,`${id}.json`);
  const hasMarket=fs.existsSync(marketPath);
  let market:any=null;
  if(hasMarket){try{market=JSON.parse(fs.readFileSync(marketPath,"utf8"));}catch{}}
  const verified=market?.schema==="fih-market-v1"&&market?.date===DATE&&String(market?.fixtureId)===id&&market?.verified===true;
  decision={schema:"fih-decision-v1",date:DATE,fixtureId:id,decision:"NO_BET",publishable:false,reason:verified?"NO_LOCKED_QUALIFYING_EDGE_RULE":"NO_VERIFIED_CURRENT_MARKET_ODDS",modelVersion:m.modelVersion||m.version,marketEvidence:verified?"VERIFIED_BUT_NO_LOCKED_EDGE_RULE":"UNAVAILABLE",decidedAt:new Date().toISOString()}; noBet++;
 }else{rejected++;continue;}
 fs.writeFileSync(target,JSON.stringify(decision,null,2)+"\n");
 const verify=JSON.parse(fs.readFileSync(target,"utf8"));
 if(verify.fixtureId!==id||verify.date!==DATE||!["NO_MODEL","NO_BET","BET"].includes(verify.decision))throw new Error(`DECISION_PERSIST_VERIFY_FAILED ${id}`);
 written++;
}
console.log(JSON.stringify({date:DATE,written,noModel,noBet,rejected},null,2));
if(rejected)process.exitCode=2;
