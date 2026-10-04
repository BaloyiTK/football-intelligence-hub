import {spawnSync} from "node:child_process";
const file=process.argv[2];if(!file)throw new Error("Usage: npm run run:finalize -- <run-file>");
const r=spawnSync(process.execPath,["--import","tsx","scripts/validate-run.ts",file,"--finalize"],{stdio:"inherit"});
process.exit(r.status??1);
