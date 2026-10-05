import fs from "node:fs";
import path from "node:path";

const file=path.join(process.cwd(),"data/backtests/2026-04-08_to_2026-10-04.json");
const j=JSON.parse(fs.readFileSync(file,"utf8"));
const rows=(j.fixtures||[]).filter((x:any)=>x.recommendedBet);
const clean=(s:string)=>String(s||"")
 .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
const picks=[0,Math.floor(rows.length*.15),Math.floor(rows.length*.3),Math.floor(rows.length*.45),Math.floor(rows.length*.6),Math.floor(rows.length*.75),Math.floor(rows.length*.9),rows.length-1];
for(const idx of picks){
 const x=rows[idx];
 const home=x.homeTeam||x.home||x.home_name;
 const away=x.awayTeam||x.away||x.away_name;
 const date=x.date;
 const url=`https://football-predictions.ai/${clean(home)}-vs-${clean(away)}-prediction-betting-tips-${date}`;
 try{
   const r=await fetch(url,{redirect:"follow",headers:{"user-agent":"Mozilla/5.0 FIH-Odds-Backtest/1.0"}});
   const t=await r.text();
   console.log(JSON.stringify({idx,date,home,away,pick:x.recommendedBet?.pick,url,status:r.status,len:t.length,hasTeams:t.toLowerCase().includes(String(home).toLowerCase())&&t.toLowerCase().includes(String(away).toLowerCase()),hasOdds:t.includes('"Double Chance"')||t.includes('"Over/Under"')}));
 }catch(e){console.log(JSON.stringify({idx,date,home,away,url,error:String(e)}))}
}