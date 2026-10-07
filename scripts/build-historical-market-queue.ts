import fs from "node:fs";
import path from "node:path";

const root=process.cwd(),dir=path.join(root,"data/backtest/predictions"),out=path.join(root,"data/backtest/market-queue.json");
if(!fs.existsSync(dir))throw new Error("BACKTEST_PREDICTIONS_MISSING");
const fixtures:any[]=[];
for(const file of fs.readdirSync(dir).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort()){
 const day=JSON.parse(fs.readFileSync(path.join(dir,file),"utf8")),date=file.slice(0,10);
 for(const f of day.fixtures||[]){
  if(f.model?.status!=="CALCULATED")continue;
  if(!f.actualResult||!Number.isFinite(Number(f.actualResult.homeGoals))||!Number.isFinite(Number(f.actualResult.awayGoals)))continue;
  if(f.marketOdds?.verified===true||f.marketOdds?.status==="VERIFIED")continue;
  fixtures.push({date,fixtureId:String(f.fixtureId),home:f.home,away:f.away,competition:f.competition,kickoff:f.kickoff,requiredEvidence:{priceTime:"strictly before kickoff",sourceUrl:true,market:"1X2/OVER_2_5/BTTS where explicitly shown",noPostMatchReconstruction:true}});
 }
}
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({schema:"fih-historical-market-queue-v1",generatedAt:new Date().toISOString(),count:fixtures.length,fixtures},null,2)+"\n");
console.log(JSON.stringify({queued:fixtures.length,out},null,2));
