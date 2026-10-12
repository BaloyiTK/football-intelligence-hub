# Football Intelligence Hub

FIH is currently reset to a single active step.

## Step 1 — Fixture acquisition

Step 1:

- resolves the requested date in Africa/Johannesburg time;
- fetches soccer fixtures from LiveScore via RapidAPI through the configured Vercel endpoint;
- commits one canonical fixture file per date to GitHub;
- re-reads the committed file and verifies date, mode, structure, and fixture count.

That verified fixture commit is the end of the active workflow.

There is currently no Step 2 or later research/model/prediction pipeline.
