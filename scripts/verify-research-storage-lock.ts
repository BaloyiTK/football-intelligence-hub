import fs from "node:fs";
import {execFileSync} from "node:child_process";

const read=(p:string)=>fs.readFileSync(p,"utf8");
const fail=(m:string):never=>{throw new Error("RESEARCH_STORAGE_LOCK_FAILED: "+m)};

const rules=JSON.parse(read("config/fih-execution-rules.json"));
if(rules.locked!==true)fail("execution rules are not locked");
for(const id of ["RESEARCH-009","RESEARCH-010","RESEARCH-011","RESEARCH-015"]){
  if(!rules.rules?.[id]?.requirement)fail("missing locked rule "+id);
}
if(!rules.rules["RESEARCH-015"].requirement.includes("one and only one temporary accumulator file"))fail("RESEARCH-015 temp-file invariant weakened");
if(!rules.rules["RESEARCH-015"].requirement.includes("one and only one canonical research Git commit"))fail("RESEARCH-015 single-commit invariant weakened");

const checkpoint=read("scripts/research-checkpoint.ts");
if(!checkpoint.includes('path.join(ROOT,"data/research-work",DATE+".json")'))fail("checkpoint is not a single date accumulator file");
if(checkpoint.includes('"manifest.json"')||checkpoint.includes('path.join(wp,"fixtures"'))fail("per-fixture/manifest checkpoint tree reintroduced");

const cycle=read("scripts/daily-cycle.ts");
if(!cycle.includes('workingCheckpoint:"data/research-work/"+DATE+".json"'))fail("daily queue does not point to the single temp accumulator");
if(!cycle.includes('ONE_CANONICAL_COMMIT_AFTER_N_OF_N_VALIDATION_AND_PROMOTION'))fail("daily queue canonical commit policy weakened");

const ignore=read(".gitignore").split(/\r?\n/).map(x=>x.trim());
if(!ignore.includes("data/research-work/"))fail("data/research-work is not gitignored");
const tracked=execFileSync("git",["ls-files","data/research-work"],{encoding:"utf8"}).trim();
if(tracked)fail("temporary research-work files are tracked by Git: "+tracked.replace(/\n/g,", "));

console.log(JSON.stringify({
  ok:true,
  lock:"STEP2_SINGLE_TEMP_SINGLE_CANONICAL_COMMIT",
  tempPath:"data/research-work/YYYY-MM-DD.json",
  canonicalPath:"data/research/YYYY-MM-DD.json",
  canonicalCommitsPerResearchRunId:1
},null,2));
