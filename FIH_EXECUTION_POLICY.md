# FIH Execution Policy — Step 1 Only

Before running FIH, read `FIH_EXECUTION_CONTRACT.md`, `FIH_BUILD_STEPS.md`, and `config/fih-execution-rules.json`.

The only active lifecycle is:

**Resolve date -> fetch fixtures -> persist to GitHub -> re-read committed fixture file -> verify -> stop.**

A run is successful only when the canonical per-date fixture file is present in GitHub and passes the persisted-data checks defined for Step 1.

Do not start or prepare any research, model, market, prediction, decision, accumulator, ledger, handoff, or later-step work after Step 1 succeeds.
