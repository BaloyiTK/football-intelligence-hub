# Daily Prediction Workflow

This file is the authoritative operating procedure for every manual or scheduled prediction run.

## Completion invariant
Finding fixtures is NEVER a stopping condition. Finding 1, 10, 50, or 100 matches does not complete the job. A normal run completes only after the FINAL entry in `data/leagues.json` has been processed.

## Run
1. Resolve today's date in Africa/Johannesburg.
2. Read `data/leagues.json` from first entry to last entry, in order.
3. For every league, follow `FIXTURE_DISCOVERY.md`.
4. If no fixtures exist today, record the league as checked and continue.
5. For every verified fixture, create its canonical fixtureKey and apply `DUPLICATE_RULES.md`.
6. Research the fixture using `RESEARCH_RULES.md`.
7. If evidence passes the research threshold, calculate the model using `MODEL_RULES.md`.
8. If evidence is insufficient, store the fixture as `No Model`; never invent inputs.
9. Continue to the next league. Do not stop early.
10. After the final league, verify checked-league count equals the league-list count.
11. Write/update `data/predictions/YYYY-MM-DD.json` according to `OUTPUT_SCHEMA.md`.
12. Set scan.status=`complete` only after step 10 succeeds.
13. Commit the daily file to main.
14. Verify the Vercel production deployment reaches READY.
15. Open/verify the production website displays the current daily file.
16. Only after production verification report the run COMPLETE.

## Failure rule
If any stage fails, preserve collected data, set scan.status=`incomplete`, record the failure/reason, and do not claim the daily run is complete.
