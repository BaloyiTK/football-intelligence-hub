# FIH Autonomous Execution Policy

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

## Default recovery loop
1. Detect the failure.
2. Inspect the relevant logs, response, repository state, or deployment state.
3. Identify the narrowest evidence-supported root cause.
4. Apply a bounded, reversible fix within the already-authorized task scope.
5. Redeploy or retry as required.
6. Verify the fix from actual output/state.
7. Continue the original task automatically.
8. Repeat when a new recoverable issue appears.

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
4. Attempt all evidence categories defined in `FIH_BUILD_STEPS.md`, including last-five overall, venue form, H2H, standings, goals profile, xG/xGA where reliable, squad availability, motivation/context, opponent strength, and rest/schedule.
5. Persist source references/URLs and retrieval/reconstruction metadata with the fixture evidence.
6. Missing categories must be explicitly `UNAVAILABLE`; they may not be silently skipped or replaced with same-window target results.
7. The FIH probability stage may begin for a fixture only after its research record has been persisted and verified.
8. A backtest cannot be marked complete if fixture-specific research was skipped. A LiveScore-only or same-window-form run must be labeled a baseline/data test, never a completed FIH backtest.
