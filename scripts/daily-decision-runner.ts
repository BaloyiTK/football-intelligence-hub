import fs from "node:fs";import path from "node:path";
const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),root=process.cwd(),mp=path.join(root,"data/model",DATE+".json"),out=path.join(root,"data/decisions",DATE+".json"),cp=path.join(root,"config/bet-calibration.json");
if(!fs.existsSync(mp))throw new Error("CANONICAL_DAILY_MODEL_MISSING");if(!fs.existsSync(cp))throw new Error("BET_CALIBRATION_CONFIG_MISSING");
const m=JSON.parse(fs.readFileSync(mp,"utf8")),cal=JSON.parse(fs.readFileSync(cp,"utf8"));
if(m.schema!=="fih-daily-model-v2"||m.date!==DATE||!Array.isArray(m.fixtures))throw new Error("CANONICAL_DAILY_MODEL_INVALID");
const locked=["HOME","AWAY","OVER_2_5","BTTS_YES"];
if(cal.schema!=="fih-bet-calibration-v1"||cal.activeModel!=="FIH-V2-RESEARCH")throw new Error("BET_CALIBRATION_CONFIG_INVALID");
if(JSON.stringify(cal.qualification?.markets)!==JSON.stringify(locked))throw new Error("BET_CALIBRATION_MARKETS_MISMATCH");
const finite=(v:any)=>Number.isFinite(Number(v));
const fixtures=m.fixtures.map((x:any)=>{
 if(x.status==="INSUFFICIENT_DATA")return {fixtureId:String(x.fixtureId),decision:"NO_MODEL",publishable:false,reason:"INSUFFICIENT_VERIFIED_MODEL_INPUT",modelVersion:x.modelVersion||x.version};
 if(x.status!=="CALCULATED")throw new Error("MODEL_STATUS_UNSUPPORTED "+x.fixtureId);
 const candidates=[
  {market:"HOME",probability:Number(x.probabilities?.oneXTwo?.home),reliability:Number(x.reliability?.home)},
  {market:"AWAY",probability:Number(x.probabilities?.oneXTwo?.away),reliability:Number(x.reliability?.away)},
  {market:"OVER 2.5",probability:Number(x.probabilities?.overUnder25?.over),reliability:Number(x.reliability?.over25)},
  {market:"BTTS YES",probability:Number(x.probabilities?.btts?.yes),reliability:Number(x.reliability?.btts)}
 ].filter(c=>finite(c.probability)).sort((a,b)=>b.probability-a.probability);
 if(cal.status!=="CALIBRATED"||cal.betPublicationEnabled!==true)return {fixtureId:String(x.fixtureId),decision:"NO_BET",publishable:false,reason:"BET_PUBLICATION_NOT_CALIBRATED",candidateMarkets:candidates,modelVersion:x.modelVersion||x.version};
 const minEdge=Number(cal.qualification?.minimumEdge),minReliability=Number(cal.qualification?.minimumReliability);
 if(!finite(minEdge)||!finite(minReliability))throw new Error("CALIBRATED_THRESHOLDS_MISSING");
 const qualified=candidates.filter(c=>finite(c.reliability)&&c.reliability>=minReliability);
 if(!qualified.length)return {fixtureId:String(x.fixtureId),decision:"NO_BET",publishable:false,reason:"NO_CALIBRATED_MARKET_QUALIFIES",candidateMarkets:candidates,modelVersion:x.modelVersion||x.version};
 const best=qualified[0];
 return {fixtureId:String(x.fixtureId),decision:"BET",publishable:true,market:best.market,probability:best.probability,reliability:best.reliability,reason:"CALIBRATED_MARKET_QUALIFICATION",modelVersion:x.modelVersion||x.version};
});
const a={schema:"fih-daily-decisions-v2",date:DATE,generatedAt:new Date().toISOString(),fixtureCount:fixtures.length,calibrationStatus:cal.status,betPublicationEnabled:cal.betPublicationEnabled,fixtures};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(a,null,2)+"\n");
const v=JSON.parse(fs.readFileSync(out,"utf8"));if(v.date!==DATE||v.fixtureCount!==m.fixtureCount||v.fixtures.length!==m.fixtures.length)throw new Error("DAILY_DECISION_PERSIST_VERIFY_FAILED");
console.log(JSON.stringify({ok:true,date:DATE,fixtures:fixtures.length,calibrationStatus:cal.status,publishable:fixtures.filter((x:any)=>x.publishable).length,canonical:out},null,2));
