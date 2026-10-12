import fs from "node:fs";
import assert from "node:assert/strict";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const contract = read("FIH_EXECUTION_CONTRACT.md");
const policy = read("FIH_EXECUTION_POLICY.md");
const steps = read("FIH_BUILD_STEPS.md");
const portable = read("FIH_PORTABLE_COMMAND_CONTRACT.md");
const rules = JSON.parse(read("config/fih-execution-rules.json"));
const ingest = read("api/backtest-ingest.js");
const controller = read("scripts/continuation-controller.ts");
const checkpoint = read("scripts/research-checkpoint.ts");
const workflow = read(".github/workflows/fih-run-now.yml");
const step12Workflow = read(".github/workflows/fih-step12-command.yml");
const step12Runner = read("scripts/step12-command-runner.mjs");
const step12Prepare = read("scripts/step12-prepare.ts");
const dailyCycle = read("scripts/daily-cycle.ts");
const contractGate = read("scripts/contract-gate.ts");

assert.equal(rules.locked, true);
assert.match(contract, /Date routing contract/);
assert.match(policy, /Verify persisted data/);
assert.match(steps, /hybrid cluster-first shared-evidence/);
assert.match(portable, /Stateless entrypoint/);
assert.match(portable, /run past N days/);
assert.match(portable, /status YYYY-MM-DD/);
assert.match(portable, /Step 2 is forbidden/);
const failures = [];
const gate = (name, ok, detail) => { if (!ok) failures.push({gate:name,detail}); };
gate("STEP1_GITHUB_REREAD", /await github\(path\s*\+\s*["']\?ref=/.test(ingest.slice(ingest.indexOf("const wr="))), "Ingestion must reread AFTER writing and verify persisted payload");
gate("STEP1_FRESH_RUN", !workflow.includes("ACTIVE_RESEARCH_RUN_REUSE_FROZEN_BOARD"), "Run-now must not reuse old board as proof of fresh acquisition");
gate("STEP1_RANGE_QUEUE", step12Workflow.includes("scripts/step12-command-runner.mjs") && step12Runner.includes("resolveCommand(command)") && step12Runner.includes("for(const item of plan.dates)") && step12Runner.includes("/api/backtest-ingest?date="), "Durable sequential date-range coordinator missing");
gate("STEP2_HYBRID_HANDOFF", controller.includes("STEP2_HYBRID_HANDOFF_REQUIRED") && !controller.includes("step2-autonomous-runner.ts") && rules.rules?.["RESEARCH-027"]?.requirement?.includes("data/research-prefill/<date>.json") && step12Runner.includes("scripts/hybrid-research-prefill.ts"), "Controller must preserve deterministic prediction prefill plus ChatGPT gap handoff and forbid hosted AI research");
gate("STEP2_LOCKED_ACCUMULATOR", checkpoint.includes('schema:"fih-step2-working-v1"'), "Checkpoint schema differs from locked Step 2 contract");
gate("STEP2_NO_HOSTED_AI", !fs.existsSync(new URL("../api/research-fixture.js", import.meta.url)) && !fs.existsSync(new URL("../scripts/step2-autonomous-runner.ts", import.meta.url)) && portable.includes("deterministic GitHub public-source prefill plus ChatGPT gap research"), "Hosted/repository AI research executor must be absent while deterministic non-AI prefill remains allowed");
gate("STEP12_BACKTEST_ROUTE", step12Runner.includes('mode==="BACKTEST"') && step12Runner.includes('if(mode==="PREDICTION"){') && step12Runner.includes('tsx("scripts/hybrid-research-prefill.ts"') && step12Runner.includes('tsx("scripts/fotmob-prefill-augment.ts"') && portable.includes("BACKTEST must not consume current-data prefill"), "Historical Step 1 route must bypass current-data deterministic prefill");
gate("STEP2_SHARED_EVIDENCE_BATCHING",
  rules.rules?.["RESEARCH-001"]?.requirement?.includes("deterministic source-backed facts") &&
  rules.rules?.["RESEARCH-026"]?.requirement?.includes("cluster-first") &&
  rules.rules?.["RESEARCH-026"]?.requirement?.includes("deterministic GitHub prefill") &&
  rules.rules?.["RESEARCH-027"]?.requirement?.includes("fih-daily-research-v5") &&
  step12Prepare.includes('schema:"fih-chatgpt-research-queue-v4"') &&
  step12Prepare.includes('collectionUnit:"EVIDENCE_CLUSTER"') &&
  step12Prepare.includes('validationUnit:"FIXTURE"') &&
  step12Prepare.includes('checkpointUnit:"FIXTURE"') &&
  step12Prepare.includes('id:"SHARED_COLLECTION"') &&
  step12Prepare.includes('strategy:"GROUP_BY_COMPETITION_AND_TEAM"') &&
  step12Prepare.includes('id:"PAIR_COLLECTION"') &&
  step12Prepare.includes('strategy:"GROUP_H2H_PAIRS"') &&
  step12Prepare.includes('id:"FIXTURE_ASSEMBLY"') &&
  step12Prepare.includes('id:"GAP_REPAIR"') &&
  step12Prepare.includes('execution:"CONTINUOUS_EVIDENCE_CLUSTERS"') &&
  step12Prepare.includes('mode:"CLUSTER_FIRST_MULTI_ENTITY_WEB_CALL"') &&
  step12Prepare.includes('ONE_SOURCE_MAY_SUPPORT_MULTIPLE_FIXTURES_WHEN_FACT_ATTRIBUTION_IS_EXPLICIT') &&
  step12Prepare.includes('fixtureSpecificSearchRequired:false') &&
  step12Prepare.includes('individualSearchCallRequired:false') &&
  step12Prepare.includes('FAST:"SHARED_EVIDENCE_SUFFICIENT_NO_EXTRA_SEARCH"') &&
  step12Prepare.includes('STANDARD:"TARGETED_MISSING_FIELDS"') &&
  step12Prepare.includes('DEEP:"CONFLICTING_OR_SCARCE_EVIDENCE_ONLY"') &&
  step12Prepare.includes('checkpoint:"IMMEDIATE_PER_VALIDATED_FIXTURE"') &&
  !step12Prepare.includes('atomicUnit:"FIXTURE"') &&
  !step12Prepare.includes('FIXTURE_PACKET') &&
  !step12Prepare.includes('fixtureSpecificSearchStillRequired:true') &&
  dailyCycle.includes('collectionUnit:"EVIDENCE_CLUSTER"') &&
  dailyCycle.includes('execution:"CONTINUOUS_EVIDENCE_CLUSTERS"') &&
  !dailyCycle.includes('execution:"CONTINUOUS_FIXTURE_PACKETS"') &&
  portable.includes("cluster-first shared-evidence batching") &&
  contract.includes("cluster-first shared-evidence architecture"),
  "Step 2 must bulk-collect attributable shared evidence, assemble and validate fixtures independently, and reserve fixture-specific web search for targeted gap repair");
gate("VERCEL_DEPLOYMENT_QUOTA_NONBLOCKING",
  rules.rules?.["INFRA-002"]?.requirement?.includes("NON-BLOCKING") &&
  rules.infrastructure?.vercel?.deploymentQuotaPolicy?.classification==="NON_BLOCKING" &&
  rules.infrastructure?.vercel?.deploymentQuotaPolicy?.ignoreAsHardStop===true &&
  rules.infrastructure?.vercel?.deploymentQuotaPolicy?.ignoreAsWaitingReason===true &&
  Array.isArray(rules.nonHardStops) && rules.nonHardStops.includes("VERCEL_DEPLOYMENT_QUOTA_OR_DAILY_DEPLOYMENT_LIMIT") &&
  contract.includes("Vercel deployment quota — NON-BLOCKING LOCK") &&
  policy.includes("Vercel deployment-limit handling — LOCKED") &&
  contractGate.includes("INFRA-002 Vercel deployment quota is non-blocking"),
  "Vercel deployment quota must be machine-locked as non-blocking and rejected as BLOCKED/WAITING evidence");
if (failures.length) {
 console.error(JSON.stringify({status:"NOT_READY",failed:failures.length,failures},null,2));
 process.exitCode = 1;
} else console.log(JSON.stringify({status:"PASS",gates:9,step2:"HYBRID_GITHUB_PREFILL_CHATGPT_GAPS"}));
