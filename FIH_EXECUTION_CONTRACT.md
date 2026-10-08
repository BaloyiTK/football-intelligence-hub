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

## ChatGPT research ownership and canonical commit boundary — LOCKED

For Step 2, ChatGPT is the authoritative research executor. Each eligible fixture MUST receive an actual ChatGPT web-search job. Repository-local homepage scanners, scrapers, cached-link discovery, or direct-public-source discovery may assist, but MUST NOT be accepted as a substitute for the ChatGPT web-search requirement.

Research is accumulated across the complete eligible fixture universe for the date in working/checkpoint state. Individual fixture completion MUST NOT create a canonical GitHub research commit. Only after every eligible fixture has a validated research record, complete coverage has been reconciled, and the facts-only research schema passes validation may the complete per-date canonical research artifact be committed. The canonical research stage uses one batch commit for the completed daily research dataset.

Research stores source-backed facts only. Derived statistics, strength assessments, rates, rest-day calculations, expected-goal calculations, probabilities, and betting conclusions belong to downstream FIH calculation/model stages.

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

## Executor-error recovery — LOCKED

An executor error, assistant/tool orchestration mistake, premature chat-response boundary, accidental interruption, or incorrect intermediate termination during an authorized unfinished FIH run is a recoverable execution event, not a new authorization boundary.

On detection, the executor MUST:
1. classify the run as RECOVERING under `EXEC-001` and the existing recovery rules;
2. re-read the authoritative contract, policy, machine rules, ledger, and canonical artifacts;
3. identify the earliest unverified durable stage;
4. resume that stage without requiring the user to repeat `run today`, `run tomorrow`, `backtest`, `continue`, or a status request;
5. continue until COMPLETE, a contract-valid BLOCKED hard stop, or a genuine external WAITING state.

An executor/chat-boundary error MUST NOT itself justify WAITING, BLOCKED, or COMPLETE. If a user message reveals that execution stopped prematurely, that message is sufficient detection of the recovery event and execution must resume immediately under the original authorization.

## Authority
This contract and `FIH_EXECUTION_POLICY.md` jointly govern FIH execution. Where wording differs, use the interpretation that preserves data integrity while requiring continuation of an already-authorized full-cycle run.

---
Repository signature: FIH Execution Contract v1.0
User authorization basis: explicit project instruction to bind full-cycle execution semantics.
## Dynamic date-input rule — LOCKED

All operational FIH dates are runtime data, not code configuration.

- A requested run date MUST be accepted as a runtime input after normal YYYY-MM-DD validation.
- A multi-day scope MUST derive its dates dynamically from the requested range and Africa/Johannesburg calendar date.
- Hard-coded operational dates and fixed historical-date allowlists are forbidden.
- Adding or processing another valid date MUST NOT require a source-code change.
- Date values may appear in persisted artifacts, tests/fixtures, logs, or historical records as data; they MUST NOT be used as an allowlist controlling which valid operational dates FIH can process.
- After validation, DATE-001 alone determines routing: past -> BACKTEST; today/future -> PREDICTION.

## Per-date backtest storage — LOCKED

Backtest ranges are execution scope, not canonical storage units. Every historical date MUST be processed and persisted independently.

Canonical dated artifacts use the date as the file key under the applicable backtest stage, including fixtures, research, model output, decisions, evaluations, and the DAY_COMPLETE daily summary. A range runner MUST complete one date through the full lifecycle before advancing to the next date. On interruption or recovery, verified DAY_COMPLETE dates are skipped and execution resumes from the earliest unfinished date. Range-level reports are derived aggregates only and MUST be rebuilt from the verified per-date artifacts rather than replacing them as the source of truth.


## Terminal response gate — LOCKED

Once an FIH run is authorized, a user-facing final response is not a valid termination mechanism while the persisted run ledger is `RUNNING` or `RECOVERING` and eligible fixtures remain unfinished.

Before ending an execution response, the executor MUST evaluate the terminal response through the contract gate with the current date/run evidence. If unfinished eligible work remains, the gate must refuse a normal terminal response under `RESP-001`, and execution must resume from the earliest unfinished persisted stage.

Only `COMPLETE`, contract-valid `BLOCKED`, or genuine `WAITING` may end the authorized run. Intermediate PASS, fixture acquisition, research completion, model completion, decision completion, progress reporting, tool boundaries, workload size, and chat-response boundaries are non-terminal.

## Authoritative Vercel infrastructure — LOCKED

