import fs from "node:fs";
import {calculateV3} from "../lib/model-v3";

const file=process.argv[2]||"data/backtests/2026-04-08_to_2026-10-04.json";
const data=JSON.parse(fs.readFileSync(file,"utf8"));
const split="2026-08-06";
const rows=(data.fixtures??[]).map((f:any)=>{
 const v3=calculateV3(f.inputs);
 const coherent=v3.coherence.status==="COHERENT";
 return {date:f.date,outcome:f.outcome,pick:f.recommendedBet?.pick,coherent,flags:v3.coherence.flags};
});
const metrics=(xs:any[])=>{const wins=xs.filter(x=>x.outcome==="WIN").length;return{bets:xs.length,wins,losses:xs.length-wins,hitRate:xs.length?+(wins/xs.length*100).toFixed(1):null}};
const section=(xs:any[])=>({v29:metrics(xs),v3Coherent:metrics(xs.filter(x=>x.coherent)),filtered:metrics(xs.filter(x=>!x.coherent)),filteredCount:xs.filter(x=>!x.coherent).length,flags:Object.fromEntries([...new Set(xs.flatMap(x=>x.flags))].map(flag=>[flag,xs.filter(x=>x.flags.includes(flag)).length]))});
const out={status:"complete",comparison:"V2.9 production vs V3.0 phase-1 coherence challenger",note:"Historical rest/availability inputs were not captured, so they are neutral in this comparison. V3 phase 1 is evaluated as a coherence filter over the identical V2.9 candidate set.",split:{trainEnd:"2026-08-05",holdoutStart:split},train:section(rows.filter(x=>x.date<split)),holdout:section(rows.filter(x=>x.date>=split)),combined:section(rows)};
fs.mkdirSync("data/v3-comparisons",{recursive:true});
fs.writeFileSync("data/v3-comparisons/v29-vs-v30-phase1.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify(out,null,2));
