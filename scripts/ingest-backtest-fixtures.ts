import fs from "node:fs";
import path from "node:path";
async function main(){
 const date=process.argv[2]; if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Usage: npm run fixtures:backtest-ingest -- YYYY-MM-DD");
 const key=process.env.RAPIDAPI_KEY??process.env.ls_api_key; if(!key) throw new Error("Missing RAPIDAPI_KEY or ls_api_key");
 const host="livescore6.p.rapidapi.com",endpoint="/matches/v2/list-by-date",dp=date.replace(/-/g,"");
 const r=await fetch("https://"+host+endpoint+"?Category=soccer&Date="+dp+"&Timezone=2",{headers:{"X-RapidAPI-Key":key,"X-RapidAPI-Host":host}}); if(!r.ok) throw new Error("LiveScore fetch failed HTTP "+r.status);
 const payload:any=await r.json(),stages=Array.isArray(payload?.Stages)?payload.Stages:[],fixtureCount=stages.reduce((n:number,s:any)=>n+(Array.isArray(s?.Events)?s.Events.length:0),0); if(!fixtureCount) throw new Error("No fixtures returned");
 const out={schema:"fih-backtest-fixture-v1",date,timezone:"Africa/Johannesburg",provider:"LiveScore via RapidAPI",endpoint,fetchedAt:new Date().toISOString(),stageCount:stages.length,fixtureCount,payload};
 const file=path.join(process.cwd(),"data","backtest","fixtures",date+".json"); fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,JSON.stringify(out,null,2)+"\n"); console.log(JSON.stringify({date,fixtureCount,file},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
