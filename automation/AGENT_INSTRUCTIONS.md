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

For each requested date, discover fixtures globally before league-by-league research:
1. Query at least TWO independent global date-indexed football fixture sources for the requested date (for example FBref plus a broad worldwide fixture index such as LiveScore/Sofascore/FootballFixtures).
2. Normalize country, competition and team aliases, then map the global fixture universe against every configured league in `data/leagues.json`.
3. Persist the global discovery sources and all mapped fixtures before modelling.
4. If the global sources agree that a configured league has no fixtures, record a verified zero-fixture checkpoint using those global sources. Do NOT perform a separate league search merely to prove the same zero.
5. If sources disagree, a competition is ambiguous, a configured league is missing from source coverage, or a fixture/date/classification looks suspicious, perform targeted league/official-source verification for ONLY that exception.
6. After discovery, process `data/leagues.json` in stored order. Set leagues with mapped fixtures to `processing`, save EVERY mapped fixture, and execute fixture research/model rules.
7. Global discovery reduces search volume; it NEVER reduces the configured 61-league coverage requirement.
6. Process each fixture through `RESEARCH_RULES.md` in order: Full -> Standard -> Basic -> No Model.
7. Preserve sources and evidence timestamp/cutoff. Missing data is null/unknown, never invented or silently zero.
8. Run the exact production model from `lib/model.ts`.
9. Save the frozen model output/recommended bet (or NO BET/NO MODEL) immediately.
10. For historical runs only, reveal the final score after freezing and grade the recommendation.
11. Mark the date/league `complete` only after every discovered fixture is processed.
12. Save/checkpoint before moving to the next league.

## Global discovery source rules
- A generic competition label such as "Premier League" or "Serie A" MUST be disambiguated by country before mapping to a configured league.
- Date/time normalization must use the fixture venue/competition date correctly; timezone-shifted global pages must not silently move fixtures across dates.
- Youth, women, reserves/U23, club friendlies and other competitions must not be mapped to a senior configured league unless that exact competition is configured.
- Postponed/cancelled fixtures may be retained for audit but are not modelled as playable fixtures.
- One global source is insufficient to certify the entire daily universe. Use at least two independent global sources, and targeted verification for disagreements.
- Cache/reuse the date-level global discovery result across all 61 leagues.

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
- If finalization validation fails, DO NOT describe the run as complete or label its selections as the full/final slate. Continue active execution when possible. If a genuine blocker prevents continuation, persist/report the blocker and surface any already-frozen prediction-eligible BET records as PARTIAL predictions.
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

## Prediction visibility and graceful partial results
Run completion and prediction visibility are separate concepts.

A fixture is prediction-eligible when ALL are true:
- it is persisted in the run file with terminal `status: "BET"`;
- `recommendedBet` exists and contains market, pick, raw probability, adjusted probability, reliability and rating;
- research/model evidence is frozen before kickoff and the record has a non-empty `sources` array;
- it is not subsequently invalidated by fixture/date/competition verification.

Prediction-eligible records MAY be shown immediately during progress when useful, when the user asks for predictions/results, and MUST be shown if a genuine blocker ends an otherwise active daily run and at least one eligible prediction exists.

When the global finalization gate has not passed:
- label surfaced bets `PARTIAL — verified/frozen so far`;
- state the persisted coverage (leagues complete/total and fixtures terminal/discovered);
- never imply the partial set is the day's complete slate;
- never expose discovered-only, research-pending, NO_BET or NO_MODEL records as recommendations.

When `npm run run:finalize -- <run-file>` passes, the eligible BET set may be labelled the completed/final daily recommendations.

A blocker therefore stops further research execution, not access to valid predictions already frozen before the blocker.

## Automatic retry and resume
- Repository automation may resume persisted `blocked` or `in-progress` backtests from their saved cursor/checkpoints.
- Automatic resume MUST NOT recreate or re-grade terminal fixture records; the runner skips completed date/league checkpoints and duplicate fixture identities.
- Transient runner failures may retry with bounded exponential backoff. A retry does not permit fabricated evidence or bypass validation.
- Scheduled automation may only process evidence already available to the repository. It cannot replenish ChatGPT/web-search allowance or invent missing research. If required evidence is absent, the run remains blocked/in-progress until evidence is supplied by a valid source.
- Completion still requires the strict finalization gate; automatic retry does not weaken any coverage, evidence, leakage or audit requirement.

## Fail-closed execution controller
- A historical backtest execution is successful only when runner execution, deterministic grading audit, and strict finalization all exit successfully.
- Use `npm run backtest:controller -- --from ... --to ... --evidence ... --resume <run-file>` for an existing run once evidence is available.
- An assistant progress response is never an execution boundary. If the active execution cannot reach the strict finalizer, persist a resumable non-complete state and exact cursor/blocker before ending.
- Never infer completion from discovery counters or a modelled subset.

## Mandatory data-repair loop
When fixture, date, competition, team, result, or evidence data conflicts, looks stale, or fails validation, NEVER stop at the first discrepancy. Execute this repair loop before a blocker is allowed:
1. Re-query the disputed item with targeted searches.
2. Prefer authoritative/organizer/association sources, but distinguish a published schedule from an actual played result; schedules may be superseded.
3. Require independent corroboration for changed/cancelled/replaced fixtures or results when available.
4. Check cancellation/postponement/replacement, timezone/date rollover, team aliases, competition classification, and youth/women/reserve contamination.
5. Correct the persisted fixture universe and counters immediately when wrong data is proven.
6. Continue from the corrected cursor automatically; a correction is NOT a stopping condition.
7. Only persist status=blocked after all reasonable repair paths above have actually been attempted and the unresolved fact is necessary to model or grade safely. Persist attempted sources and exact unresolved fact.
8. Never invent missing data merely to avoid a blocker.
