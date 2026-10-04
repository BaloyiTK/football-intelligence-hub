# Daily Prediction Workflow

This file is the authoritative operating procedure for every manual or scheduled prediction run.

## Completion invariant
Finding fixtures is NEVER a stopping condition. A normal run completes only after the FINAL entry in `data/leagues.json` has been processed.

## Prediction-feed invariant
The prediction feed contains UPCOMING fixtures only. Before research and again immediately before writing the daily JSON, check fixture status/current time. If a match has started, finished, been abandoned or otherwise is no longer pre-match, EXCLUDE it from `fixtures`. Never retain completed matches as placeholders and never generate retrospective predictions.

## Run
1. Resolve today's date/time in Africa/Johannesburg.
2. Read `data/leagues.json` from first entry to last entry, in order.
3. For every league, follow `FIXTURE_DISCOVERY.md`.
4. Exclude fixtures that have already started/finished.
5. Apply canonical fixtureKey and `DUPLICATE_RULES.md`.
6. Research every upcoming fixture using `RESEARCH_RULES.md`.
7. Attempt Full, then Standard, then Basic.
8. Calculate the deterministic model as soon as one evidence level is satisfied.
9. Use `No Model` only after all evidence levels fail for a still-upcoming verified fixture.
10. Continue to the final league; never stop early.
11. Re-check status/time and remove any fixture that started during the run.
12. Verify checked-league count equals the league-list count.
13. Write `data/predictions/YYYY-MM-DD.json`.
14. Commit to main, verify Vercel READY, then verify the production website.
15. Only then report COMPLETE.

## Failure rule
If any stage fails, preserve valid upcoming data, set scan.status=`incomplete`, record the reason, and do not claim completion.
