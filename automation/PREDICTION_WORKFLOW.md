# Daily Prediction Workflow

Authoritative procedure for every manual or scheduled prediction run.

1. Resolve current date/time in Africa/Johannesburg.
2. Process every league in `data/leagues.json` through the FINAL entry.
3. Discover and verify fixtures; exclude anything no longer pre-match.
4. Research each upcoming fixture.
5. Attempt Full -> Standard -> Basic. Never fabricate inputs.
6. Run deterministic V2.1 model.
7. Calculate all markets and correct score.
8. Run the one-market selector. Store exactly one recommendedBet or null (NO BET).
9. Keep successfully modelled NO BET fixtures visible for analytics; omit only fixtures where modelling itself failed.
10. Continue through final league; recheck status before writing.
11. Purge started/live/completed/cancelled/abandoned fixtures.
12. Verify checked-league count equals total league count.
13. Write daily JSON, commit main, verify Vercel READY and production.
14. Report fixture count, recommended-bet count, NO BET count and model-level mix.

Correct score is a forecast. The recommendedBet is the single actionable model selection and is the metric used for betting-performance backtests.