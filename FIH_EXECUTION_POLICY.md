# FIH Autonomous Execution Policy

> **Binding contract:** Before applying this policy, read `FIH_EXECUTION_CONTRACT.md`. The contract and this policy jointly govern every FIH run/resumption. A previously authorized full-cycle run remains authorized through intermediate stages and progress updates.

For an explicitly authorized FIH task, recoverable technical failures do not end the task.

## Mandatory policy preflight
Before executing or resuming any FIH command, status-triggered continuation, daily run, or backtest:
1. Fetch and read the current `FIH_EXECUTION_POLICY.md` from the repository.
2. Treat the repository version as the authoritative execution contract for that run.
3. Check the current pipeline stage against the policy before taking the next action.
4. After every stage result, re-apply the mandatory lifecycle and continuation rules before deciding whether to continue or stop.
5. Never stop because of an intermediate success, recoverable failure, status update, or chat response boundary.
6. A response may end only when the full authorized cycle is complete, a defined Hard Stop is reached, or an external system is genuinely still processing and no further action can yet be taken.

## Mandatory stage lifecycle
Every daily-run and backtest stage must follow:

**Invoke -> Verify output -> Persist -> Verify persisted data -> Continue immediately to the next defined stage**

A stage is not complete merely because a command, API, function, deployment, or model step returned successfully. Completion of one stage is not a stopping point when the run has further defined stages.

Before continuing, verify the actual output and then verify the persisted artifact/state. For fixture ingestion this includes a valid date/schema, a non-zero fixture count, a non-empty payload, and the expected file committed to GitHub.

After fixture acquisition verifies successfully, automatically begin the research/evidence stage from the complete verified fixture board. Do not stop merely to report that fixtures were obtained.

If a stage fails, use:

**Invoke -> Failure -> Investigate -> Fix -> Retry -> Verify -> Persist -> Verify -> Continue**

This lifecycle applies throughout the FIH pipeline, including fixture ingestion, research/evidence, model probabilities, market data, market comparison, decisions, predictions, and verified results.

## Primary daily executor rule

The scheduled Daily FIH Run is the normal execution engine, not merely a trigger. Once today's fixture/data acquisition is verified, it MUST own and continue the remaining pipeline to a terminal result. It must not intentionally hand ordinary unfinished work to a watchdog or wait for an hourly recovery cycle.

The normal sequence is:

**Acquire/verify today's data -> research every eligible fixture -> persist/verify research -> run locked model or valid INSUFFICIENT_DATA -> persist/verify model -> collect legitimate market data where available -> compare model/market -> BET/NO_BET/NO_MODEL -> persist/verify decisions and public predictions -> reconcile aggregates -> verify required commit -> DAILY_CYCLE_COMPLETE.**

When eligible work remains, refreshing only `heartbeatAt`, `updatedAt`, a recovery counter, or a ledger checkpoint without advancing or verifying canonical fixture artifacts is not meaningful execution progress and cannot satisfy the daily run.

## Pipeline continuation rule
For an authorized daily run or backtest, the run is one continuous task. Each successfully verified stage triggers the next defined stage automatically:
1. Fixture acquisition
2. Research/evidence collection for every eligible fixture
3. Persist and verify evidence, including required last-five overall and H2H records
4. FIH probability/fair-odds calculation
5. Persist and verify model output
6. Historical/current market-odds collection where legitimately available
7. Market-margin removal and FIH-vs-market comparison
8. Strongest qualifying market or NO BET decision
9. Persist and verify predictions/decisions
10. For backtests only, ingest verified actual results after the reconstructed pre-match decision is frozen
11. Evaluate results and persist/verify backtest metrics

Do not pause between these stages merely to provide a status update. Status updates describe progress; they do not terminate the authorized run.

## Rebuildable-artifact self-healing

Generated and derived artifacts are **rebuildable state**, not hard dependencies. Their absence or corruption MUST trigger recovery, not termination.

This includes daily fixture snapshots, normalized fixture boards, research/evidence artifacts, model outputs, decision files, publication artifacts, generated indexes/manifests, and other outputs whose authoritative inputs can still be reacquired.

For every required artifact:
1. Detect MISSING, STALE, EMPTY, MALFORMED, SCHEMA_INVALID, PARTIAL, or INCONSISTENT state.
2. Identify the authoritative upstream source and last verified stage.
3. Reacquire/recompute from that source. Never reconstruct from guesses and never substitute an older dated artifact for current data.
4. Validate the regenerated output against date, schema, completeness, integrity, and stage-specific invariants.
5. Persist it to the canonical path.
6. Re-read the canonical persisted artifact and verify it independently.
7. Resume from the interrupted stage automatically.
8. If persistence races with another writer, refresh repository state, reconcile non-conflicting changes, and retry rather than abandoning the run.

