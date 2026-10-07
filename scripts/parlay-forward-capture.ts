import fs from "node:fs";
import path from "node:path";

const key=process.env.PARLAY_API_KEY;
if(!key){console.log("PARLAY_API_KEY_UNAVAILABLE");process.exit(0);}
const DATE=process.env.FIH_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const sport=process.env.PARLAY_SOCCER_SPORT_KEY||"soccer";
const root=process.cwd(),out=path.join(root,`data/backtest/parlay-capture/${DATE}.json`);
const url=new URL(`https://parlay-api.com/v1/historical/sports/${encodeURIComponent(sport)}/closing-odds`);
url.searchParams.set("date",DATE);
url.searchParams.set("markets","h2h,totals");
const r=await fetch(url,{headers:{"X-API-Key":key,"Accept":"application/json"}});
if(!r.ok){const body=await r.text();throw new Error(`PARLAY_HTTP_${r.status} ${body.slice(0,300)}`);}
const payload=await r.json();
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({schema:"fih-parlay-capture-v1",date:DATE,capturedAt:new Date().toISOString(),sportKey:sport,sourceUrl:url.origin+url.pathname,historicalWindowHours:Number(r.headers.get("x-historical-window-hours")||48),payload},null,2)+"\n");
const verify=JSON.parse(fs.readFileSync(out,"utf8"));if(verify.date!==DATE||verify.schema!=="fih-parlay-capture-v1")throw new Error("PARLAY_CAPTURE_VERIFY_FAILED");
console.log(JSON.stringify({date:DATE,out,historicalWindowHours:verify.historicalWindowHours},null,2));
