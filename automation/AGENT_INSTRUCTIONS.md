# Football Intelligence Agent Execution Contract

## Canonical contract authority
`automation/FIH_CONTRACT.json` is the canonical machine-readable contract and must be read before execution. During run, backtest, resume, reconciliation, grading, or training, the agent may not create, reinterpret, relax, extend, remove, or substitute FIH business rules. Self-correction may repair state or change an execution path, but may not change business rules. If a policy question is genuinely unanswered, record `SPEC_GAP`, preserve safe progress, and do not invent a rule; an explicit user-approved contract change is required outside execution.


This is the mandatory entry point for ChatGPT football runs.

Before any daily prediction run or historical backtest, read and obey:
1. `automation/FIH_CONTRACT.json`
2. `automation/AGENT_INSTRUCTIONS.md` (this file)
2. `data/leagues.json`
3. `automation/FIXTURE_DISCOVERY.md`
4. `automation/RESEARCH_RULES.md`
5. `automation/MODEL_RULES.md`
6. `automation/PREDICTION_WORKFLOW.md`
7. `automation/OUTPUT_SCHEMA.md`
8. `automation/DUPLICATE_RULES.md`
9. `automation/MODEL_TRAINING.md`
10. For historical runs: `automation/HISTORICAL_BACKTEST.md`
11. Production model: `lib/model.ts`

Repository rules are authoritative. Do not substitute remembered conversation rules, provider coverage, a sample of leagues, or convenient competitions.

## Mandatory preflight and self-correction
Before starting ANY execution command (daily run, historical backtest, resume, reconciliation or training):
1. Read the complete mandatory rule chain and production model before choosing an execution path.
2. Resolve the requested date/range and inspect existing non-complete runs before creating files.
3. Build an execution plan from the repository contract: discovery -> research -> exact production model -> freeze -> grade when historical -> validate/finalize -> training/publication when applicable.
4. Verify the chosen tools can perform each stage. A preferred tool/runner being unavailable is NOT a blocker if the same contract can be completed through another available approved path.
5. For backtests, historical research uses the SAME discovery/research/model instructions as a daily prediction, shifted to the historical pre-kickoff cutoff. Previously stored evidence is an accelerator, never a prerequisite.
6. Never introduce a new prerequisite that is absent from repository rules (for example, requiring old stored inputs before historical web reconstruction).

### Self-correction loop
If execution deviates from the contract, a validation step fails, a tool path is unavailable, or an assumption is disproven:
1. Detect and name the failed assumption internally; do not stop merely to explain it.
2. Re-read the controlling rule for that stage.
3. Roll back/repair only the invalid state; preserve valid frozen/checkpointed work.
4. Select the next valid execution path using available tools (web research, repository evidence, runner/CI, or deterministic local execution as allowed by the contract).
5. Persist the correction/cursor when repository state changes.
6. Resume execution immediately from the first non-terminal item.
7. Repeat until strict finalization succeeds or every approved fallback is genuinely unavailable.

A run-level blocker is allowed only when ALL applicable approved execution paths have been attempted or are unavailable and continuing would require fabrication, future leakage, or unsafe mutation. "I used the wrong approach", "the preferred runner is unavailable", "research is large", "stored evidence is missing", and "a progress update was emitted" are NEVER sufficient blocker reasons by themselves.

## Worldwide coverage policy
- FIH targets worldwide senior football coverage. The configured competition universe is dynamic and MUST NOT be constrained by a hard-coded league count.
- `data/leagues.json` is the current verified registry, not a permanent ceiling. Newly verified senior domestic leagues/divisions and senior international/continental competitions may be added as coverage expands.
- Global discovery MUST consider fixtures worldwide, including competitions not yet present in the registry. When a legitimate senior competition is discovered outside the registry, record it as a coverage-gap candidate for verification rather than silently discarding it.
- Only verified senior competitions enter automatic modelling. Youth, academy, reserve/U21/U23 and other age-group competitions remain excluded unless explicitly configured.
- Women's competitions are a separate coverage category and MUST NOT be silently mixed with men's competitions. They may be added explicitly with distinct competition identities.
- Club friendlies remain excluded from automatic league modelling unless explicitly configured. Senior international friendlies may remain configured separately.
- Completeness is measured against the competition registry snapshot frozen at the start of each run. Expanding the registry later MUST NOT invalidate completed historical runs.

## Controller
ChatGPT web research is the primary discovery/research layer. Structured datasets/APIs may be used as evidence accelerators, but they MUST NOT determine which configured leagues are checked.

