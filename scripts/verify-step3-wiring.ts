import fs from "node:fs";

const read=(p:string)=>fs.readFileSync(p,"utf8");
const fail=(m:string):never=>{throw new Error("STEP3_WIRING_LOCK_FAILED: "+m)};

const rules=JSON.parse(read("config/fih-execution-rules.json"));
for(const id of ["MODEL-001","MODEL-002","MODEL-003","MODEL-004","MODEL-005","MODEL-006","MODEL-007","MODEL-008","MODEL-009","MODEL-010"]){
  if(!rules.rules?.[id]?.requirement)fail("missing rule "+id);
}

const gate=read("scripts/step3-input-gate.ts");
for(const token of [
  'validateDailyResearch(DATA_ROOT,DATE,eligibleIds,"PREDICTION",ledger.researchRunId)',
  'STEP3_GATE_FROZEN_BOARD_DRIFT',
  'STEP3_GATE_RESEARCH_UNCOMMITTED',
  'STEP3_GATE_CANONICAL_COMMIT_COUNT_',
  'STEP3_INPUT_VERIFIED'
]) if(!gate.includes(token)) fail("input gate missing "+token);

const normalize=read("scripts/step3-normalize.ts");
for(const token of [
  "standingMetrics",
  "goalsProfile",
  "restDays",
  "CONTEXT_ONLY",
  "facts.xg",
  "OBSERVED_COMPLETED_MATCH_STATISTICS",
  "facts.teamQuality?.status",
  "facts.opponentStrength?.status",
  "usage:{"
]) if(!normalize.includes(token)) fail("normalizer missing "+token);

const validator=read("scripts/research-canonical.ts");
for(const token of [
  "RESEARCH_CATEGORY_SOURCE_REF_UNKNOWN",
  "RESEARCH_XG_SOURCE_REF_UNKNOWN",
  "OBSERVED_COMPLETED_MATCH_STATISTICS"
]) if(!validator.includes(token)) fail("research validator missing "+token);

const probability=read("scripts/fih-probability-v2.ts");
if(probability.includes("i.home.ppg??1.5")||probability.includes("i.away.ppg??1.5"))fail("neutral PPG imputation reintroduced");
if(probability.includes("availabilityAttack??0")||probability.includes("availabilityDefence??0"))fail("uncalibrated availability scoring reintroduced");
for(const token of [
  "Number.isFinite(i.home.ppg)&&Number.isFinite(i.away.ppg)",
  "Number.isFinite(i.home.goalDifferencePerGame)&&Number.isFinite(i.away.goalDifferencePerGame)",
  "Missing optional evidence is not imputed"
]) if(!probability.includes(token)) fail("probability model missing no-imputation guard "+token);

const model=read("scripts/daily-model-runner.ts");
for(const token of [
  '"scripts/step3-input-gate.ts"',
  'validateDailyResearch(root,DATE,ids,"PREDICTION",ledger.researchRunId)',
  'researchRunId:v.researchRunId',
  'inputResearchHash:gate.inputResearchHash',
  'inputResearchCommit:gate.researchCommit',
  'normalizeResearchRecord',
  'evidenceUsage:normalized.usage'
]) if(!model.includes(token)) fail("model runner missing "+token);

const cycle=read("scripts/daily-cycle.ts");
if(!cycle.includes('tsx("scripts/step3-input-gate.ts","--date",DATE)'))fail("daily cycle does not gate Step 3");
for(const id of ["MODEL-001","MODEL-002","MODEL-003","MODEL-004"])if(!cycle.includes(id))fail("daily cycle gate missing "+id);

const workflow=read(".github/workflows/fih-run-now.yml");
for(const token of [
  "Acquire or reuse frozen fixture board",
  "ACTIVE_RESEARCH_RUN_REUSE_FROZEN_BOARD",
  'npm run step3:gate -- --date "$FIH_DATE"'
]) if(!workflow.includes(token))fail("run-now workflow missing "+token);
if(workflow.includes("- name: Acquire fresh fixture board"))fail("unsafe unconditional fixture refresh reintroduced");

console.log(JSON.stringify({
  ok:true,
  lock:"STEP2_TO_STEP3_VERIFIED_LINEAGE",
  rules:["MODEL-001","MODEL-002","MODEL-003","MODEL-004","MODEL-005","MODEL-006","MODEL-007","MODEL-008","MODEL-009","MODEL-010"]
},null,2));