A deleted generated file is therefore a **recovery signal**. Deletion alone is never a Hard Stop when its authoritative source remains accessible.

### Recovery escalation ladder
Before declaring a recoverable stage blocked, attempt the applicable paths in order:
- retry the canonical producer;
- inspect producer/runtime/workflow logs and correct bounded configuration or code defects;
- rebuild the artifact directly from the same authoritative source through an already-authorized protected execution path;
- restore/recompute downstream derived artifacts from newly verified upstream data;
- verify persistence and continue.

Do not treat a cached/reused artifact as proof that the producer can still acquire fresh source data. Fresh-data health tests must exercise and verify a genuine fresh acquisition path.

### Hard-stop threshold for rebuildable state
BLOCKED is permitted only when regeneration cannot proceed because the authoritative source/required authorization is genuinely unavailable after reasonable retries, all authorized persistence paths fail after investigation and bounded repair, continuing would require fabricated/known-invalid data, or recovery would require a destructive/material architecture change outside existing authorization.

## Durable checkpoint and resume protocol

Long workload is recoverable execution state, never a reason to terminate an authorized run.

### Persistent run ledger
For each daily run or backtest day, maintain a durable run ledger/checkpoint in repository state. It must record the run date, authoritative fixture-board identity, current stage, eligible fixture IDs, per-fixture status, retry counts, last verified artifact, and aggregate completion counts. The ledger itself is rebuildable from canonical artifacts when absent.

Per-fixture status progresses monotonically through applicable states such as PENDING -> RESEARCH_VERIFIED -> MODEL_VERIFIED -> DECISION_VERIFIED -> COMPLETE. A fixture may also reach a valid terminal classification defined by current model rules. Never mark a fixture complete merely because an attempt ran.

### Atomic work units
Process long stages as small durable work units. After each fixture or bounded batch: persist the artifact, verify the persisted artifact, then advance the ledger. Do not hold the only copy of progress in chat context, process memory, temporary logs, or an uncommitted workspace.

### Resume invariant
At every invocation and after every recoverable interruption, derive the next action from persisted state: verify the fixture board, reconstruct/validate the ledger if necessary, skip only work whose canonical artifact is independently verified, and resume the earliest unfinished fixture/stage. Never restart verified work unnecessarily and never skip unfinished work.

### Response/time-boundary behavior
Execution duration, tool-call limits, context limits, response boundaries, workload size, and fixture count are not Hard Stops. Before an unavoidable execution boundary, persist and verify the current work unit and checkpoint so the next authorized invocation can resume deterministically. Never describe an unfinished run as COMPLETE or BLOCKED merely because a boundary was reached.

### Retry and escalation
For transient network, provider, GitHub, deployment, parsing, or rate-limit failures: retry with bounded attempts; inspect returned status/logs; use safe backoff where appropriate; refresh stale repository SHAs before write retries; and fall back to another already-authorized path to the same authoritative source when available. Reset the retry counter after verified progress. A single failed tool/path is not proof that the stage is blocked.

### Stale execution recovery
If a prior run appears RUNNING but has no active external job and its checkpoint has not advanced, treat it as interrupted/stale. Re-read canonical artifacts, reclaim the run from the last verified checkpoint, and continue. Never wait indefinitely on a stale logical lock.

### Completion invariants
A daily run may be COMPLETE only when: the authoritative current-date fixture board is verified; every eligible fixture has a verified terminal per-fixture state; all required aggregate/model/decision artifacts reconcile with the eligible fixture count; the public artifact contains only publishable qualifying selections; required commits are verified; and the required production deployment points to the intended committed state. Count mismatches or orphaned PENDING fixtures trigger self-healing/resume.

### Recovery audit trail
Persist concise machine-readable recovery metadata for meaningful recovery events: detected condition, affected artifact/stage, attempted recovery path, outcome, and resumed checkpoint. Do not persist credentials or sensitive provider responses.

## Default recovery loop
1. Detect the failure.
2. Inspect the relevant logs, response, repository state, or deployment state.
3. Identify the narrowest evidence-supported root cause.
4. Apply a bounded, reversible fix within the already-authorized task scope.
5. Redeploy or retry as required.
6. Verify the fix from actual output/state.
7. Continue the original task automatically.
8. Repeat when a new recoverable issue appears.

## Vercel deployment-limit handling — LOCKED

A Vercel daily deployment limit, deployment-count quota, free-plan deployment ceiling, or deployment rate limit is **not** an FIH Hard Stop and is **not** a valid WAITING reason.