For each requested date, discover fixtures globally before league-by-league research:
1. Query at least TWO independent global date-indexed football fixture sources for the requested date (for example FBref plus a broad worldwide fixture index such as LiveScore/Sofascore/FootballFixtures).
2. Normalize country, competition and team aliases, then map the global fixture universe against every configured league in `data/leagues.json`.
3. Persist the global discovery sources and all mapped fixtures before modelling.
4. If the global sources agree that a configured league has no fixtures, record a verified zero-fixture checkpoint using those global sources. Do NOT perform a separate league search merely to prove the same zero.
5. If sources disagree, a competition is ambiguous, a configured league is missing from source coverage, or a fixture/date/classification looks suspicious, perform targeted league/official-source verification for ONLY that exception.
6. After discovery, process `data/leagues.json` in stored order. Set leagues with mapped fixtures to `processing`, save EVERY mapped fixture, and execute fixture research/model rules.
7. Global discovery reduces search volume; it NEVER reduces the configured competition-universe coverage requirement.
8. Process each fixture through `RESEARCH_RULES.md` in order: Full -> Standard -> Basic -> No Model.
9. Preserve sources and evidence timestamp/cutoff. Missing data is null/unknown, never invented or silently zero.
10. Run the exact production model from `lib/model.ts`.
11. Save the frozen model output/recommended bet (or NO BET/NO MODEL) immediately.
12. For historical runs only, reveal the final score after freezing and grade the recommendation.
13. Mark the date/league `complete` only after every discovered fixture is processed.
14. Save/checkpoint before moving to the next league.

## Global discovery source rules
- A generic competition label such as "Premier League" or "Serie A" MUST be disambiguated by country before mapping to a configured league.
- Date/time normalization must use the fixture venue/competition date correctly; timezone-shifted global pages must not silently move fixtures across dates.
- Youth, women, reserves/U23, club friendlies and other competitions must not be mapped to a senior configured league unless that exact competition is configured.
- Postponed/cancelled fixtures may be retained for audit but are not modelled as playable fixtures.
- One global source is insufficient to certify the entire daily universe. Use at least two independent global sources, and targeted verification for disagreements.
- Cache/reuse the date-level global discovery result across the entire configured competition universe.

## Web-first rule
- Lack of coverage in Football-Data, OpenFootball, an API, or any other dataset is NEVER permission to skip a league.
- Search the wider public web when a structured source is missing or incomplete.
- Prefer multiple useful sources where practical and authoritative/reputable sources when available.
- A zero-fixture conclusion must itself be verified; absence from one provider is insufficient.

## Progress
Progress comes only from persisted checkpoints:
- leagues checked / total
- dates checked / total
- fixtures discovered / processed
- modelled / NO MODEL
- recommended bets
- for historical runs: wins / losses / hit rate
- current date and league

Never estimate, simulate, or invent progress. Creating an empty report is not progress.

## Completion
A run is complete only when every requested date × every configured league has a persisted `complete` checkpoint and every discovered fixture has a terminal state: BET, NO BET, or NO MODEL.

For today's run, do not require historical grading. For a backtest, also obey `HISTORICAL_BACKTEST.md`.

## Machine-enforced finalization gate
- League state is `pending -> discovering -> processing -> complete`. Discovery alone is never complete.
- If fixtures exist, a league may become `complete` only after every saved fixture is terminal: BET, NO_BET or NO_MODEL (historical grading may then be WIN/LOSS).
- Before presenting a run as finished, execute `npm run run:validate -- <run-file>`.
- If finalization validation fails, DO NOT describe the run as complete or label its selections as the full/final slate. Continue active execution when possible. If a genuine blocker prevents continuation, persist/report the blocker and surface any already-frozen prediction-eligible BET records as PARTIAL predictions.
- User-facing progress must distinguish `leagues discovered` from `leagues fully processed`.
- A run file's stored counters are advisory; final status must be recomputed/validated from fixture and league states.

## No-voluntary-stop execution rule
For user commands that start execution (for example: "run today", "run tonight", "backtest", or "resume run"), a progress update is informational only and is NEVER a stopping condition.

A normal final response is allowed only when ONE of these is true:
1. The run passes `npm run run:finalize -- <run-file>`; or
2. A real external/technical blocker prevents further tool execution in the active response. In that case persist `status: "blocked"`, persist a specific `blocker` reason and exact resume cursor, and report that blocker. Do not call ordinary workload, many fixtures, research still pending, or a progress checkpoint a blocker.

After every progress update, immediately continue with the next persisted non-terminal league/fixture. Never voluntarily end because discovery, a checkpoint, a batch, a league, or a progress message completed.

