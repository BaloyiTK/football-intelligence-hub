# Historical Backtest Execution

This file is the authoritative procedure for an on-demand historical backtest of the production football model.

## Purpose
Answer: **If the current production model had existed during a past date range, what would it have predicted before each match, and did that one recommended bet win?**

Backtests are INTERNAL model validation. They are never added to the public daily prediction feed.

## Required inputs
- Date range supplied by the user. Example: 2026-09-05 through 2026-10-04.
- League universe: `data/leagues.json`, in its stored order.
- Production calculation code: `lib/model.ts`.
- Model/research rules: `automation/MODEL_RULES.md` and `automation/RESEARCH_RULES.md`.

## Mandatory execution loop
Do not substitute a sample, selected leagues, or a convenient competition for the requested range.

For EACH calendar date from start through end:
1. For EACH league in `data/leagues.json`, from entry 1 through the FINAL entry:
2. Discover every historical fixture in that league on that date using public web research.
3. Verify fixture, competition, kickoff and final result. Record zero fixtures when none occurred.
4. For every verified fixture, reconstruct ONLY evidence that existed before that kickoff.
5. Attempt evidence hierarchy in order: Full -> Standard -> Basic.
6. Never use the fixture's own result or any later match as an input.
7. If reliable pre-match scoring/conceding evidence cannot be reconstructed, record NO MODEL with the reason and continue.
8. Run the exact current production model in `lib/model.ts`.
9. Freeze the model output BEFORE grading: model level, sample size, lambdas, probabilities, correct-score forecast and the single `recommendedBet` or NO BET.
10. Reveal/use the already-known final score only after the model output is frozen.
11. Grade the ONE `recommendedBet` as WIN or LOSS. NO BET and NO MODEL are neither wins nor losses.
12. The completed result may then become historical evidence for a later kickoff, never an earlier one.
13. Continue to the next fixture, next league, and next date. Do not stop early.

## Completion rule
A requested backtest is NOT COMPLETE until every date in the requested range and every league entry in `data/leagues.json` has a recorded scan status.

Never call a partial league, partial date, or partial fixture sample the requested backtest.

## Required fixture audit record
For each verified fixture retain:
- date and kickoff
- leagueId
- homeTeam / awayTeam
- evidence cutoff timestamp
- modelLevel: full | standard | basic | no-model
- sampleSize
- reconstructed model inputs
- lambdaHome / lambdaAway
- recommendedBet, including market, pick, rawProbability, reliability, adjusted probability and rating
- correctScore forecast (analysis only)
- actualScore
- outcome: WIN | LOSS | NO_BET | NO_MODEL
- source references sufficient to audit fixture/result and material historical inputs

## Final metrics
Report at minimum:
- configured leagues checked / total
- dates checked / total
- historical fixtures found
- modelled fixtures
- NO MODEL count
- recommended bets
- NO BET count
- wins
- losses
- overall hit rate = wins / recommended bets
- results by market
- results by Elite / Strong / Good
- results by Full / Standard / Basic
- results by sample-depth band: 1-2, 3-4, 5-7, 8+
- probability calibration gaps
- Brier/log loss where applicable
- recurring failure patterns

If verified historical odds are available, ROI may be reported separately. Never invent odds.

## Output
Save the internal report to:
`data/backtests/YYYY-MM-DD_to_YYYY-MM-DD_vMODEL.json`

The report must contain:
- `status: "complete"` only after the completion rule is satisfied.
- `leagueScan` showing all league entries checked.
- `dailyScan` showing every requested date checked.
- fixture-level audit records.
- aggregate metrics.

Partial work must use `status: "in-progress"` and MUST NOT expose aggregate numbers as the final requested backtest result.

## Model improvement
After a complete run, identify recurring failure patterns. Candidate parameter changes must be tested against the SAME walk-forward sample plus a holdout segment. Do not change production because of individual matches.

## Non-negotiable
- No future leakage.
- No fabricated fixtures, statistics, scores or odds.
- Do not skip leagues because they are inconvenient to research.
- Do not replace the requested range with a smaller sample.
- Do not count NO BET as a win.
- Correct score is analytical only and is graded separately from the recommended bet.
- A known historical final score is explicitly allowed for grading AFTER the reconstructed prediction has been frozen.

## NO BET reporting rule
- `NO BET` is an internal model decision, not a prediction result.
- Retain `NO BET` fixtures only in the internal audit for traceability.
- Exclude `NO BET` fixtures from displayed backtest results, wins/losses, hit-rate denominators, market results, rating results, model-level performance results, sample-depth performance results, calibration results, and any headline performance statistics.
- User-facing backtest result tables must show recommended bets only unless the user explicitly asks to inspect `NO BET` cases.
- `NO MODEL` is likewise not a betting result and must not be mixed into recommended-bet performance statistics.
