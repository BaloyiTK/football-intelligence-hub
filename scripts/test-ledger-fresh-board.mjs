import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";

const root=fs.mkdtempSync(path.join(os.tmpdir(),"fih-ledger-lineage-"));
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const boardDir=path.join(root,"data","prediction-fixtures"),stateDir=path.join(root,"data","run-state");
fs.mkdirSync(boardDir,{recursive:true});fs.mkdirSync(stateDir,{recursive:true});
const boardPath=path.join(boardDir,today+".json");
const board=(fetchedAt)=>({
 schema:"fih-prediction-fixture-v1",mode:"PREDICTION",date:today,timezone:"Africa/Johannesburg",
 fetchedAt,stageCount:1,fixtureCount:1,payload:{Stages:[{CompId:"1",CompN:"Test League",Snm:"Test League",Cnm:"Test",Events:[{Eid:"fixture-1",Eps:"NS",Esd:today.replace(/-/g,"")+"210000",T1:[{Nm:"Home FC"}],T2:[{Nm:"Away FC"}]}]}]}
});
const run=(...args)=>{
 const r=spawnSync(process.execPath,["node_modules/tsx/dist/cli.mjs","scripts/daily-run-ledger.ts",...args],{cwd:process.cwd(),encoding:"utf8",env:{...process.env,FIH_ROOT:root}});
 assert.equal(r.status,0,r.stderr||r.stdout);return JSON.parse(r.stdout);
};
const read=()=>JSON.parse(fs.readFileSync(path.join(stateDir,today+".json"),"utf8"));
fs.writeFileSync(boardPath,JSON.stringify(board(today+"T06:00:00.000Z"),null,2));
run("reconcile","--date",today);
const first=read();
assert.equal(first.runStatus,"RUNNING");
run("start-research","--date",today,"--research-run-id","research:test:same-board");
run("reconcile","--date",today);
const resumed=read();
assert.equal(resumed.researchRunId,"research:test:same-board","same board must preserve research generation");
assert.equal(resumed.runId,first.runId,"same board must preserve run identity");

fs.writeFileSync(boardPath,JSON.stringify(board(today+"T07:00:00.000Z"),null,2));
run("reconcile","--date",today);
const refreshed=read();
assert.equal(refreshed.researchRunId,undefined,"fresh board must invalidate prior research generation");
assert.notEqual(refreshed.runId,resumed.runId,"fresh board must create a new run identity");
assert.equal(refreshed.fixtures[0].state,"PENDING");
assert.equal(refreshed.board.fetchedAt,today+"T07:00:00.000Z");
run("verify","--date",today);
console.log(JSON.stringify({ok:true,lock:"FRESH_BOARD_INVALIDATES_STEP2_LINEAGE",date:today,oldRunId:resumed.runId,newRunId:refreshed.runId},null,2));