## Search exhaustion and blocker discipline
- A fixture or league MUST NOT become `blocked` merely because the first search failed, a preferred source is unavailable, research is slow, or a progress message was emitted.
- Before blocking, exhaust reasonable public-web fallback paths: alternate global index, targeted competition search, official league/association/club source, reputable statistics source, and the Full -> Standard -> Basic evidence hierarchy.
- Source disagreement triggers the mandatory data-repair loop; it is not itself a blocker.
- If one fixture cannot safely reach BET/NO_BET/NO_MODEL after those fallbacks, persist the exact attempted sources, unresolved fact, `current.stage`, canonical fixture identity, and `resumeAction` describing the next research query/action.
- Continue processing other independent fixtures/leagues whenever the unresolved item does not prevent them. A local fixture problem must not stop the rest of the worldwide scan.
- A run-level blocker is permitted only when the unresolved dependency prevents further safe progress globally (for example tool/service unavailability, repository write failure, or an unresolved discovery fact that changes the fixture universe).
- On the next manual or scheduled ChatGPT execution, inspect today's latest non-complete run first. If it is resumable, continue from its persisted cursor/resumeAction instead of starting a duplicate run.
- Never convert an unresolved fixture to NO MODEL solely to make finalization pass. NO MODEL remains limited to the reasons in RESEARCH_RULES.md after the required fallback attempts.

## Resume determinism
- Persist `current` with date, leagueIndex/leagueId, fixture index or fixture identity, and stage.
- On resume, read the run file and continue from the first non-terminal checkpoint; do not rediscover completed work unless verification is contradicted.
- Terminal fixture records must contain sources and the evidence/model state needed for audit.
- Zero-fixture league completion requires at least one explicit verification source; absence from an API/dataset is not enough.
- `blocked` is reserved for genuine external/technical inability to proceed and requires a blocker reason. Pending research is `processing`, not blocked.

## Validation modes
- `npm run run:validate -- <run-file>` checks checkpoint integrity and allows legitimate in-progress work.
- `npm run run:finalize -- <run-file>` is the strict completion gate and must pass before a run is described as finished or final recommendations are presented as the completed run.

## Completeness invariants
- The run must contain exactly the current configured league IDs from `data/leagues.json`: no missing, duplicate or unknown league checkpoints.
- Duplicate fixture identities are invalid.
- Daily-run terminal BET records require a persisted recommended bet; daily NO_BET/NO_MODEL audit records require their decision/reason and sources.
- Historical backtests follow `HISTORICAL_BACKTEST.md`: the backtest `fixtures` result array persists recommended-bet records only; NO_BET and NO_MODEL decisions remain auditable through league/date checkpoints and aggregate counts rather than being forced into the result array.
- CI runs integrity validation for every changed run/backtest file and additionally runs strict finalization validation whenever a changed file declares `status: "complete"`.

## Prediction visibility and graceful partial results
Run completion and prediction visibility are separate concepts.

A fixture is prediction-eligible when ALL are true:
- it is persisted in the run file with terminal `status: "BET"`;
- `recommendedBet` exists and contains market, pick, raw probability, adjusted probability, reliability and rating;
- research/model evidence is frozen before kickoff and the record has a non-empty `sources` array;
- it is not subsequently invalidated by fixture/date/competition verification.

Prediction-eligible records MAY be shown immediately during progress when useful, when the user asks for predictions/results, and MUST be shown if a genuine blocker ends an otherwise active daily run and at least one eligible prediction exists.

When the global finalization gate has not passed:
- label surfaced bets `PARTIAL — verified/frozen so far`;
- state the persisted coverage (leagues complete/total and fixtures terminal/discovered);
- never imply the partial set is the day's complete slate;
- never expose discovered-only, research-pending, NO_BET or NO_MODEL records as recommendations.

When `npm run run:finalize -- <run-file>` passes, the eligible BET set may be labelled the completed/final daily recommendations.

A blocker therefore stops further research execution, not access to valid predictions already frozen before the blocker.

## Automatic retry and resume
- Repository automation may resume persisted `blocked` or `in-progress` backtests from their saved cursor/checkpoints.
- Automatic resume MUST NOT recreate or re-grade terminal fixture records; the runner skips completed date/league checkpoints and duplicate fixture identities.
- Transient runner failures may retry with bounded exponential backoff. A retry does not permit fabricated evidence or bypass validation.
- Scheduled automation may only process evidence already available to the repository. It cannot replenish ChatGPT/web-search allowance or invent missing research. If required evidence is absent, the run remains blocked/in-progress until evidence is supplied by a valid source.
- Completion still requires the strict finalization gate; automatic retry does not weaken any coverage, evidence, leakage or audit requirement.

