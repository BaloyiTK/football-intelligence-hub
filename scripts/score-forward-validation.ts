import fs from "node:fs";
import path from "node:path";
import {gradeBet,parseScore} from "../lib/grading";

const dir=path.join(process.cwd(),"data","forward-validation");
const rows:any[]=[];
if(fs.existsSync(dir)) for(const name of fs.readdirSync(dir).filter(x=>x.endsWith(".json")).sort()){
  const freeze=JSON.parse(fs.readFileSync(path.join(dir,name),"utf8"));
  const predictionPath=path.join(process.cwd(),freeze.predictionArtifact);
  if(!fs.existsSync(predictionPath)) continue;
  const current=JSON.parse(fs.readFileSync(predictionPath,"utf8"));
  const byKey=new Map((current.fixtures??[]).map((x:any)=>[x.fixtureKey,x]));
  for(const f of freeze.fixtures??[]){
    const now:any=byKey.get(f.fixtureKey);
    const score=parseScore(now?.result?.actualScore??now?.result?.score??now?.result?.finalScore??now?.result);
    if(!score) continue;
    const grade=gradeBet(f.prediction.recommendedBet,score);
    rows.push({date:freeze.date,fixtureKey:f.fixtureKey,pick:f.prediction.recommendedBet.pick,probability:f.prediction.recommendedBet.probability,grade});
  }
}
const wins=rows.filter(x=>x.grade==="WIN").length, losses=rows.length-wins;
const accuracy=rows.length?Number((wins/rows.length*100).toFixed(1)):null;
const byPick=Object.fromEntries([...new Set(rows.map(x=>x.pick))].map(p=>{const a=rows.filter(x=>x.pick===p),w=a.filter(x=>x.grade==="WIN").length;return[p,{bets:a.length,wins:w,losses:a.length-w,accuracy:a.length?Number((w/a.length*100).toFixed(1)):null}]}));
console.log(JSON.stringify({modelVersion:"v2.9-market-specific-quality-selector",forwardOnly:true,gradedBets:rows.length,wins,losses,accuracy,byPick},null,2));