FIH fixture acquisition is pinned to the following verified Vercel project identity:
- Team ID: `team_PqqLMe7lJ3UauT95Ln9gMlJT`
- Project ID: `prj_Lp5vEpKKq6IwVwGblRA8tfpECUn6`
- Project name: `football-intelligence-hub-654j`
- Production domain: `football-intelligence-hub-654j.vercel.app`
- Fixture producer: `/api/backtest-ingest`

The machine-readable source of truth is `config/fih-execution-rules.json -> infrastructure.vercel`. Fixture workflows MUST use this project/domain and MUST NOT silently fall back to another Vercel project. A deliberate infrastructure migration requires an explicit rules/config change and verification of the replacement project before use.

## In-turn execution and background-status integrity — LOCKED

An authorized FIH run with useful work that can still be executed in the current assistant turn MUST continue executing that work. The assistant MUST NOT end the turn with a final response merely to report RUNNING, progress, a checkpoint, an intermediate stage completion, workload size, or a recoverable error. Progress messages are non-terminal and must be followed by continued execution in the same turn.

A final response is permitted only after COMPLETE, a contract-valid BLOCKED hard stop, a genuine external WAITING state, or an execution-environment boundary that forcibly prevents further tool execution. A voluntary assistant response boundary is not such a boundary.

FIH MUST NOT claim that work is running in the background unless a real independently executing workflow, automation, or external process has been started and verified active. Ordinary assistant/tool execution ends with the turn and must be represented as in-turn execution only.

These requirements are enforced by `TURN-001` and `BG-001` in `config/fih-execution-rules.json`.



## Step 1 -> Step 2 durable transaction — LOCKED

Step 1 is not merely fixture discovery. Before Step 2 begins, the exact eligible fixture universe (IDs and count) is frozen against the active `researchRunId` in a durable Step-2 working manifest. Step 2 MUST reconcile against that frozen universe throughout execution; missing, extra, duplicate, or changed eligible fixtures reopen reconciliation.

For every eligible fixture, Step 2 executes this indivisible work unit:

**ChatGPT web search -> facts-only record -> validate evidence/source references -> atomically update the temporary accumulation file -> reread the file -> revalidate the written fixture record -> mark checkpoint validated -> continue immediately to next unvalidated fixture.**

A web search, extracted evidence in chat/tool context, or an unvalidated write does not count as fixture completion. Evidence must become durable before advancing.

Interruption recovery MUST load `the active ChatGPT temporary Step-2 accumulation file`, preserve all already validated fixture checkpoints, and resume from the first missing/unvalidated fixture. Workload size, a response boundary, or a search-call boundary must never cause validated checkpoint data to be discarded.

Step 2 reaches its promotion boundary only at exact **N/N validated checkpoints**, where N is the frozen eligible fixture count. It must then reconcile IDs/counts, construct the full facts-only daily artifact, validate the aggregate against the active `researchRunId`, promote it to `data/research/<date>.json`, create exactly one canonical research commit, verify the repository commit/HEAD, reread the committed canonical file, and revalidate it.

**N/N without successful canonical commit verification is RECOVERING, not Step-2 completion.** Likewise, a canonical file or commit with fewer than N/N validated fixture checkpoints is invalid. Model execution is forbidden until this entire promotion-and-verification sequence passes.


### Step-2 checkpoint Git boundary — LOCKED

**NON-NEGOTIABLE STORAGE/COMMIT INVARIANT:** Step 2 has exactly **one temporary accumulator file** for the active date/`researchRunId` and exactly **one canonical research Git commit** for that `researchRunId`. All validated fixture research is appended/updated in that same temp file. No per-fixture temp-file persistence, no partial research Git commits, and no second canonical research commit for the same `researchRunId` are permitted.

The active ChatGPT temporary Step-2 accumulation file is execution working state, not canonical repository research history. Fixture-by-fixture and partial-batch Git commits from this path are forbidden. A validated checkpoint means durable working-state persistence and reread validation; it does **not** mean a Git commit.

Research has one canonical Git boundary for each `researchRunId`: only after exact N/N working checkpoints reconcile and aggregate validation passes may the completed dataset be promoted to `data/research/<date>.json` and committed once. The canonical research commit MUST exclude `data/research-work`. After that commit, repository state must be reread and the canonical artifact revalidated before model execution.

If checkpoint persistence is unavailable in the active execution environment, the executor must repair or use an authorized non-canonical working-state persistence path; it MUST NOT substitute per-fixture Git commits.