- Ignore the deployment quota as a computation blocker.
- Do not repeatedly redeploy merely to try to clear or bypass the quota.
- Continue the authorized FIH run through the current verified production deployment and/or another already-authorized path that does not require a new deployment.
- Track deployment/publication health separately from Step 1-2 computation readiness.
- A deployment quota alone may never require the user to repeat a command, approve continuation, or intervene.

This lock is enforced by `INFRA-002` in `config/fih-execution-rules.json`.

## Hard stops
Stop and ask the user only when:
- a new secret/credential or external authorization is required;
- the fix would be destructive or materially change the requested architecture/scope;
- the target project/repository/account is ambiguous;
- the same failure persists after reasonable bounded fixes;
- proceeding could corrupt production data or invalidate model/backtest integrity.

## Data integrity
Never fabricate missing data. Backtests must prevent look-ahead leakage. Failed or unavailable historical market data remains unavailable. Every completed test step must be persisted and verified before being treated as complete.

## Chat process status
Use a visible process-status indicator in FIH execution updates:
- **🟢 RUNNING** — work is actively being executed in the current turn.
- **🟡 WAITING** — an external service or deployment is processing, but ChatGPT is not continuously executing work in the background.
- **🔴 BLOCKED** — a hard-stop condition requires user input or authorization.
- **✅ COMPLETE** — the relevant step has been invoked, output verified, persisted, and the persisted state verified.

Never imply that ordinary chat/tool work is continuing in the background after a response has ended. If an external system is still processing, report **🟡 WAITING** and resume verification when execution continues.

## FIH completion rule
Do not report a recoverable intermediate failure or an intermediate stage completion as the final task result. Investigate, fix, retry, verify, persist, verify the persisted state, and continue through the next defined stage until the requested run completes or a hard-stop condition is reached.


## Command semantics — full-cycle execution
The following user commands authorize the complete FIH pipeline, not a single stage:

### `run today`
Interpret `run today` as authorization to execute the full daily cycle end-to-end:
1. Acquire the complete current LiveScore fixture board.
2. Verify and persist fixture data.
3. Research/evidence collection for every eligible pre-match fixture.
4. Persist and verify required evidence.
5. Calculate FIH probabilities, expected goals, and fair odds.
6. Persist and verify model output.
7. Collect current market odds only after the FIH assessment is frozen.
8. Remove bookmaker margin and compare FIH probabilities with market fair probabilities.
9. Select the strongest qualifying actionable market or NO BET.
10. Persist and verify the day's prediction output.
11. Complete all defined daily-run validation/audit steps.

Do not stop after fixtures, research, model calculation, odds collection, or any other intermediate stage.

### `backtest <scope>` / `backrest <scope>`
Treat `backrest` as an accepted shorthand/typo for `backtest`.

Interpret either command as authorization to execute the full requested historical cycle end-to-end for the stated date/range/scope:
1. Acquire every historical fixture board in scope.
2. Verify and persist immutable dated fixture snapshots.
3. Reconstruct pre-kickoff research/evidence without look-ahead leakage.
4. Persist and verify evidence.
5. Calculate and freeze FIH probabilities, expected goals, and fair odds.
6. Persist and verify model output.
7. Collect historical market odds only where legitimately available; unavailable data remains unavailable.
8. Remove bookmaker margin and compare FIH with the historical market where possible.
9. Freeze the strongest qualifying market or NO BET decision before using the actual result.
10. Persist and verify reconstructed predictions/decisions.
11. Ingest and verify actual results.
12. Evaluate performance and persist/verify backtest metrics and outputs.

A status request may report current progress, but it does not cancel or redefine the full-cycle authorization. Intermediate completion is not task completion. Continue automatically until the full cycle completes or a Hard Stop defined in this policy is reached.


## Mandatory fixture-by-fixture research gate
The research/evidence stage is not satisfied by reusing the target fixture boards, by deriving form only from other fixtures inside the requested backtest window, or by running the probability model directly from LiveScore results.

For every eligible fixture in a daily run or backtest:
1. Start from that fixture on the verified LiveScore board.
2. Perform fixture-specific external web research using credible sources.
3. For a backtest, restrict evidence to information that existed before that fixture's kickoff; never use the target match result or later information as research input.
4. Attempt all evidence categories defined in `FIH_BUILD_STEPS.md`, including last-five overall, exact last 5 HOME matches for the home team, exact last 5 AWAY matches for the away team, **exact last 5 completed H2H meetings**, standings, goals profile, squad availability, motivation/context, opponent strength, and rest/schedule. A venue or H2H series with fewer than 5 must remain PARTIAL/UNAVAILABLE after genuine search exhaustion and must not be treated as complete. H2H VERIFIED requires five structured dated scorelines with source references; a prose summary or aggregate H2H claim is insufficient.
5. Persist source references/URLs and retrieval/reconstruction metadata with the fixture evidence.
6. Missing categories must be explicitly `UNAVAILABLE`; they may not be silently skipped or replaced with same-window target results.
7. The FIH probability stage may begin for a fixture only after its research record has been persisted and verified.
8. A backtest cannot be marked complete if fixture-specific research was skipped. A LiveScore-only or same-window-form run must be labeled a baseline/data test, never a completed FIH backtest.


