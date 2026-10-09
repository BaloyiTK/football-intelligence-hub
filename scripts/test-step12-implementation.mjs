import fs from "node:fs";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import ts from "typescript";

const tsFiles=["scripts/step12-prepare.ts","scripts/continuation-controller.ts","scripts/research-canonical.ts"];
for(const file of tsFiles){
  const source=fs.readFileSync(file,"utf8");
  const r=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});
  const errors=(r.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,file+" TypeScript syntax diagnostics: "+errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText," ")).join("; "));
}
for(const file of ["api/_fih-auth.js","api/backtest-ingest.js","scripts/step12-command-runner.mjs","scripts/fih-command-router.mjs"]){
  const r=spawnSync(process.execPath,["--check",file],{encoding:"utf8"});
  assert.equal(r.status,0,file+" node --check failed: "+r.stderr);
}

const auth=fs.readFileSync("api/_fih-auth.js","utf8");
const command=fs.readFileSync("scripts/step12-command-runner.mjs","utf8");
const continuation=fs.readFileSync("scripts/continuation-controller.ts","utf8");
const step12Workflow=fs.readFileSync(".github/workflows/fih-step12-command.yml","utf8");
const recoveryWorkflow=fs.readFileSync(".github/workflows/fih-daily-reliability-watchdog.yml","utf8");
const step12Prepare=fs.readFileSync("scripts/step12-prepare.ts","utf8");
const dailyLedger=fs.readFileSync("scripts/daily-run-ledger.ts","utf8");
const fullWorkflow=fs.readFileSync(".github/workflows/fih-run-now.yml","utf8");
const backtestWorkflow=fs.readFileSync(".github/workflows/fih-backtest-history.yml","utf8");
const agents=fs.readFileSync("AGENTS.md","utf8");
const portable=fs.readFileSync("FIH_PORTABLE_COMMAND_CONTRACT.md","utf8");
const rules=JSON.parse(fs.readFileSync("config/fih-execution-rules.json","utf8"));

assert.match(auth,/crypto\.verify/);
assert.match(auth,/token\.actions\.githubusercontent\.com/);
assert.match(command,/for\(const item of plan\.dates\)/);
assert.match(command,/\/api\/backtest-ingest\?date=/);
assert.match(command,/STEP2_CHATGPT_QUEUE_READY/);
assert.match(command,/STEP12_CHATGPT_HANDOFF_REQUIRED/);
assert.doesNotMatch(command,/step2-autonomous-runner/);
assert.doesNotMatch(command,/FIH_RESEARCH_BASE_URL/);

assert.match(continuation,/STEP2_CHATGPT_HANDOFF_REQUIRED/);
assert.match(continuation,/RESEARCH-004/);
assert.match(continuation,/INFRA-003/);
assert.doesNotMatch(continuation,/step2-autonomous-runner/);
assert.doesNotMatch(continuation,/STEP2_AUTONOMOUS_RETRY_REQUIRED/);

assert.match(step12Workflow,/automation\/run-now\.flag/);
assert.match(step12Workflow,/FIH_COMMAND/);
assert.doesNotMatch(step12Workflow,/FIH_RESEARCH_BASE_URL/);
assert.doesNotMatch(step12Workflow,/research-fixture/);

assert.match(recoveryWorkflow,/automation\/recover-now\.flag/);
assert.match(recoveryWorkflow,/CHATGPT_RESEARCH_REQUIRED/);
assert.match(recoveryWorkflow,/cron: "\*\/15 \* \* \* \*"/);
assert.doesNotMatch(recoveryWorkflow,/step2-recovery-runner/);
assert.doesNotMatch(recoveryWorkflow,/FIH_RESEARCH_BASE_URL/);
assert.doesNotMatch(recoveryWorkflow,/research-fixture/);

const r025=String(rules.rules?.["RESEARCH-025"]?.requirement||"");
assert.match(r025,/0\/N/);
assert.match(r025,/validated Step-2 progress/);
assert.ok(rules.rules?.["MODEL-004"]?.requirement?.includes("RESEARCH-025"));
assert.ok(rules.rules?.["STEP1-002"]?.requirement?.includes("strictly later than the authoritative board fetchedAt"));
assert.equal(rules.rules?.["RESEARCH-026"],undefined);
assert.ok(rules.rules?.["INFRA-003"]?.requirement?.includes("Vercel is authorized for FIH Step 1"));
assert.ok(rules.rules?.["INFRA-003"]?.requirement?.includes("Step 2 research is executed by ChatGPT itself"));

assert.match(step12Prepare,/PREMATCH_WINDOW_CLOSED/);
assert.match(step12Prepare,/CHATGPT_RESEARCH_REQUIRED/);
assert.match(step12Prepare,/data\/recovery-requests/);
assert.match(command,/data\/recovery-requests/);
assert.match(step12Workflow,/Verify durable ChatGPT Step 2 handoff/);
assert.match(step12Workflow,/CHATGPT_RESEARCH_REQUIRED/);
assert.match(dailyLedger,/PREMATCH_WINDOW_CLOSED/);
assert.doesNotMatch(fullWorkflow,/automation\/run-now\.flag/);
assert.match(backtestWorkflow,/step12-command-runner\.mjs/);
assert.match(agents,/active ChatGPT execution must consume the queue/);
assert.match(portable,/ChatGPT itself is the authoritative Step-2 web-research executor/);
assert.doesNotMatch(portable,/configured AI research service/);
assert.doesNotMatch(portable,/callable AI research provider/);

for(const forbidden of ["api/research-fixture.js","api/step2-research.js","scripts/step2-autonomous-runner.ts","scripts/step2-recovery-runner.mjs"]){
  assert.equal(fs.existsSync(forbidden),false,"forbidden hosted Step 2 executor must stay removed: "+forbidden);
}
console.log(JSON.stringify({ok:true,lock:"CHATGPT_STEP2_ONLY",typescript:tsFiles.length,javascript:4},null,2));
