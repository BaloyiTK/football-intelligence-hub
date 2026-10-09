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
gate("STEP1_RANGE_QUEUE", /run past N days/.test(workflow) || /range-manifest/.test(workflow), "Durable date-range coordinator missing from run-now workflow");
gate("STEP2_AUTONOMOUS_HANDOFF", !controller.includes("STEP2_CHATGPT_HANDOFF_REQUIRED"), "Controller exits instead of invoking unattended ChatGPT research");
gate("STEP2_LOCKED_ACCUMULATOR", checkpoint.includes('schema:"fih-step2-working-v1"'), "Checkpoint schema differs from locked Step 2 contract");
if (failures.length) {
 console.error(JSON.stringify({status:"NOT_READY",failed:failures.length,failures},null,2));
 process.exitCode = 1;
} else console.log(JSON.stringify({status:"PASS",gates:5}));
