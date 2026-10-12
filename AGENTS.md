# FIH Agent Entry Point

This repository is the authority for Football Intelligence Hub execution.

Before any FIH command, read:
1. `FIH_EXECUTION_CONTRACT.md`
2. `FIH_EXECUTION_POLICY.md`
3. `FIH_BUILD_STEPS.md`
4. `config/fih-execution-rules.json`

Interpret run commands with `scripts/fih-command-router.mjs` using Africa/Johannesburg calendar time.

## Active scope

Only **Step 1** exists.

For an authorized run, invoke `scripts/step1-command-runner.mjs`. Step 1 fetches the LiveScore fixture board through the configured Vercel integration, persists the per-date fixture file to GitHub, re-reads the committed file, verifies it, and stops.

Do not create research queues, research state, model outputs, predictions, decisions, market artifacts, or any Step 2+ handoff.
