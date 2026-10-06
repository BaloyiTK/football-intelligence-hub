# FIH Autonomous Execution Policy

For an explicitly authorized FIH task, recoverable technical failures do not end the task.

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
