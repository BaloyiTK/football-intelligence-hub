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
const researchApi = read("api/research-fixture.js");

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
gate("STEP2_AUTONOMOUS_HANDOFF", !controller.includes("STEP2_CHATGPT_HANDOFF_REQUIRED") && controller.includes("step2-autonomous-runner.ts"), "Controller must invoke unattended ChatGPT research rather than exit");
gate("STEP2_LOCKED_ACCUMULATOR", checkpoint.includes('schema:"fih-step2-working-v1"'), "Checkpoint schema differs from locked Step 2 contract");
gate("STEP2_WEB_RESEARCH", researchApi.includes("browserbase_search") && researchApi.includes("CATEGORY_SEARCH_PARITY_FAILED") && researchApi.includes("requireFihGitHubOidc"), "Authoritative AI web-research worker or provenance/auth gate missing");
gate("STEP12_BACKTEST_ROUTE", step12Runner.includes('mode==="BACKTEST"') && researchApi.includes('mode==="BACKTEST"') && researchApi.includes("BACKTEST_SOURCE_AFTER_CUTOFF"), "Historical Step 1-2 route/cutoff enforcement missing");
if (failures.length) {
 console.error(JSON.stringify({status:"NOT_READY",failed:failures.length,failures},null,2));
 process.exitCode = 1;
} else console.log(JSON.stringify({status:"PASS",gates:7}));
