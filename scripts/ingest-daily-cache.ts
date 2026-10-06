import { spawnSync } from "node:child_process";

const date = process.argv[2];
const refresh = process.argv.includes("--refresh");
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error("Usage: npm run daily:cache -- YYYY-MM-DD [--refresh]");
}

for (const script of ["scripts/ingest-daily-fixtures.ts", "scripts/ingest-daily-news.ts"]) {
  const args = ["tsx", script, date];
  if (refresh) args.push("--refresh");
  const result = spawnSync("npx", args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
