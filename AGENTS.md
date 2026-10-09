# FIH Agent Entry Point

This repository is the sole authority for Football Intelligence Hub behavior. Never rely on previous chats or account memory.

Before any FIH command, read in order:
1. `FIH_EXECUTION_CONTRACT.md`
2. `FIH_EXECUTION_POLICY.md`
3. `FIH_BUILD_STEPS.md`
4. `config/fih-execution-rules.json`
5. `FIH_PORTABLE_COMMAND_CONTRACT.md`

Interpret `run now`, `run today`, `run yesterday`, `run tomorrow`, `run past N days`, `run next N days`, `run from YYYY-MM-DD to YYYY-MM-DD`, and `status` using `scripts/fih-command-router.mjs` and Africa/Johannesburg calendar time. Status is read-only and must use persisted evidence.

## Stateless run trigger

For an authorized Step-1/Step-2 run command, do not depend on chat memory or a manual GitHub workflow-dispatch action. Parse/validate the command with `scripts/fih-command-router.mjs`, then write the normalized command as the single line of `automation/run-now.flag` and commit it to `main`. The `FIH Steps 1-2 Command` workflow is the sole push-triggered owner of Step 1 for that flag and prepares the frozen Step-2 queue for every resolved date sequentially. The workflow MUST NOT execute Step-2 research through Vercel or any repository-hosted AI worker; the active ChatGPT execution must consume the queue and continue Step 2. The legacy/full-pipeline workflow must not be triggered by this flag.

Examples of valid flag contents are `run today`, `run yesterday`, `run 2026-10-09`, `run past 7 days`, and `run from 2026-10-01 to 2026-10-09`.

Until Step 3 is explicitly acceptance-locked, the authorized ChatGPT run terminates only after Step 1 and Step 2 have been independently persisted and verified (or a contract-valid hard stop). The GitHub workflow may stop after verified Step 1 plus durable Step-2 queue preparation, but that is a handoff boundary, not user-task completion; ChatGPT must continue Step 2 in the same authorized execution. It must not invoke model/decision stages.

For authorized runs: investigate -> repair -> retry -> validate -> persist -> independently reread -> continue. Do not stop after finding a recoverable error. Do not skip a stage gate. Do not declare completion based on documentation, code presence, or an unverified write.

Step 1: new runs require a fresh LiveScore/RapidAPI fetch through configured Vercel integration for each date, GitHub commit, and independent persisted verification. Step 2: ChatGPT-owned source-backed research for each eligible fixture, verified accumulator and exactly one canonical research commit with GitHub reread. No Step 3 before Step 2 verification.

Deployment configuration must be portable: supply FIH_GITHUB_OWNER, FIH_GITHUB_REPO, FIH_GITHUB_BRANCH, FIH_GITHUB_TOKEN, ls_api_key, and ls_api_url through secure deployment configuration for Step 1. Step 2 must not require a Vercel/hosted AI research credential. New ChatGPT environments require an explicit repository connection and ChatGPT web-search capability; credentials alone do not make the conversation aware of this project.

## Mandatory ChatGPT handoff continuation

After committing `automation/run-now.flag`, the active ChatGPT execution MUST remain in the same authorized task and actively inspect the corresponding GitHub workflow/repository state until Step 1 is either verified or a contract-valid hard stop is proven. A successful Step-1 workflow is not a response boundary.

Step 1 handoff is accepted only when `data/run-state/<date>.json`, `data/research-queue/<date>.json`, and `data/recovery-requests/<date>.json` have been independently reread from `origin/main`, share the same `runId`/`researchRunId`, the recovery record status is exactly `CHATGPT_RESEARCH_REQUIRED`, and queue count equals the frozen eligible count.

Immediately after that verification, ChatGPT MUST create/verify the single local `/mnt/data/fih/research-work/<date>.json` accumulator for that `researchRunId` and begin fixture-by-fixture web research. Do not emit a normal final response, progress-only response, or wait for a cron/watchdog to wake the chat. The watchdog may detect/persist recovery state but it cannot substitute for the active ChatGPT Step-2 executor.

Before any user-facing terminal response during an authorized run, reread the ledger and handoff record. `CHATGPT_RESEARCH_REQUIRED`, or `RUNNING`/`RECOVERING` with unfinished eligible fixtures, is non-terminal under `RESP-001` and requires immediate continuation.

Until CI and live end-to-end acceptance tests pass, Steps 1 and 2 remain NOT READY. Do not override this gate to appease a user.
