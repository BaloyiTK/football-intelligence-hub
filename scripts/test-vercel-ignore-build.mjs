import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync,spawnSync} from "node:child_process";
import assert from "node:assert/strict";

const source=fs.readFileSync("scripts/vercel-ignore-build.sh","utf8");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"fih-vercel-ignore-"));
const run=(cmd,args)=>execFileSync(cmd,args,{cwd:root,encoding:"utf8"});
run("git",["init","-q"]);
run("git",["config","user.name","fih-test"]);
run("git",["config","user.email","fih-test@example.invalid"]);
fs.mkdirSync(path.join(root,"scripts"),{recursive:true});
fs.mkdirSync(path.join(root,"api"),{recursive:true});
fs.mkdirSync(path.join(root,"data"),{recursive:true});
fs.writeFileSync(path.join(root,"scripts/vercel-ignore-build.sh"),source);
fs.writeFileSync(path.join(root,"api/worker.js"),"export default 1;\n");
fs.writeFileSync(path.join(root,"data/state.json"),"{}\n");
fs.writeFileSync(path.join(root,"package.json"),"{}\n");
fs.writeFileSync(path.join(root,"vercel.json"),"{}\n");
fs.mkdirSync(path.join(root,"config"),{recursive:true});
fs.writeFileSync(path.join(root,"config/rules.json"),"{}\n");
run("git",["add","."]);run("git",["commit","-qm","initial"]);

fs.writeFileSync(path.join(root,"data/state.json"),"{\"v\":1}\n");
run("git",["add","data/state.json"]);run("git",["commit","-qm","data only"]);
let r=spawnSync("bash",["scripts/vercel-ignore-build.sh"],{cwd:root,encoding:"utf8"});
assert.equal(r.status,0,"data-only commit must skip Vercel deployment: "+r.stdout+r.stderr);

fs.writeFileSync(path.join(root,"api/worker.js"),"export default 2;\n");
run("git",["add","api/worker.js"]);run("git",["commit","-qm","runtime api"]);
r=spawnSync("bash",["scripts/vercel-ignore-build.sh"],{cwd:root,encoding:"utf8"});
assert.equal(r.status,1,"api commit must trigger Vercel deployment: "+r.stdout+r.stderr);

fs.writeFileSync(path.join(root,"config/rules.json"),"{\"v\":2}\n");
run("git",["add","config/rules.json"]);run("git",["commit","-qm","runtime config"]);
r=spawnSync("bash",["scripts/vercel-ignore-build.sh"],{cwd:root,encoding:"utf8"});
assert.equal(r.status,1,"config commit must trigger Vercel deployment: "+r.stdout+r.stderr);

console.log(JSON.stringify({ok:true,lock:"VERCEL_DATA_ONLY_DEPLOYMENT_SKIP",dataOnly:"SKIP",api:"DEPLOY",config:"DEPLOY"},null,2));
