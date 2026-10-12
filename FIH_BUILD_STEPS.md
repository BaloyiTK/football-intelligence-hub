# FIH PROCESS

## Step 1 — Get Daily Fixtures

Step 1 is the only active FIH step.

1. Resolve the requested date or date range using the Africa/Johannesburg calendar.
2. Call the configured FIH Vercel fixture endpoint.
3. Vercel fetches the complete soccer fixture board from LiveScore via RapidAPI.
4. Vercel persists one canonical fixture file per date to GitHub:
   - current/future dates: `data/prediction-fixtures/YYYY-MM-DD.json`
   - past dates: `data/backtest/fixtures/YYYY-MM-DD.json`
5. Re-read the committed file from GitHub and verify:
   - requested date and mode match;
   - the payload contains fixture stages/events;
   - fixture count is non-zero and equals the persisted event count;
   - `fetchedAt` is present;
   - the GitHub commit SHA exists and the committed file can be parsed.
6. Step 1 is complete only after the persisted GitHub fixture file passes verification.

Step 1 stops here. There is no Step 2, research handoff, model stage, decision stage, market stage, or downstream automatic continuation.