### ChatGPT temporary Step-2 accumulator — LOCKED

During ChatGPT-owned Step 2, the complete in-progress research batch MUST be accumulated in exactly one temporary local execution file for the date, keyed internally to the active `researchRunId`. Every validated fixture record for that batch lives in this same accumulator file; a per-fixture file tree is forbidden. After each fixture is researched and validated, ChatGPT atomically updates that file, rereads it, verifies fixture identity/count and the just-written record, then continues immediately to the next fixture. This temporary file is not Git history and MUST NOT be committed.

At exact N/N, ChatGPT validates the complete temporary dataset against the frozen Step-1 universe, promotes the validated content to the canonical `data/research/<date>.json`, and performs the single canonical research commit and post-commit reread verification. If the temporary execution workspace itself is destroyed before promotion, only the unpromoted temporary research is considered lost; Step 1 remains authoritative and Step 2 restarts from that frozen universe rather than fabricating completion.


## Step 2 -> Step 3 verified lineage — LOCKED

Model execution is prohibited until a dedicated Step-3 input gate proves all of the following against repository state: the canonical Step-2 artifact is complete for the frozen eligible fixture universe; its `researchRunId` exactly matches the active ledger; the research artifact is tracked and has no uncommitted changes; the active `researchRunId` appears in exactly one canonical research commit for that dated artifact; and the current frozen Step-1 fixture board still matches the ledger universe.

Once a `researchRunId` exists, recovery and manual run workflows MUST reuse the frozen Step-1 board. They MUST NOT silently perform a fresh fixture acquisition before Step 3. Fixture-universe drift is a reconciliation event and must fail closed before probability calculation.

Every canonical Step-3 model artifact MUST record the exact Step-2 lineage it consumed: `researchRunId`, deterministic `inputResearchHash`, and `inputResearchCommit`. Direct invocation of the model runner MUST execute the same Step-3 input gate and therefore cannot bypass this boundary.

These invariants are machine-locked by `MODEL-001` through `MODEL-004` in `config/fih-execution-rules.json`.

### Limit-aware Step-2 continuation — LOCKED

A known ChatGPT/web-search call ceiling is an execution-capacity boundary, not a Step-2 failure and not permission to discard progress. Step 2 MUST operate in bounded research chunks with safety headroom below the known ceiling. Each chunk uses the same date, frozen eligible fixture universe and `researchRunId`.

Before available search capacity is too low to complete another fixture research unit, ChatGPT MUST atomically flush and reread the temporary accumulator, verify unique fixture IDs and generation identity, and preserve a continuation cursor containing `validatedCount`, `expectedCount`, and the exact next fixture ID. The next execution opportunity resumes that same research generation from the cursor, skipping fixture IDs already validated in the accumulator. It MUST NOT rerun Step 1 merely because a research chunk ended, and it MUST NOT create a partial Git research commit.

Research chunks have no canonical meaning. Only exact N/N aggregate validation may promote the accumulated dataset and cross the single canonical Git boundary.


### Step-3 evidence normalization — LOCKED

Passing lineage verification is necessary but not sufficient for Step 3. The model stage MUST normalize the canonical facts into an explicit typed model input before probability calculation. Direct factual inputs, deterministic downstream derivations, context-only evidence, and unavailable evidence must be distinguished and auditable per fixture.

PPG, goal-difference-per-game, recent scoring/conceding/BTTS/Over-2.5 rates, rest days, and FIH expected-goal parameters are downstream calculations and must be derived in Step 3 from source-backed Step-2 facts. Missing values remain undefined. Step 2 must not supply xG/xGA as a model input; Step 3 exclusively owns `lambdaHome` and `lambdaAway`. Squad availability, motivation/competition context, H2H, and opponent-strength context must remain context-only until an explicit verified/calibrated numerical mapping exists; they must never be converted into arbitrary scores merely because the model has numeric fields available.

Every Step-3 fixture output MUST carry evidence-use accounting sufficient to show what was USED, DERIVED, CONTEXT_ONLY, or UNAVAILABLE. Any evidence used numerically must trace to validated Step-2 source references; external xG/xGA is forbidden as a model input; and missing optional inputs may not be replaced by neutral numeric defaults. Pairwise PPG/GD adjustments apply only when both teams have verified finite values. FIH expected goals (`lambdaHome`, `lambdaAway`) are calculated only by Step 3. These invariants are machine-locked by `MODEL-005` through `MODEL-011` and `RESEARCH-016`.
