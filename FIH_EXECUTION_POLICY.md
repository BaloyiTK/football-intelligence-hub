# FIH Autonomous Execution Policy

For an explicitly authorized FIH task, recoverable technical failures do not end the task.

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

## FIH completion rule
Do not report a recoverable intermediate failure as the final task result. Investigate, fix, retry, verify, and continue until the requested task completes or a hard-stop condition is reached.
