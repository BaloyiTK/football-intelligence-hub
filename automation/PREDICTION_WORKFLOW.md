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
6. Research every upcoming fixture using `RESEARCH_RULES.md`.
7. Attempt Full model evidence first, then Standard, then Basic.
8. Calculate the deterministic model using `MODEL_RULES.md` as soon as one evidence level is satisfied.
9. Use `No Model` only after all three evidence levels fail, or when the match has already started/finished. Never invent inputs.
10. Continue to the next fixture and league. Do not stop early.
11. After the final league, verify checked-league count equals the league-list count.
12. Write/update `data/predictions/YYYY-MM-DD.json` according to `OUTPUT_SCHEMA.md`.
13. Set scan.status=`complete` only after the final league has been checked.
14. Commit the daily file to main.
15. Verify the Vercel production deployment reaches READY.
16. Open/verify the production website displays the current daily file.
17. Only after production verification report the run COMPLETE.

## Failure rule
If any stage fails, preserve collected data, set scan.status=`incomplete`, record the failure/reason, and do not claim the daily run is complete.
