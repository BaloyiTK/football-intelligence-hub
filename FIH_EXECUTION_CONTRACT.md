# FIH Execution Contract — Step 1 + Step 2 Pilot

The repository currently defines two authorized operations.

## Step 1

- Resolve dates in Africa/Johannesburg time.
- Fetch a fresh LiveScore fixture board through the configured Vercel endpoint.
- Persist one fixture file per date in GitHub.
- Independently re-read and verify the committed fixture file.
- A failed fetch, write, or verification is a Step 1 failure.

## Step 2 pilot

- Step 2 may run only when a verified Step 1 fixture file already exists for the same date.
- Use SofaScore public JSON to obtain the date's scheduled events, recent team form, venue-specific form, and H2H history.
- Process at most 15 scheduled events until the pilot limit is explicitly changed.
- Apply the custom xG formula defined in `config/fih-execution-rules.json`.
- Persist the result to `data/step2-xg/YYYY-MM-DD.json`.
- Re-read the pushed file from `origin/main` and verify its schema, date, and non-zero prediction count.
- A verified Step 2 pilot file is the terminal state.

No betting decision, odds/market comparison, accumulator construction, staking, or later pipeline stage is authorized.
