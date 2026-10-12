# FIH Execution Policy — Step 1 + Step 2 Pilot

Before running FIH, read `FIH_EXECUTION_CONTRACT.md`, `FIH_BUILD_STEPS.md`, and `config/fih-execution-rules.json`.

The authorized lifecycle is:

**Step 1: resolve date -> fetch LiveScore fixtures -> persist -> re-read -> verify.**

For an explicit Step 2 pilot run:

**verify Step 1 exists -> collect LiveScore pregame form/H2H -> calculate custom xG -> persist -> re-read -> verify -> stop.**

Step 2 is not an automatic continuation of every Step 1 run. The pilot is separately triggered and capped at 15 events until the repository rules are explicitly changed.

Do not continue into betting decisions, market comparison, accumulators, staking, or any later stage.