## Fail-closed execution controller
- A historical backtest execution is successful only when runner execution, deterministic grading audit, and strict finalization all exit successfully.
- Use `npm run backtest:controller -- --from ... --to ... --evidence ... --resume <run-file>` for an existing run once evidence is available.
- An assistant progress response is never an execution boundary. If the active execution cannot reach the strict finalizer, persist a resumable non-complete state and exact cursor/blocker before ending.
- Never infer completion from discovery counters or a modelled subset.

## Mandatory data-repair loop
When fixture, date, competition, team, result, or evidence data conflicts, looks stale, or fails validation, NEVER stop at the first discrepancy. Execute this repair loop before a blocker is allowed:
1. Re-query the disputed item with targeted searches.
2. Prefer authoritative/organizer/association sources, but distinguish a published schedule from an actual played result; schedules may be superseded.
3. Require independent corroboration for changed/cancelled/replaced fixtures or results when available.
4. Check cancellation/postponement/replacement, timezone/date rollover, team aliases, competition classification, and youth/women/reserve contamination.
5. Correct the persisted fixture universe and counters immediately when wrong data is proven.
6. Continue from the corrected cursor automatically; a correction is NOT a stopping condition.
7. Only persist status=blocked after all reasonable repair paths above have actually been attempted and the unresolved fact is necessary to model or grade safely. Persist attempted sources and exact unresolved fact.
8. Never invent missing data merely to avoid a blocker.


## Controlled training and deployment boundary
- After result reconciliation, run `npm run model:train` only when new verified graded outcomes are available or when explicitly requested. Persist `data/training/candidate-v2.4.json` and append `data/training/training-log.jsonl` in the same controlled repository update; CI uses `model:train:check` and MUST NOT create ephemeral training history.
- Daily research may checkpoint freely, but website delivery should be consolidated: avoid chains of cosmetic/intermediate commits that each trigger a production build. Prefer one final validated publication commit after the run, prediction archive, result reconciliation and training artifacts are ready.
- A production health gate is truthful only when the Vercel status for the exact triggering GitHub SHA is successful. A healthy older deployment is not evidence that the new commit deployed.
- If Vercel reports rate limiting/quota exhaustion, mark website delivery blocked/deferred while preserving validated GitHub artifacts. Never claim production delivery until the exact-SHA gate succeeds.

## Mandatory website publication gate
A daily run is not operationally delivered until its prediction artifact is published and verified.
1. After freezing eligible BET records, write `data/predictions/YYYY-MM-DD.json` for the run date. The website must never depend on a hard-coded dated import.
2. If a full payload write is rejected, retry by reducing the payload to the website-required frozen fields; if the storage mechanism supports chunking, persist in bounded chunks and assemble/verify the final artifact. A large-write rejection is a transient publication failure, not permission to discard already-frozen BET records.
3. Run `npm run predictions:verify -- YYYY-MM-DD` after publication. The artifact date must match, fixtures must be an array, and every published recommendation must have a fixture identity, teams and recommended pick.
4. Re-read the published artifact after writing and compare its recommendation count with the frozen publishable BET count. A mismatch is a publication failure and must be retried/blocked explicitly.
5. Run completion and website delivery are separate fields. Persist publication status/cursor when possible. Never report predictions as published merely because modelling completed.
6. If publication remains blocked after bounded retries, keep the frozen predictions accessible as PARTIAL and persist the exact publication blocker. Never replace them with fabricated data.
7. The homepage must select the latest successfully published dated artifact automatically; adding a new date must not require editing application source code.


## Daily prediction archive and result lifecycle
- Every daily execution date MUST have its own immutable-address prediction artifact: `data/predictions/YYYY-MM-DD.json`. Never overwrite another date to publish today.
- The artifact is created on every daily run even when there are zero publishable bets; in that case publish an empty `fixtures` array plus scan/publication metadata so the calendar has an auditable daily record.
- Frozen pre-match prediction/model fields are immutable after kickoff. Result enrichment MUST add a separate `result` object and MUST NOT alter the frozen forecast or recommended bet.
- After fixtures finish, verify final scores using the result-verification rules, grade with `lib/grading.ts`, and enrich matching archived fixtures with `result.actualScore`, `result.outcome` and verification state/sources when available.
- Store a daily `results` aggregate with graded, wins, losses and winRate. Win rate is wins / graded recommended bets; exclude NO BET, NO MODEL and unverified/pending results.
- Historical UI must allow selecting any available archive date and show the frozen prediction beside actual result and WIN/LOSS. Never manufacture an actual result for a fixture that cannot be identity-matched and verified.
- Publication verification must run for every dated archive, including zero-bet days.
