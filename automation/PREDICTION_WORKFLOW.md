# Daily Prediction Workflow

This file is the authoritative operating procedure for every manual or scheduled prediction run.

## Completion invariant
A run completes only after the FINAL entry in `data/leagues.json` has been processed.

## Published-feed invariant
The published prediction feed contains ONLY upcoming fixtures with a successfully calculated deterministic model. Never publish started/live/completed/cancelled/abandoned fixtures. Never publish `No Model` fixtures or `model: null` rows.

## Run
1. Resolve today's date/time in Africa/Johannesburg.
2. Process every league in `data/leagues.json`.
3. Discover and verify today's fixtures.
4. Exclude anything no longer pre-match.
5. Research each upcoming fixture.
6. Attempt Full, then Standard, then Basic.
7. If a deterministic model succeeds, retain the fixture for publication.
8. If all model levels fail, omit that fixture from the published `fixtures` array. It may be counted internally in scan notes, but must not be listed publicly.
9. Continue through the final league.
10. Immediately before writing output, purge any fixture that started during the run and every fixture without a model.
11. Verify checked-league count equals total league count.
12. Write the prediction-only daily JSON, commit main, verify Vercel READY and verify production.
13. Only then report COMPLETE.

Never fabricate inputs merely to force a fixture into the feed.
