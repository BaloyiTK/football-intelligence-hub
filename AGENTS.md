# FIH Agent Entry Point

This repository is the authority for Football Intelligence Hub execution.

Before any FIH command, read:
1. `FIH_EXECUTION_CONTRACT.md`
2. `FIH_EXECUTION_POLICY.md`
3. `FIH_BUILD_STEPS.md`
4. `config/fih-execution-rules.json`

Interpret Step 1 run commands with `scripts/fih-command-router.mjs` using Africa/Johannesburg calendar time.

## Step 1

Invoke `scripts/step1-command-runner.mjs`. Step 1 fetches the LiveScore fixture board through the configured Vercel integration, persists the per-date fixture file to GitHub, re-reads the committed file, verifies it, and stops.

## Step 2 pilot

A Step 2 custom-xG pilot is separately triggered through the LiveScore Step 2 workflow.

The pilot:
- requires a verified Step 1 fixture file for the same date;
- uses the existing LiveScore RapidAPI subscription through the secured FIH Vercel integration;
- obtains pregame form and H2H from LiveScore and uses the Step 1 fixture identities;
- preserves the custom xG formula defined in the locked rules;
- processes at most 15 events per run;
- persists `data/step2-xg/YYYY-MM-DD.json`;
- verifies the pushed result and stops.

Do not create betting decisions, market outputs, accumulators, staking outputs, or any later-stage handoff.
