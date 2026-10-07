# FIH EXECUTION CONTRACT

Version: 1.0
Effective date: 2026-10-06
Project: Football Intelligence Hub (FIH)

## Purpose
This contract defines the execution behavior for authorized FIH daily runs and backtests. It exists to prevent an authorized full-cycle run from being incorrectly terminated at an intermediate stage.

## Date routing contract — LOCKED

Every explicit FIH run date is classified against the current Africa/Johannesburg calendar date before execution:
- requested date before today -> BACKTEST;
- requested date equal to today -> PREDICTION;
- requested date after today -> PREDICTION.

BACKTEST reconstructs only evidence verifiably available before the applicable historical cutoff/kickoff, freezes the prediction before actual results are attached, then grades against verified actual results. Historical outcomes may be used only after prediction freeze for evaluation, failure-pattern analysis, and controlled model-improvement testing. Look-ahead leakage is forbidden.

PREDICTION for today or a future date uses only evidence available at execution time. Future results, later team news, later odds, or any information not yet available must never influence the prediction. Future-date predictions may be refreshed as newer legitimate pre-match evidence becomes available.

Prediction fixture snapshots are dated and isolated from backtest snapshots. Running a future prediction must never overwrite today's authoritative prediction board.

## Binding command semantics
When the user issues `run today`, `backtest <scope>`, or `backrest <scope>`, that command authorizes the complete applicable FIH pipeline from the current verified stage through final persisted and verified output.

The user is NOT required to issue `continue`, repeat the command, request status, or otherwise manage progression between stages.

## Scheduled daily-run ownership — LOCKED

The scheduled `Daily FIH Run` is the primary owner of the complete daily prediction cycle. The normal daily cycle MUST NOT depend on a watchdog, recovery timer, repeated user command, status request, or later invocation to make ordinary forward progress.

After the current-date fixture/data board is acquired and verified, the same authorized daily run must continue through every required downstream stage: fixture-specific research/evidence, canonical research persistence and verification, locked active model execution (or a valid `INSUFFICIENT_DATA` outcome), model persistence and verification, legitimate market-odds/value processing where available, BET/NO_BET/NO_MODEL decision, decision/prediction persistence and verification, aggregate reconciliation, and required repository commit verification.

A heartbeat, checkpoint refresh, ledger reconciliation, fixture ingestion, research batch, model batch, decision batch, commit, or progress/status report is NEVER a successful end state while eligible work remains. Checkpoints exist only to preserve durability across an unavoidable execution interruption; they are not normal pacing.

The watchdog is not part of normal daily execution and is not required for DAILY_CYCLE_COMPLETE. If the watchdog is disabled, the Daily FIH Run remains fully responsible for start-to-finish execution.

## Continuous-execution obligation
After authorization, execution must follow:

**Invoke -> Verify output -> Persist -> Verify persisted data -> Continue**

A successful intermediate stage is not completion. A recoverable failure is not completion. A progress update is not completion. A tool-call batch ending is not completion. A chat-response boundary is not completion.

The authorized run remains the active task until one of the termination conditions below is satisfied.

## Self-healing guarantee

Any generated or derived artifact that can be reconstructed from an accessible authoritative source is disposable/rebuildable state. Missing, deleted, stale, empty, malformed, partial, schema-invalid, or internally inconsistent generated artifacts MUST be rebuilt automatically and MUST NOT terminate an authorized run.

Recovery of rebuildable state is part of the already-authorized run and requires no additional user command or approval. The executor must reacquire authoritative input, regenerate, validate, persist, independently re-read/verify, and continue from the interrupted stage.

A user or external process deleting a generated artifact is treated identically to accidental loss. The run must self-heal when the authoritative source and authorized persistence path remain available.


## Mandatory failure recovery loop — LOCKED

Every failed stage MUST execute this loop without renewed user authorization:

**Investigate -> Fix or authorized fallback -> Verify the recovery -> Resume earliest unfinished stage -> Continue**

A failed command, workflow, provider request, deployment, artifact write, validation, or intermediate pipeline stage is never a normal stopping point. After a failure, the executor must identify the concrete cause, apply a bounded repair or authorized fallback, verify that the failed condition is resolved, and immediately continue the original authorized task.

If the first repair fails, repeat the recovery loop using the next applicable recovery path. Only the existing HARD STOP rules may terminate this loop. Status/progress reporting must not replace continuation.

## Durable continuation guarantee

Every authorized run must be resumable from durable verified state. Long-running research and processing MUST be decomposed into persist-and-verify work units with a run ledger/checkpoint that identifies the earliest unfinished fixture and stage.

A process interruption, execution-duration boundary, response boundary, stale logical RUNNING state, transient provider failure, repository write conflict, or partial batch is a recovery event, not completion and not by itself a Hard Stop. On the next execution opportunity, the executor must reconstruct state from canonical persisted artifacts and resume automatically from the earliest unverified unit.

Completion requires reconciliation: every eligible fixture must have a verified terminal state and aggregate counts/artifacts must match the authoritative eligible fixture universe. Any mismatch automatically reopens the run at the earliest inconsistent stage.

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


## Executable contract gate — LOCKED

The machine-readable rules in `config/fih-execution-rules.json` and validator `scripts/contract-gate.ts` are mandatory enforcement for execution status decisions.

Before asserting any stage PASS, RECOVERING, WAITING, BLOCKED, or COMPLETE, the executor MUST evaluate the applicable rule IDs and evidence through the contract gate. A human-language conclusion cannot override a refused gate result.

Mandatory invariants:
- Ordinary failure maps to RECOVERING, not BLOCKED.
- One failed tool/provider/deployment/write path can never by itself authorize BLOCKED.
- BLOCKED requires `TERM-001` + `REC-003`, a named policy hard stop, evidence, and all applicable bounded recovery paths recorded as attempted or unavailable.
- COMPLETE for the daily prediction cycle requires `TERM-002`, a reconciled durable ledger with every eligible fixture COMPLETE, verified canonical research/model/decision artifacts, aggregate verification, and verified repository commit. Production deployment is monitored separately as publication health; a deployment quota or deployment delay does not reopen or block a completed prediction computation cycle.
- WAITING requires `TERM-003` and a genuinely active external process with no useful authorized work remaining.
- A failed run MUST NOT disable recurring FIH automation unless the user explicitly requests disabling it or continued execution is itself unsafe/destructive.
- Persisted contract state and gate evidence outrank an assistant/chat conclusion.

If the gate refuses a proposed terminal verdict, execution MUST return to RECOVERING and resume at the earliest unverified stage.

## Authority
This contract and `FIH_EXECUTION_POLICY.md` jointly govern FIH execution. Where wording differs, use the interpretation that preserves data integrity while requiring continuation of an already-authorized full-cycle run.

---
Repository signature: FIH Execution Contract v1.0
User authorization basis: explicit project instruction to bind full-cycle execution semantics.