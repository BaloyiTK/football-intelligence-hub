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
assert.match(steps, /ChatGPT owns the fixture-by-fixture/);
assert.match(portable, /Stateless entrypoint/);
assert.match(portable, /run past N days/);
assert.match(portable, /status YYYY-MM-DD/);
assert.match(portable, /Step 2 is forbidden/);
const failures = [];
const gate = (name, ok, detail) => { if (!ok) failures.push({gate:name,detail}); };
gate("STEP1_GITHUB_REREAD", /await github\(path\s*\+\s*["']\?ref=/.test(ingest.slice(ingest.indexOf("const wr="))), "Ingestion must reread AFTER writing and verify persisted payload");
gate("STEP1_FRESH_RUN", !workflow.includes("ACTIVE_RESEARCH_RUN_REUSE_FROZEN_BOARD"), "Run-now must not reuse old board as proof of fresh acquisition");
gate("STEP1_RANGE_QUEUE", step12Workflow.includes("scripts/step12-command-runner.mjs") && step12Runner.includes("resolveCommand(command)") && step12Runner.includes("for(const item of plan.dates)") && step12Runner.includes("/api/backtest-ingest?date="), "Durable sequential date-range coordinator missing");
gate("STEP2_CHATGPT_HANDOFF", controller.includes("STEP2_CHATGPT_HANDOFF_REQUIRED") && !controller.includes("step2-autonomous-runner.ts") && rules.rules?.["INFRA-003"]?.requirement?.includes("Step 2 research is executed by ChatGPT itself"), "Controller must hand the frozen queue to ChatGPT and forbid hosted Step 2 research");
gate("STEP2_LOCKED_ACCUMULATOR", checkpoint.includes('schema:"fih-step2-working-v1"'), "Checkpoint schema differs from locked Step 2 contract");
gate("STEP2_NO_HOSTED_AI", !fs.existsSync(new URL("../api/research-fixture.js", import.meta.url)) && !fs.existsSync(new URL("../scripts/step2-autonomous-runner.ts", import.meta.url)) && portable.includes("ChatGPT itself is the authoritative Step-2 web-research executor"), "Hosted/repository Step 2 AI executor must be absent");
gate("STEP12_BACKTEST_ROUTE", step12Runner.includes('mode==="BACKTEST"') && step12Runner.includes("/api/backtest-ingest?date=") && portable.includes("ChatGPT itself is the authoritative Step-2 web-research executor"), "Historical Step 1 route or ChatGPT Step 2 handoff missing");
gate("STEP2_ADAPTIVE_STREAMING_PLAN",
  rules.rules?.["RESEARCH-026"]?.requirement?.includes("no fixed fixture-count concurrency ceiling") &&
  rules.rules?.["RESEARCH-026"]?.requirement?.includes("immediately refill released capacity") &&
  rules.rules?.["RESEARCH-026"]?.requirement?.includes("checkpoint it immediately to the one active accumulator") &&
  rules.rules?.["RESEARCH-026"]?.requirement?.includes("Same-competition standings evidence may be reused") &&
  step12Prepare.includes('atomicUnit:"FIXTURE"') &&
  step12Prepare.includes('streamingPool:{workload:"ALL_UNVALIDATED_FIXTURES"') &&
  step12Prepare.includes('admission:"ADAPTIVE_TO_AVAILABLE_CHATGPT_WEB_SEARCH_CAPACITY"') &&
  step12Prepare.includes('execution:"CONTINUOUS_FIXTURE_PACKETS"') &&
  step12Prepare.includes('refill:"IMMEDIATE_ON_SLOT_RELEASE"') &&
  step12Prepare.includes('completionBarrier:"NONE_BETWEEN_FIXTURES"') &&
  step12Prepare.includes('checkpoint:"IMMEDIATE_PER_VALIDATED_FIXTURE"') &&
  step12Prepare.includes('checkpointStorageOrder:"FROZEN_ORDER"') &&
  step12Prepare.includes('fixedFixtureConcurrencyLimit:null') &&
  step12Prepare.includes('packet:{id:"FIXTURE_PACKET"') &&
  step12Prepare.includes('launchMode:"ADAPTIVE_PARALLEL_SEARCH"') &&
  step12Prepare.includes('MULTI_QUERY_WEB_CALL_WHEN_SUPPORTED') &&
  step12Prepare.includes('id:"CORE_STATS"') &&
  step12Prepare.includes('categories:["form","standings","schedule"]') &&
  step12Prepare.includes('id:"H2H"') &&
  !step12Prepare.includes('squadAvailability:{factsOnly:true') &&
  !step12Prepare.includes('competitionContext:{factsOnly:true') &&
  step12Prepare.includes('fixtureSpecificSearchStillRequired:true') &&
  step12Prepare.includes('recovery:"TARGET_ONLY_MISSING_OR_INVALID_CATEGORIES_PER_FIXTURE"') &&
  dailyCycle.includes('streamingPool:{workload:"ALL_UNVALIDATED_FIXTURES"') &&
  !dailyCycle.includes('maxConcurrentFixtures:25') &&
  portable.includes("adaptive streaming pool") &&
  contract.includes("adaptive streaming architecture"),
  "Step 2 must stream the full unfinished workload through adaptive safe capacity, immediately checkpoint valid fixtures, preserve one accumulator, and keep fixture-specific evidence locks");
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
} else console.log(JSON.stringify({status:"PASS",gates:9}));
