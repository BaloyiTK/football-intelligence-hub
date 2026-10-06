# FIH Autonomous Execution Policy

For an explicitly authorized FIH task, recoverable technical failures do not end the task.

## Mandatory stage lifecycle
Every daily-run and backtest stage must follow:

**Invoke -> Verify output -> Persist -> Verify persisted data -> Continue**

A stage is not complete merely because a command, API, function, deployment, or model step returned successfully.

Before continuing, verify the actual output and then verify the persisted artifact/state. For fixture ingestion this includes a valid date/schema, a non-zero fixture count, a non-empty payload, and the expected file committed to GitHub.

If a stage fails, use:

**Invoke -> Failure -> Investigate -> Fix -> Retry -> Verify -> Persist -> Verify -> Continue**

This lifecycle applies throughout the FIH pipeline, including fixture ingestion, research/evidence, model probabilities, market data, market comparison, decisions, predictions, and verified results.

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
Do not report a recoverable intermediate failure as the final task result. Investigate, fix, retry, verify, persist, verify the persisted state, and continue until the requested task completes or a hard-stop condition is reached.
