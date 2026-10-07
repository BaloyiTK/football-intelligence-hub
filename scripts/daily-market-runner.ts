import fs from "node:fs";
import path from "node:path";

const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const root=process.cwd(),modelDir=path.join(root,`data/model/${DATE}`),inbox=path.join(root,`data/market-inbox/${DATE}.json`),outDir=path.join(root,`data/market/${DATE}`);
fs.mkdirSync(outDir,{recursive:true});
const input=fs.existsSync(inbox)?JSON.parse(fs.readFileSync(inbox,"utf8")):{schema:"fih-market-inbox-v1",date:DATE,markets:[]};
if(input.schema!=="fih-market-inbox-v1"||input.date!==DATE||!Array.isArray(input.markets))throw new Error("INVALID_MARKET_INBOX");
const byId=new Map(input.markets.map((x:any)=>[String(x.fixtureId),x]));
let written=0,verified=0,unavailable=0;
if(fs.existsSync(modelDir))for(const file of fs.readdirSync(modelDir).filter(x=>x.endsWith(".json"))){
 const model=JSON.parse(fs.readFileSync(path.join(modelDir,file),"utf8")); if(model.status!=="CALCULATED")continue;
 const id=String(model.fixtureId),raw:any=byId.get(id);
 let artifact:any={schema:"fih-market-v1",date:DATE,fixtureId:id,collectedAt:new Date().toISOString(),verified:false,status:"UNAVAILABLE",reason:"NO_VERIFIED_CURRENT_MARKET_ODDS"};
 if(raw&&raw.verified===true&&Array.isArray(raw.sourceUrls)&&raw.sourceUrls.some((u:any)=>typeof u==="string"&&/^https?:\/\//.test(u))){
  const o=raw.oneXTwo||{},vals=[Number(o.home),Number(o.draw),Number(o.away)];
  if(vals.every(x=>Number.isFinite(x)&&x>1)){
   const inv=vals.map(x=>1/x),sum=inv.reduce((a,b)=>a+b,0);
   artifact={schema:"fih-market-v1",date:DATE,fixtureId:id,collectedAt:raw.collectedAt||new Date().toISOString(),verified:true,status:"VERIFIED",sourceUrls:raw.sourceUrls,oneXTwo:{home:vals[0],draw:vals[1],away:vals[2]},margin:Number((sum-1).toFixed(6)),fairProbability:{home:inv[0]/sum,draw:inv[1]/sum,away:inv[2]/sum}};
  }
 }
 fs.writeFileSync(path.join(outDir,`${id}.json`),JSON.stringify(artifact,null,2)+"\n");
 const check=JSON.parse(fs.readFileSync(path.join(outDir,`${id}.json`),"utf8"));if(check.fixtureId!==id||check.date!==DATE)throw new Error(`MARKET_PERSIST_VERIFY_FAILED ${id}`);
 written++;if(check.verified)verified++;else unavailable++;
}
console.log(JSON.stringify({date:DATE,written,verified,unavailable},null,2));