## Backtest research snapshot time
For historical FIH backtests, use a fixed daily information cutoff of **06:00 South Africa Standard Time (SAST), Africa/Johannesburg (UTC+02:00)**.

For each historical target date:
1. Reconstruct the fixture board and research state as it was available at 06:00 SAST on that date.
2. Only evidence, news, statistics, injuries, standings, context, and historical market odds published or verifiably available by 06:00 SAST may be used.
3. Information first available after 06:00 SAST is excluded even if it was available before kickoff.
4. Match results, later lineups, later injury news, later odds movement, and all post-06:00 information must not influence the frozen FIH assessment.
5. Persist the research cutoff as `06:00 Africa/Johannesburg` with each backtest date/evidence package.
6. Freeze the model assessment from this 06:00 snapshot before attaching actual results for evaluation.


## Backtest 06:00 fixture eligibility boundary
For each historical backtest date, fixture eligibility is determined using kickoff time in Africa/Johannesburg (SAST, UTC+02:00).

- Kickoff before 06:00 SAST: EXCLUDED.
- Kickoff exactly at 06:00 SAST: EXCLUDED.
- Kickoff after 06:00 SAST: ELIGIBLE for research and subsequent backtest stages.

Therefore the eligibility condition is strictly `kickoff > 06:00 SAST`. Excluded fixtures must not be counted in the backtest denominator, researched as target fixtures, modeled, selected, or evaluated. They may only appear in historical evidence for later eligible fixtures when they were completed and their information was available by the applicable 06:00 research snapshot.


## Missing-evidence continuation guardrail

Difficulty finding or reconstructing historical evidence is **not, by itself, a Hard Stop**.

For every eligible fixture, the mandatory research loop is:

**Search -> enforce cutoff -> persist verified evidence -> mark each unverifiable field `UNAVAILABLE` -> verify persisted research record -> continue to the next fixture.**

Rules:
- A missing last-five record, venue split, H2H, standing, injury, motivation item, opponent-strength measure, rest datum, or historical market price does not require user approval and does not terminate the run.
- Sparse evidence may cause a market or entire fixture to become `INSUFFICIENT_DATA` or `NO_BET`; that is a valid model/decision outcome, not an execution failure.
- Historical research being slow, difficult, incomplete, or spread across many fixtures is not a material architecture change and is not a reason to pause.
- Do not fabricate or use post-cutoff evidence to fill a gap. Record the gap as `UNAVAILABLE` and continue.
- A genuine integrity Hard Stop exists only when proceeding would require using known invalid/leaked/fabricated data, corrupting persisted data, or materially changing architecture/scope. The mere existence of unavailable evidence does not meet that condition.
- After the final eligible fixture research record is persisted and verified, continue automatically through model calculation, odds/value comparison where available, decisions/NO BET, result ingestion for backtests, evaluation, persistence, and final verification.


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

## Executable status enforcement

For every stage outcome, apply the locked machine-readable rules in `config/fih-execution-rules.json` and the validator in `scripts/contract-gate.ts`.

An intermediate success continues. An ordinary failure enters RECOVERING and continues through the recovery ladder. WAITING requires the external-wait rule. BLOCKED requires the terminal-block rule, recovery-exhaustion rule, a defined hard-stop code, and evidence of the required recovery attempts. COMPLETE requires the terminal-completion rule plus reconciled ledger, aggregate, commit, and production-deployment evidence.

If the validator refuses BLOCKED or COMPLETE, resume from the earliest unfinished stage. A prose conclusion may not override persisted gate state.

Do not disable recurring FIH automation because an individual run fails. Disable it only on explicit user instruction or when continued execution is independently shown to be unsafe or destructive.


## Terminal-response enforcement

For an authorized FIH run, do not end with an ordinary final response while the durable ledger reports `RUNNING` or `RECOVERING` with unfinished eligible fixtures. Invoke the contract gate as a terminal guard. A `RESP-001` refusal means resume immediately from the earliest unfinished persisted stage. Only full `COMPLETE`, a contract-valid hard-stop `BLOCKED`, or genuine external `WAITING` is terminal.
