# Weekly Backtest and Model Improvement

Run once per week using only information that existed before each historical kickoff.

1. Backtest the current production model over the latest eligible historical window and append enough older fixtures to target a meaningful sample.
2. Score the ONE recommended market independently from correct score.
3. Report total bets, wins/losses, hit rate, market-level hit rates, Elite/Strong/Good, Full/Standard/Basic, sample-depth bands, Brier/log loss where applicable, and calibration gaps.
4. Identify recurring failure patterns. Never patch individual matches.
5. Propose candidate parameter changes in a comparison report.
6. Re-run current vs candidate on the SAME walk-forward sample plus a holdout segment.
7. Promote a model change only when evidence is sufficient and the candidate improves holdout performance/calibration without materially degrading important segments.
8. If evidence is insufficient or candidate is worse, keep production unchanged.
9. Save the weekly report under `data/backtests/weekly/YYYY-MM-DD.json` and record the production model version.

No future leakage. No fabricated history. Model evolution must remain auditable.