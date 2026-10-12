import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const ROOT=process.env.FIH_ROOT||process.cwd();
const arg=(n:string)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:undefined};
const DATE=arg("--date")||process.env.FIH_DATE||"";
const RID=arg("--research-run-id")||"";
if(!/^\d{4}-\d{2}-\d{2}$/.test(DATE))throw new Error("INVALID_DATE");
if(!RID)throw new Error("MISSING_RESEARCH_RUN_ID");
const p=path.join(ROOT,"data","research-prefill",DATE+".json");
if(!fs.existsSync(p))throw new Error("HYBRID_PREFILL_MISSING "+p);
const x=JSON.parse(fs.readFileSync(p,"utf8"));
if(x.schema!=="fih-hybrid-research-prefill-v1"||x.date!==DATE||x.mode!=="PREDICTION"||x.researchRunId!==RID||!Array.isArray(x.fixtures))throw new Error("HYBRID_PREFILL_IDENTITY_INVALID");
const tsx=(...args:string[])=>{
 const r=spawnSync(process.execPath,["node_modules/tsx/dist/cli.mjs",...args],{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"],env:process.env});
 if(r.status!==0)throw new Error("HYBRID_PREFILL_IMPORT_FAILED "+args.join(" ")+" "+String(r.stderr||r.stdout));
 return String(r.stdout||"").trim();
};
tsx("scripts/research-checkpoint.ts","init","--date",DATE,"--research-run-id",RID);
const tmpRoot=process.env.RUNNER_TEMP||"/mnt/data";
const tmpDir=path.join(tmpRoot,"fih","prefill-import",DATE);
fs.mkdirSync(tmpDir,{recursive:true});
let imported=0;
for(const item of x.fixtures){
 if(!item?.validatedRecord)continue;
 const id=String(item.fixtureId);
 const fp=path.join(tmpDir,id+".json");
 fs.writeFileSync(fp,JSON.stringify(item.validatedRecord,null,2)+"\n");
 tsx("scripts/research-checkpoint.ts","put","--date",DATE,"--research-run-id",RID,"--fixture",id,"--input",fp);
 fs.rmSync(fp,{force:true});
 imported++;
}
const status=JSON.parse(tsx("scripts/research-checkpoint.ts","status","--date",DATE,"--research-run-id",RID));
console.log(JSON.stringify({ok:true,date:DATE,researchRunId:RID,imported,validatedCount:status.validatedCount,expectedCount:status.expectedCount,next:status.next},null,2));
