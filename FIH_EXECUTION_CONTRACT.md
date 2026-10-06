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

## Authority
This contract and `FIH_EXECUTION_POLICY.md` jointly govern FIH execution. Where wording differs, use the interpretation that preserves data integrity while requiring continuation of an already-authorized full-cycle run.

---
Repository signature: FIH Execution Contract v1.0
User authorization basis: explicit project instruction to bind full-cycle execution semantics.
