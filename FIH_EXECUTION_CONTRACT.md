# FIH EXECUTION CONTRACT

Version: 1.0
Effective date: 2026-10-06
Project: Football Intelligence Hub (FIH)

## Purpose
This contract defines the execution behavior for authorized FIH daily runs and backtests. It exists to prevent an authorized full-cycle run from being incorrectly terminated at an intermediate stage.

## Binding command semantics
When the user issues `run today`, `backtest <scope>`, or `backrest <scope>`, that command authorizes the complete applicable FIH pipeline from the current verified stage through final persisted and verified output.

The user is NOT required to issue `continue`, repeat the command, request status, or otherwise manage progression between stages.

## Continuous-execution obligation
After authorization, execution must follow:

**Invoke -> Verify output -> Persist -> Verify persisted data -> Continue**

A successful intermediate stage is not completion. A recoverable failure is not completion. A progress update is not completion. A tool-call batch ending is not completion. A chat-response boundary is not completion.

The authorized run remains the active task until one of the termination conditions below is satisfied.

## Self-healing guarantee

Any generated or derived artifact that can be reconstructed from an accessible authoritative source is disposable/rebuildable state. Missing, deleted, stale, empty, malformed, partial, schema-invalid, or internally inconsistent generated artifacts MUST be rebuilt automatically and MUST NOT terminate an authorized run.

Recovery of rebuildable state is part of the already-authorized run and requires no additional user command or approval. The executor must reacquire authoritative input, regenerate, validate, persist, independently re-read/verify, and continue from the interrupted stage.

A user or external process deleting a generated artifact is treated identically to accidental loss. The run must self-heal when the authoritative source and authorized persistence path remain available.


## Permitted termination conditions
Execution may terminate only when:

1. **FULL CYCLE COMPLETE** — every required stage for the authorized run has been executed, verified, persisted, and the persisted output verified.
2. **HARD STOP** — one of the hard-stop conditions in `FIH_EXECUTION_POLICY.md` is actually reached.
3. **GENUINE EXTERNAL WAIT** — an external system is still processing and no further useful action can be taken until it finishes. This is reported as WAITING, not COMPLETE.

Workload size, number of fixtures, number of web searches, unavailable individual evidence fields, an intermediate commit, an intermediate successful stage, or the desire to provide a progress report are NOT hard stops.

## Research obligation
FIH intentionally uses free web research for the research/evidence layer rather than requiring a paid football-data API.

For each eligible fixture:
- perform fixture-specific web research;
- enforce the applicable information cutoff;
- attempt every required evidence category;
- persist verified evidence and source references;
- record genuinely unverifiable fields as `UNAVAILABLE`;
- continue the run.

Missing individual evidence does not terminate the run unless proceeding would violate data integrity.

## Backtest 06:00 SAST contract
For the current historical backtest architecture:
- research snapshot: 06:00 Africa/Johannesburg (SAST, UTC+02:00);
- kickoff before 06:00: excluded;
- kickoff exactly 06:00: excluded;
- kickoff after 06:00: eligible;
- only information verifiably available by 06:00 SAST may influence the frozen model assessment;
- later information and actual results may only be attached after the reconstructed prediction/decision is frozen.

## Status messages
Status messages are informational only. They do not cancel, pause, narrow, or complete an authorized run.

`RUNNING` means execution is actively occurring in the current turn.
`WAITING` means a genuine external dependency is processing.
`BLOCKED` means a defined hard stop requires user action.
`COMPLETE` may be used only after full-cycle verification.

## Anti-repeat guarantee
The user should not need to repeatedly ask why execution stopped or tell FIH to continue between ordinary stages. If execution is incorrectly terminated at an intermediate stage, that is an execution-policy failure, not a requirement for renewed authorization.

## Preflight
Before every FIH execution/resumption:
1. Read `FIH_EXECUTION_CONTRACT.md`.
2. Read `FIH_EXECUTION_POLICY.md`.
3. Determine the last verified persisted stage.
4. Resume from that stage.
5. Continue until a permitted termination condition is reached.


## Day-by-day backtest execution rule

Every multi-day backtest MUST be executed as independent complete daily batches, matching the daily fixture-acquisition boundary.

For `backtest N days` / `backrest N days`:
1. Resolve the requested dates.
2. Process the earliest unfinished date only.
3. For that date, complete the entire backtest lifecycle: fixture verification -> >06:00 SAST eligibility -> fixture-specific research -> persist/verify evidence -> FIH V2 model -> persist/verify model -> historical odds/value where available -> decision/NO BET -> freeze -> actual results -> evaluation -> persist/verify daily metrics.
4. Mark the date `DAY_COMPLETE` only after all required daily artifacts and metrics are persisted and verified.
5. Immediately advance to the next unfinished date without requiring renewed user authorization.
6. Never require all dates' research to finish before modeling/evaluating an already researched date.
7. On resume, skip verified `DAY_COMPLETE` dates and restart from the earliest unfinished date/stage.
8. After every requested date is `DAY_COMPLETE`, aggregate the backtest from the underlying daily counts/records and persist/verify the combined result.
9. Combined percentages MUST be calculated from combined numerators and denominators (for example, total wins / total settled selections), never by taking an unweighted average of daily percentages.
10. The multi-day backtest is `COMPLETE` only after the combined aggregate is persisted and verified.

The active backtest model is FIH V2 unless the user explicitly requests a model comparison or another model. V1 is retained only as an archived/reference baseline and is not run during ordinary V2 backtests.

## Authority
This contract and `FIH_EXECUTION_POLICY.md` jointly govern FIH execution. Where wording differs, use the interpretation that preserves data integrity while requiring continuation of an already-authorized full-cycle run.

---
Repository signature: FIH Execution Contract v1.0
User authorization basis: explicit project instruction to bind full-cycle execution semantics.