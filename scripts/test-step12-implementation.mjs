import fs from "node:fs";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import ts from "typescript";

const tsFiles=["scripts/step12-prepare.ts","scripts/step2-autonomous-runner.ts","scripts/continuation-controller.ts","scripts/research-canonical.ts"];
for(const file of tsFiles){
  const source=fs.readFileSync(file,"utf8");
  const r=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});
  const errors=(r.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,file+" TypeScript syntax diagnostics: "+errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText," ")).join("; "));
}
for(const file of ["api/_fih-auth.js","api/research-fixture.js","api/backtest-ingest.js","scripts/step12-command-runner.mjs","scripts/fih-command-router.mjs"]){
  const r=spawnSync(process.execPath,["--check",file],{encoding:"utf8"});
  assert.equal(r.status,0,file+" node --check failed: "+r.stderr);
}
const auth=fs.readFileSync("api/_fih-auth.js","utf8");
const worker=fs.readFileSync("api/research-fixture.js","utf8");
const runner=fs.readFileSync("scripts/step2-autonomous-runner.ts","utf8");
const command=fs.readFileSync("scripts/step12-command-runner.mjs","utf8");
assert.match(auth,/crypto\.verify/);
assert.match(auth,/token\.actions\.githubusercontent\.com/);
assert.match(worker,/requireFihGitHubOidc/);
assert.match(worker,/browserbase_search/);
assert.match(worker,/BACKTEST_SOURCE_AFTER_CUTOFF/);
assert.match(runner,/fih-step2-working-v1/);
assert.match(runner,/ACTIONS_ID_TOKEN_REQUEST_URL/);
assert.match(runner,/const token=await oidcToken\(\)/);
assert.match(runner,/STEP2_CANONICAL_COMMIT_COUNT_/);
assert.match(command,/for\(const item of plan\.dates\)/);
assert.match(command,/STEP2_VERIFIED/);
assert.equal(fs.existsSync("api/step2-research.js"),false,"duplicate Step 2 research endpoint must stay removed");
console.log(JSON.stringify({ok:true,lock:"STEP12_IMPLEMENTATION_COMPILES",typescript:tsFiles.length,javascript:5},null,2));
