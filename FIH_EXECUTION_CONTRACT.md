# FIH Execution Contract — Step 1 Only

The repository currently defines one active operation: **Step 1 fixture acquisition and verification**.

For an authorized run command:

- Resolve dates using Africa/Johannesburg time.
- Fetch a fresh LiveScore fixture board through the configured Vercel endpoint.
- Persist one fixture file per date in GitHub.
- Independently re-read the committed file and verify date, mode, structure, non-zero fixture count, and commit identity.
- A failed fetch, write, or verification is a Step 1 failure and must not be reported as success.
- A successful verified fixture commit is the terminal state for the run.

No research, evidence collection, modelling, prediction, market comparison, decision, recovery ledger, research queue, or later pipeline stage is authorized by this contract.
