# FIH PROCESS

## Step 1 — Get Daily Fixtures

1. Resolve the requested date or date range using the Africa/Johannesburg calendar.
2. Call the configured FIH Vercel fixture endpoint.
3. Vercel fetches the complete soccer fixture board from LiveScore via RapidAPI.
4. Persist one canonical fixture file per date in GitHub:
   - current/future dates: `data/prediction-fixtures/YYYY-MM-DD.json`
   - past dates: `data/backtest/fixtures/YYYY-MM-DD.json`
5. Re-read the committed file and verify date, mode, structure, non-zero fixture count, `fetchedAt`, and commit identity.

Step 1 remains the authoritative fixture-acquisition stage.

## Step 2 — SofaScore Custom xG Pilot

Step 2 is an explicit pilot and may run only after Step 1 is verified for the same date.

1. Load SofaScore football scheduled events for the date.
2. Process at most 15 events per pilot run.
3. For each event:
   - fetch each team's recent finished events, with per-team caching;
   - calculate last-five overall form;
   - calculate last-five home form for the home team;
   - calculate last-five away form for the away team;
   - fetch up to five H2H events and orient historical goals to today's teams;
   - calculate the custom xG using the locked pilot weights.
4. Persist `data/step2-xg/YYYY-MM-DD.json`.
5. Push the result to `main`, re-fetch `origin/main`, and verify the persisted schema/date/non-zero prediction count.
6. Stop.

There is no active betting-decision, market, accumulator, staking, or later pipeline stage.
