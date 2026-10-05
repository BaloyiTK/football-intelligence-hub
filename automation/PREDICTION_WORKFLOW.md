# Daily Prediction Workflow

1. Resolve Africa/Johannesburg date/time.
2. Process every league in `data/leagues.json` through the FINAL entry.
3. Verify today's fixtures and exclude non-pre-match fixtures.
4. Research each fixture and record evidence depth: sampleSize, modelLevel, scoring consistency and recent goal volatility where available.
5. Attempt Full -> Standard -> Basic without fabricating inputs.
6. Run the production V2.3 calibrated Dixon-Coles model from `lib/model.ts`.
7. Calculate all markets and correct score.
8. Run reliability-adjusted one-market selector; store one recommendedBet or null.
9. PUBLIC BETTING LIST: publish only fixtures with recommendedBet != null. NO BET/model-only fixtures may be retained in internal/archive analytics but must not appear in the main betting list.
10. Continue through final league; recheck kickoff/status before writing.
11. Verify all league entries were checked.
12. Write daily/archive data, commit main, verify Vercel production.
13. Report recommendations, NO BET count and evidence mix.

Correct score is supporting forecast information. recommendedBet is the single actionable selection.