# Football Intelligence Agent Execution Contract

This is the mandatory entry point for ChatGPT football runs.

Before any daily prediction run or historical backtest, read and obey:
1. `automation/AGENT_INSTRUCTIONS.md` (this file)
2. `data/leagues.json`
3. `automation/RESEARCH_RULES.md`
4. `automation/MODEL_RULES.md`
5. For historical runs: `automation/HISTORICAL_BACKTEST.md`
6. Production model: `lib/model.ts`

Repository rules are authoritative. Do not substitute remembered conversation rules, provider coverage, a sample of leagues, or convenient competitions.

## Controller
ChatGPT web research is the primary discovery/research layer. Structured datasets/APIs may be used as evidence accelerators, but they MUST NOT determine which configured leagues are checked.

For each requested date, process `data/leagues.json` in stored order. For each league:
1. Set that date/league checkpoint to `researching`.
2. Search the public web specifically for that league and date.
3. Determine whether fixtures exist.
4. If none, save an explicit verified zero-fixture checkpoint with sources, then mark the date/league `complete`.
5. If fixtures exist, save EVERY discovered fixture to the run/evidence file before modelling.
6. Process each fixture through `RESEARCH_RULES.md` in order: Full -> Standard -> Basic -> No Model.
7. Preserve sources and evidence timestamp/cutoff. Missing data is null/unknown, never invented or silently zero.
8. Run the exact production model from `lib/model.ts`.
9. Save the frozen model output/recommended bet (or NO BET/NO MODEL) immediately.
10. For historical runs only, reveal the final score after freezing and grade the recommendation.
11. Mark the date/league `complete` only after every discovered fixture is processed.
12. Save/checkpoint before moving to the next league.

## Web-first rule
- Lack of coverage in Football-Data, OpenFootball, an API, or any other dataset is NEVER permission to skip a league.
- Search the wider public web when a structured source is missing or incomplete.
- Prefer multiple useful sources where practical and authoritative/reputable sources when available.
- A zero-fixture conclusion must itself be verified; absence from one provider is insufficient.

## Progress
Progress comes only from persisted checkpoints:
- leagues checked / total
- dates checked / total
- fixtures discovered / processed
- modelled / NO MODEL
- recommended bets
- for historical runs: wins / losses / hit rate
- current date and league

Never estimate, simulate, or invent progress. Creating an empty report is not progress.

## Completion
A run is complete only when every requested date × every configured league has a persisted `complete` checkpoint and every discovered fixture has a terminal state: BET, NO BET, or NO MODEL.

For today's run, do not require historical grading. For a backtest, also obey `HISTORICAL_BACKTEST.md`.

## Machine-enforced finalization gate
- League state is `pending -> discovering -> processing -> complete`. Discovery alone is never complete.
- If fixtures exist, a league may become `complete` only after every saved fixture is terminal: BET, NO_BET or NO_MODEL (historical grading may then be WIN/LOSS).
- Before presenting a run as finished, execute `npm run run:validate -- <run-file>`.
- If validation fails, DO NOT stop at the checkpoint and DO NOT present final selections. Continue the active execution when possible; otherwise report the exact blocker and leave status in-progress.
- User-facing progress must distinguish `leagues discovered` from `leagues fully processed`.
- A run file's stored counters are advisory; final status must be recomputed/validated from fixture and league states.

## No-voluntary-stop execution rule
For user commands that start execution (for example: "run today", "run tonight", "backtest", or "resume run"), a progress update is informational only and is NEVER a stopping condition.

A normal final response is allowed only when ONE of these is true:
1. The run passes `npm run run:finalize -- <run-file>`; or
2. A real external/technical blocker prevents further tool execution in the active response. In that case persist `status: "blocked"`, persist a specific `blocker` reason and exact resume cursor, and report that blocker. Do not call ordinary workload, many fixtures, research still pending, or a progress checkpoint a blocker.

After every progress update, immediately continue with the next persisted non-terminal league/fixture. Never voluntarily end because discovery, a checkpoint, a batch, a league, or a progress message completed.

## Resume determinism
- Persist `current` with date, leagueIndex/leagueId, fixture index or fixture identity, and stage.
- On resume, read the run file and continue from the first non-terminal checkpoint; do not rediscover completed work unless verification is contradicted.
- Terminal fixture records must contain sources and the evidence/model state needed for audit.
- Zero-fixture league completion requires at least one explicit verification source; absence from an API/dataset is not enough.
- `blocked` is reserved for genuine external/technical inability to proceed and requires a blocker reason. Pending research is `processing`, not blocked.

## Validation modes
- `npm run run:validate -- <run-file>` checks checkpoint integrity and allows legitimate in-progress work.
- `npm run run:finalize -- <run-file>` is the strict completion gate and must pass before a run is described as finished or final recommendations are presented as the completed run.

## Completeness invariants
- The run must contain exactly the current configured league IDs from `data/leagues.json`: no missing, duplicate or unknown league checkpoints.
- Duplicate fixture identities are invalid.
- Terminal BET/WIN/LOSS records require a persisted recommended bet; NO_MODEL requires a persisted reason; all terminal fixtures require sources.
- CI runs integrity validation for every changed run/backtest file and additionally runs strict finalization validation whenever a changed file declares `status: "complete"`.
