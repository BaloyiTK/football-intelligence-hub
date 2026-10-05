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

## Daily-workflow equivalence and preflight
A historical backtest is the daily prediction workflow replayed at a historical timestamp, followed by grading. Before creating or resuming a backtest, the agent MUST pre-read the full rule chain and current production model and confirm these invariants:
- same worldwide fixture-discovery policy as the daily run;
- same Full -> Standard -> Basic -> No Model research hierarchy;
- same exact current `lib/model.ts`, market contract, thresholds and selector;
- evidence cutoff strictly before kickoff;
- prediction frozen before the final result is consulted;
- final result used only for grading;
- verified graded BET records flow into the canonical training dataset after completion.

Historical pre-match evidence MAY be reconstructed from the public web even when no prior FIH input file exists. Missing stored historical inputs are never a blocker by themselves. The agent must research the historical pre-kickoff state just as it researches the current pre-kickoff state for a daily prediction.

If the repository runner is temporarily unavailable in the active tool path, do not stop merely because of that choice. Continue all research/evidence construction that can be completed safely, persist it, and use any other repository-approved deterministic execution path available. Block only if exact production-model execution/finalization is genuinely impossible after approved fallbacks; never replace the model with hand approximations.

## Mandatory execution loop
Do not substitute a sample, selected leagues, or a convenient competition for the requested range.

For EACH calendar date from start through end:
1. Discover that date's worldwide fixture universe using at least TWO independent global date-indexed football sources.
2. Normalize competition/country/team aliases and map the global universe against ALL leagues in `data/leagues.json`.
3. Use targeted league/official-source searches only for disagreements, ambiguous competition names, missing source coverage, suspicious classification, or result verification that the global sources cannot resolve.
4. For EACH league in `data/leagues.json`, from entry 1 through the FINAL entry, persist the mapped fixtures or a verified zero-fixture checkpoint backed by the date-level global discovery sources.
5. Verify fixture, competition, kickoff and final result before grading.
4. For every verified fixture, reconstruct ONLY evidence that existed before that kickoff.
5. Attempt evidence hierarchy in order: Full -> Standard -> Basic.
6. Never use the fixture's own result or any later match as an input.
7. If reliable pre-match scoring/conceding evidence cannot be reconstructed, record NO MODEL with the reason and continue.
8. Run the exact current production model in `lib/model.ts`.
9. Freeze the model output BEFORE grading: model level, sample size, lambdas, 1X2 probabilities and the single 1X2 `recommendedBet` or NO BET.
10. Reveal/use the already-known final score only after the model output is frozen.
11. Grade the ONE `recommendedBet` as WIN or LOSS. NO BET and NO MODEL are neither wins nor losses.
12. The completed result may then become historical evidence for a later kickoff, never an earlier one.
13. Continue to the next fixture, next league, and next date. Do not stop early.

## Historical global-discovery safeguards
- Global discovery is a search-efficiency optimization, not permission to shrink the league universe.
- Require at least two independent date-level sources before bulk zero-fixture completion.
- Disambiguate generic competition names by country.
- Reject youth/women/reserve/U23/club-friendly contamination unless explicitly configured.
- Normalize timezone/date boundaries before assigning a fixture to a historical date.
- Resolve source disagreements with targeted/official research rather than choosing whichever source is convenient.
- Cache each date-level global fixture universe so it is researched once and reused across all configured leagues.

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
- results by 1X2 pick: Home / Draw / Away
- results by Elite / Strong / Good
- results by Full / Standard / Basic
- results by sample-depth band: 1-2, 3-4, 5-7, 8+
- probability calibration gaps
- Brier/log loss where applicable
- recurring failure patterns

If verified historical odds are available, ROI may be reported separately. Never invent odds.

## Output
Use one canonical backtest file per requested date range. A fresh backtest always starts from scratch and overwrites the canonical file for that period.

Filename format:
`data/backtests/YYYY-MM-DD_to_YYYY-MM-DD.json`

If the canonical file already exists, reset it before processing. Use `--resume` only when explicitly continuing the same interrupted run. A new user-requested backtest must not inherit prior checkpoints, fixtures, metrics, or conclusions from an older run.

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
- A known historical final score is explicitly allowed for grading AFTER the reconstructed prediction has been frozen.

## NO BET reporting rule
- `NO BET` and `NO MODEL` are internal processing decisions, not prediction result rows.
- Do NOT persist `NO BET` or `NO MODEL` fixtures in the backtest `fixtures` result array. Persist only aggregate/checkpoint counts for these decisions.
- Exclude `NO BET` fixtures from displayed backtest results, wins/losses, hit-rate denominators, market results, rating results, model-level performance results, sample-depth performance results, calibration results, and any headline performance statistics.
- User-facing backtest result tables must show recommended bets only unless the user explicitly asks to inspect `NO BET` cases.
- The persisted `fixtures` result array contains recommended bets only. `NO BET` / `NO MODEL` counts may remain in coverage checkpoints and aggregate processing metrics, but never as saved match-result records.

## User-requested backtest contract
When the user asks for a backtest, treat the request as a complete execution task, not as a request for methodology or a partial sample.

Required sequence:
1. Create or reset the canonical report file for the requested period at the start of execution with `status: "in-progress"`. Every newly requested backtest starts from scratch and overwrites any existing canonical report for that exact period. Only an explicit resume operation may continue prior checkpoints.
2. Execute the entire requested date range and configured league universe according to this file.
3. During a long run, give progress updates using ONLY measured checkpoint data from the actual report/run. Never use illustrative, estimated, simulated or invented progress counters.
4. Do not end the task merely because a progress update was shown. Continue execution in the same active run.
5. After all required dates and league entries have been checked, set `status: "complete"`.
6. Show the user the final recommended-bet results: bets, wins, losses, hit rate and required breakdowns. Do not include NO BET fixtures in displayed performance results.
7. Analyze the completed test for recurring failure patterns and explain what could improve the model.
8. Any proposed model change must be evidence-based and tested against the same walk-forward sample plus a holdout before production promotion.
9. Save the complete audit, aggregate metrics, failure analysis and improvement candidates in the backtest file.

If execution genuinely cannot be completed, leave the canonical report `in-progress`, state exactly what blocked completion, and never imply that work continues after the active response ends.


## Execution architecture
The backtest must be executed by the repository runner, not represented by a report file alone.

Command:
`npm run backtest -- --from YYYY-MM-DD --to YYYY-MM-DD --evidence data/backtest-evidence/<evidence-file>.json`

Resume:
`npm run backtest -- --from YYYY-MM-DD --to YYYY-MM-DD --resume data/backtests/<run-file>.json --evidence data/backtest-evidence/<evidence-file>.json`

Rules:
- Research/discovery first produces a verified evidence JSON covering every requested date/league, including zero-fixture coverage.
- Creating an empty `in-progress` report is NOT execution progress.
- The runner checkpoints after every date/league pair and can resume without duplicating fixture records.
- Only the runner may mark the report `complete` after all configured leagues and requested dates are covered.
- The runner imports the production `lib/model.ts`; do not duplicate model math in a backtest-specific implementation.
- Historical evidence collection must remain auditable and leakage-free. The runner never invents missing inputs.

