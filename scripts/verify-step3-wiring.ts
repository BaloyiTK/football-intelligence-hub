import fs from "node:fs";

const read=(p:string)=>fs.readFileSync(p,"utf8");
const fail=(m:string):never=>{throw new Error("STEP3_WIRING_LOCK_FAILED: "+m)};

const rules=JSON.parse(read("config/fih-execution-rules.json"));
for(const id of ["MODEL-001","MODEL-002","MODEL-003","MODEL-004","MODEL-005","MODEL-006","MODEL-007","MODEL-008","MODEL-009","MODEL-010","MODEL-011","MODEL-012","MODEL-013","MODEL-014","MODEL-015","RESEARCH-016","RESEARCH-017","RESEARCH-018"]){
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
  "facts.teamQuality?.status",
  "facts.opponentStrength?.status",
  "homeVenueRaw.length===5",
  "awayVenueRaw.length===5",
  "partial venue form not used",
  "resultProfileOverall",
  "resultProfileVenue",
  "h2hMatches",
  "motivationIndex",
  "locked competitive-fixture baseline",
  "usage:{"
]) if(!normalize.includes(token)) fail("normalizer missing "+token);
for(const forbidden of ["facts.xg","xgFor","xgAgainst","OBSERVED_COMPLETED_MATCH_STATISTICS"])
  if(normalize.includes(forbidden)) fail("external xG reintroduced into normalizer: "+forbidden);

const validator=read("scripts/research-canonical.ts");
for(const token of [
  "RESEARCH_CATEGORY_SOURCE_REF_UNKNOWN",
  "RESEARCH_EXTERNAL_XG_FORBIDDEN",
  "formOkStrict",
  "requiredCount=5",
  "homeLast5.length===requiredCount",
  "awayLast5.length===requiredCount",
  "headToHeadOk",
  "h2hMatchOk",
  "searchExhausted",
  "RESEARCH_H2H_MATCH_SOURCE_REF_UNKNOWN",
  "CANONICAL_DAILY_RESEARCH_SCHEMA_UPGRADE_REQUIRED",
  '"fih-daily-research-v5"'
]) if(!validator.includes(token)) fail("research validator missing "+token);

const checkpoint=read("scripts/research-checkpoint.ts");
if(!checkpoint.includes('schema:"fih-daily-research-v5"'))fail("new Step 2 checkpoints are not strict v5");
if(!checkpoint.includes('schema:"fih-research-temp-accumulator-v2"'))fail("Step 2 temp accumulator is not H2H-lock v2");

const daily=read("scripts/daily-cycle.ts");
for(const token of ['venueForm:{count:5','homeTeam:"LAST_COMPLETED_HOME"','awayTeam:"LAST_COMPLETED_AWAY"','headToHead:{count:5','storage:"facts.headToHead.data.matches"','verifiedRequiresExactCount:true','partialRequiresSearchExhausted:true','canonicalResearchSchema:"fih-daily-research-v5"','motivationContext:{factsOnly:true'])
  if(!daily.includes(token))fail("Step 2 queue missing requested venue count "+token);

const probability=read("scripts/fih-probability-v2.ts");
for(const forbidden of ["xgFor","xgAgainst","facts.xg","OBSERVED_COMPLETED_MATCH_STATISTICS"])
  if(probability.includes(forbidden)) fail("external xG reintroduced into probability model: "+forbidden);
for(const token of ["lambdaHome/lambdaAway","no external xG/xGA is consumed","resultProfile","recentPpg","venuePpg","seasonPpg","FIH_FIVE_FACTOR_WEIGHTS","overallForm:0.30","venueForm:0.30","leaguePosition:0.15","headToHead:0.15","motivation:0.10","FIH-5F-V1","Strength score only; not a win probability."])
  if(!probability.includes(token)) fail("FIH expected-goal ownership marker missing "+token);
if(probability.includes("i.home.ppg??1.5")||probability.includes("i.away.ppg??1.5"))fail("neutral PPG imputation reintroduced");
if(probability.includes("availabilityAttack??0")||probability.includes("availabilityDefence??0"))fail("uncalibrated availability scoring reintroduced");
for(const token of [
  "Number.isFinite(i.home.ppg)&&Number.isFinite(i.away.ppg)",
  "Number.isFinite(i.home.goalDifferencePerGame)&&Number.isFinite(i.away.goalDifferencePerGame)",
  "Missing optional evidence is not imputed",
  "RENORMALIZE_AVAILABLE_LOCKED_WEIGHTS_NO_IMPUTATION"
]) if(!probability.includes(token)) fail("probability model missing no-imputation guard "+token);

const model=read("scripts/daily-model-runner.ts");
for(const forbidden of ["xgFor","xgAgainst"])
  if(model.includes(forbidden)) fail("external xG audit field reintroduced: "+forbidden);
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
for(const id of ["MODEL-001","MODEL-002","MODEL-003","MODEL-004","MODEL-014","MODEL-015"])if(!cycle.includes(id))fail("daily cycle gate missing "+id);

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
  rules:["MODEL-001","MODEL-002","MODEL-003","MODEL-004","MODEL-005","MODEL-006","MODEL-007","MODEL-008","MODEL-009","MODEL-010","MODEL-011","MODEL-012","MODEL-013","MODEL-014","MODEL-015","RESEARCH-016","RESEARCH-017","RESEARCH-018"]
},null,2));
