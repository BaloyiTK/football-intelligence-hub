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

For an authorized Step-1/Step-2 run command, do not depend on chat memory or a manual GitHub workflow-dispatch action. Parse/validate the command with `scripts/fih-command-router.mjs`, then write the normalized command as the single line of `automation/run-now.flag` and commit it to `main`. The `FIH Steps 1-2 Command` workflow is the sole push-triggered owner of that flag and executes every resolved date sequentially. The legacy/full-pipeline workflow must not be triggered by this flag.

Examples of valid flag contents are `run today`, `run yesterday`, `run 2026-10-09`, `run past 7 days`, and `run from 2026-10-01 to 2026-10-09`.

Until Step 3 is explicitly acceptance-locked, a run triggered through this entrypoint terminates only after Step 1 and Step 2 have been independently persisted and verified (or a contract-valid hard stop). It must not invoke model/decision stages.

For authorized runs: investigate -> repair -> retry -> validate -> persist -> independently reread -> continue. Do not stop after finding a recoverable error. Do not skip a stage gate. Do not declare completion based on documentation, code presence, or an unverified write.

Step 1: new runs require a fresh LiveScore/RapidAPI fetch through configured Vercel integration for each date, GitHub commit, and independent persisted verification. Step 2: ChatGPT-owned source-backed research for each eligible fixture, verified accumulator and exactly one canonical research commit with GitHub reread. No Step 3 before Step 2 verification.

Deployment configuration must be portable: supply FIH_GITHUB_OWNER, FIH_GITHUB_REPO, FIH_GITHUB_BRANCH, FIH_GITHUB_TOKEN, ls_api_key, ls_api_url, and the authorized AI research service connection through secure deployment configuration. Do not embed credentials in repository content. New ChatGPT environments require an explicit repository connection; credentials alone do not make the conversation aware of this project.

Until CI and live end-to-end acceptance tests pass, Steps 1 and 2 remain NOT READY. Do not override this gate to appease a user.
