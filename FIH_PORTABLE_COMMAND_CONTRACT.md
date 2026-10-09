# FIH Portable Command Contract — Steps 1 and 2

Status: IMPLEMENTATION SPECIFICATION — NOT YET VERIFIED OR ACCEPTANCE-LOCKED

## Stateless entrypoint
Every fresh ChatGPT session or cloned repository must load, in order, `FIH_EXECUTION_CONTRACT.md`, `FIH_EXECUTION_POLICY.md`, `FIH_BUILD_STEPS.md`, and `config/fih-execution-rules.json` before interpreting FIH commands. Never rely on conversation memory. A repository clone requires explicit GitHub/Vercel configuration for Step 1 and an active ChatGPT execution with web-search capability for Step 2; a clone alone does not grant access.

## Command semantics
- `run now`, `run today`: fresh prediction acquisition for the current Africa/Johannesburg calendar day.
- `run tomorrow`: fresh prediction acquisition for the following day.
- `run yesterday`: fresh historical/backtest acquisition for the previous day.
- `run YYYY-MM-DD`: run that day; past dates route to BACKTEST, today and future to PREDICTION.
- `run past N days`: inclusive period ending today, with N dates.
- `run next N days`: inclusive period beginning today, with N dates.
- `run from YYYY-MM-DD to YYYY-MM-DD`: inclusive date range, reject inverted/invalid dates.
- `status`: report persisted run stage, verified date coverage, per-date next action, recovery reason, last verified artifact and commit, and whether work is actively executing; never infer success from a heartbeat.
- `status YYYY-MM-DD`: the same for a specified day.
Ambiguous relative dates must be resolved with Africa/Johannesburg time. A run request authorizes the full pipeline; a status request only inspects state.

## Step 1 invariants
Each explicitly new run triggers a genuine fresh LiveScore request per date through Vercel, regardless of prior cached snapshots. Persist full raw response to a date-isolated canonical fixture file; a range manifest tracks dates but never replaces per-date canonical files. Verify provider response and fixture structure, commit, independently reread from GitHub and verify date/schema/count/identity and commit. Replace current dated snapshots only after successful validation; preserve prior frozen run lineage. If a refreshed fixture universe differs, invalidate incompatible downstream derived state and start a new run identity. For each date, Step 2 is forbidden before that date's Step 1 gate passes.

## Step 2 invariants
ChatGPT itself is the authoritative Step-2 web-research executor. Each eligible fixture must receive genuine source-backed category-specific research through ChatGPT web search. Vercel, Vercel AI Gateway, repository-local language-model workers, hosted research endpoints, scrapers, and provider fallbacks MUST NOT substitute for ChatGPT. Use exactly one atomic local working accumulator with locked schema `fih-step2-working-v1`, verify every write, and never commit partial research. On exact N/N canonical validation, commit `fih-daily-research-v5` once per researchRunId and independently reread GitHub before Step 3. The durable queue is the handoff into ChatGPT; normal Step-2 execution remains owned by the active ChatGPT run.

## Recovery and regression gates
On failure: investigate -> fix or authorized fallback -> retry -> verify output -> persist -> independently reread -> resume earliest unfinished stage. No failed stage may be skipped. Each date has a durable queue and independently recoverable stage state. Regression tests must cover date parsing and SAST rollover, one-day and 120-day ranges, fresh fetch on repeated runs, provider outage, malformed/empty provider payload, GitHub write conflict, GitHub reread mismatch, missing snapshot reconstruction, run-lineage changes, Step 1-to-2 gate, accumulator schema, interrupted fixture research, single canonical commit, and stateless session bootstrapping. Locking requires passing automated tests and verified real integration evidence, not merely the existence of this specification.

## Change control
This document records the meeting's agreed behavior without overriding existing locked rules. It is not evidence of implementation completion. Do not claim Steps 1 or 2 ready until implementation, regression tests, live integration checks, and GitHub reread all pass. Do not launch fixture acquisition as part of a requirements review unless the user authorizes testing.
